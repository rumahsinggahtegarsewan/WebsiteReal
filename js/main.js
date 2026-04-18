/* main.js — Rumah Singgah Tegar Sewan */
/* Vanilla JS only. No frameworks. No external dependencies. */

(function () {
  'use strict';

  /* === MOBILE NAV TOGGLE === */
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      const isOpen = navMenu.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    /* Close menu when a nav link is clicked */
    navMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navMenu.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* === HONEYPOT FORM PROTECTION === */
  /* PRD §F4: No CAPTCHA, no API keys. Honeypot only. */
  const forms = document.querySelectorAll('form[data-honeypot]');

  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      const honeypotField = form.querySelector('[name="website"]');
      if (honeypotField && honeypotField.value !== '') {
        /* Bot filled the hidden field — silently reject */
        e.preventDefault();
        return false;
      }
    });
  });

  /* === ACTIVE NAV LINK === */
  /* Highlight the current page link in the navbar */
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-link').forEach(function (link) {
    const href = link.getAttribute('href').replace(/\/$/, '') || '/';
    if (href === currentPath || (currentPath === '/' && href === '/index.html')) {
      link.classList.add('nav-link--active');
      link.setAttribute('aria-current', 'page');
    }
  });

})();
