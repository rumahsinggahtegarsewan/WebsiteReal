/**
 * Security monitoring + abuse protection edge function.
 * Runs on every request at Netlify's CDN edge — no server required.
 *
 * Protection layers (in evaluation order):
 *   1. Known bad-bot user-agent blocking        → 403
 *   2. Injection / path-traversal pattern block → 400
 *   3. Form POST rate limit (3 / 10 min / IP)   → 429
 *   4. General request rate limit (120 / min / IP) → 429
 *   5. Pass-through + response status logging
 *
 * Rate limiting uses Netlify Blobs (free tier KV store) for shared state
 * across edge function instances. Fails open so a Blobs outage never
 * blocks legitimate users.
 *
 * Logs are structured JSON captured by Netlify's function log stream.
 * View: Netlify Dashboard → Site → Logs → Functions
 */

import { getStore } from "netlify:blobs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RATE_LIMITS = {
  // Contact form POSTs — tight window to deter spam bots
  form: { limit: 3, windowSecs: 600 },        // 3 submissions / 10 min / IP
  // All other requests — generous for humans, punishing for scrapers
  general: { limit: 120, windowSecs: 60 },    // 120 requests / 1 min / IP
};

// User-agent fragments that identify known scrapers, vuln scanners, and
// SEO data harvesters. Matched case-insensitively against the UA string.
const BAD_BOT_FRAGMENTS = [
  "scrapy",
  "python-requests",
  "python-urllib",
  "go-http-client",
  "java/",
  "libwww-perl",
  "lwp-trivial",
  "curl/",
  "wget/",
  "masscan",
  "zgrab",
  "nikto",
  "sqlmap",
  "dirbuster",
  "dirb/",
  "gobuster",
  "nuclei",
  "nmap",
  "wfuzz",
  "semrushbot",
  "ahrefsbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "bytespider",
  "gptbot",         // OpenAI training crawler
  "ccbot",          // Common Crawl (high-volume scraper)
  "claudebot",      // Anthropic training crawler — block on this site per owner preference
  "facebookexternalhit", // Meta scraper (not needed; no OG preview required here)
];

// Request path patterns indicating active probing or injection attempts
const SUSPICIOUS_PATTERNS = [
  /\.\.(\/|\\)/,                             // path traversal
  /<script/i,                                // reflected XSS probes
  /union[\s+]select/i,                       // SQL injection
  /exec\s*\(/i,                              // code execution
  /\/etc\/passwd/,                           // Unix file inclusion
  /\/proc\/self/,                            // Linux process info leak
  /wp-(?:admin|login|config|includes)/i,     // WordPress scanner
  /\.php(\?|$)/i,                            // PHP endpoint probing
  /eval\s*\(/i,                              // eval injection
  /base64_decode/i,                          // encoded payload delivery
  /\bselect\b.+\bfrom\b/i,                   // generic SQL SELECT
  /(\bor\b|\band\b)\s+[\d'"]+=[\d'"]+/i,     // SQL boolean bypass
  /\binsert\s+into\b/i,                      // SQL INSERT
  /\bdrop\s+table\b/i,                       // SQL DROP
  /;.*(shutdown|drop|truncate)/i,            // stacked SQL statements
  /\$\{.*\}/,                                // template injection (SSTI)
  /%00/,                                     // null-byte injection
  /\bping\s+-[cn]/i,                         // OS command injection via ping
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(entry) {
  console.log(JSON.stringify(entry));
}

/**
 * Fixed-window rate limiter backed by Netlify Blobs.
 *
 * Key format: rl:<category>:<ip>:<window_bucket>
 * Each bucket covers exactly `windowSecs` seconds, then a fresh bucket starts.
 * TTL is set to 2× the window so stale keys expire automatically.
 *
 * Fails open (returns { exceeded: false }) if the Blobs store is unavailable,
 * so an infrastructure issue never locks out legitimate visitors.
 */
async function checkRateLimit(store, ip, category, limit, windowSecs) {
  const bucket = Math.floor(Date.now() / 1000 / windowSecs);
  const key = `rl:${category}:${ip}:${bucket}`;

  try {
    const stored = await store.get(key);
    const count = stored === null ? 1 : parseInt(stored, 10) + 1;
    await store.set(key, String(count), { ttl: windowSecs * 2 });
    return { exceeded: count > limit, count, limit, windowSecs };
  } catch {
    // Fail open — Blobs outage should not become a self-inflicted outage
    return { exceeded: false, count: 0, limit, windowSecs };
  }
}

// ---------------------------------------------------------------------------
// Edge function entry point
// ---------------------------------------------------------------------------

export default async function securityMonitor(request, context) {
  const url      = new URL(request.url);
  const path     = url.pathname + url.search;
  const method   = request.method;
  const rawUA    = request.headers.get("user-agent") ?? "";
  const ua       = rawUA.toLowerCase();
  const ip       = context.ip ?? "unknown";
  const ts       = new Date().toISOString();

  // 1. Bad-bot user-agent block -----------------------------------------------
  if (BAD_BOT_FRAGMENTS.some((frag) => ua.includes(frag))) {
    log({ level: "WARN", type: "BOT_BLOCKED", timestamp: ts, ip, userAgent: rawUA, path });
    return new Response("Forbidden", { status: 403 });
  }

  // 2. Injection / traversal pattern block ------------------------------------
  if (SUSPICIOUS_PATTERNS.some((re) => re.test(path))) {
    log({ level: "WARN", type: "SUSPICIOUS_REQUEST", timestamp: ts, ip, method, path, userAgent: rawUA });
    return new Response("Bad Request", { status: 400 });
  }

  // 3. Rate limiting ----------------------------------------------------------
  const store = getStore("rate-limit");

  // Form POST: strictest limit
  if (method === "POST") {
    const { exceeded, count, windowSecs } = await checkRateLimit(
      store, ip, "form", RATE_LIMITS.form.limit, RATE_LIMITS.form.windowSecs
    );

    log({ level: "INFO", type: "FORM_SUBMISSION", timestamp: ts, ip, path, userAgent: rawUA, count });

    if (exceeded) {
      log({ level: "WARN", type: "RATE_LIMIT_EXCEEDED", category: "form", timestamp: ts, ip, count, limit: RATE_LIMITS.form.limit });
      return new Response("Too Many Requests — try again later.", {
        status: 429,
        headers: {
          "Retry-After": String(windowSecs),
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  }

  // General per-IP flood protection
  const { exceeded: floodExceeded, count: floodCount, windowSecs: floodWindow } =
    await checkRateLimit(store, ip, "general", RATE_LIMITS.general.limit, RATE_LIMITS.general.windowSecs);

  if (floodExceeded) {
    log({ level: "WARN", type: "RATE_LIMIT_EXCEEDED", category: "general", timestamp: ts, ip, path, count: floodCount, limit: RATE_LIMITS.general.limit });
    return new Response("Too Many Requests — slow down.", {
      status: 429,
      headers: {
        "Retry-After": String(floodWindow),
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  // 4. Pass through + response monitoring -------------------------------------
  const response = await context.next();

  if (response.status === 404) {
    log({ level: "INFO", type: "404_NOT_FOUND", timestamp: ts, ip, method, path, userAgent: rawUA });
  }

  // 5xx on a static site signals a Netlify platform issue
  if (response.status >= 500) {
    log({ level: "ERROR", type: "SERVER_ERROR", timestamp: ts, ip, method, path, status: response.status, userAgent: rawUA });
  }

  return response;
}
