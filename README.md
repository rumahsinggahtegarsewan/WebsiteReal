# Rumah Singgah Tegar Sewan — Website

Plain HTML + Tailwind CSS static site. No build pipeline, no database, no CMS.

---

## Cara Menjalankan Secara Lokal

1. Buka folder `rumah-singgah-tegar-sewan/` di VS Code
2. Install ekstensi **Live Server** di VS Code
3. Klik kanan pada `index.html` → **Open with Live Server**
4. Site terbuka di browser: `http://127.0.0.1:5500`

Tidak butuh Node.js, npm, atau instalasi apapun.

---

## Cara Menambah Cerita Cita-Cita Baru

1. **Minta izin tertulis** dari orang tua/wali anak sebelum apapun
2. Tambahkan foto anak ke `images/gallery/` dengan nama `cita-NNN.webp` (ganti NNN dengan nomor urut)
   - Kompres foto sampai di bawah 80KB. Gunakan [Squoosh](https://squoosh.app)
3. Buka file `data/cita-cita.json` dengan teks editor
4. Tambahkan objek baru di bawah, ikuti format yang sudah ada:
   ```json
   {
     "id": "cita-007",
     "displayName": "Inisial saja, misal: T.",
     "age": 9,
     "program": "Matematika",
     "dream": "Cita-cita anak dalam kalimat pendek",
     "shortStory": "Cerita singkat 1-2 kalimat tentang anak ini.",
     "imageUrl": "/images/gallery/cita-007.webp",
     "consentGiven": true
   }
   ```
5. Buka `galeri-cita-cita.html` dan tambahkan kartu baru mengikuti pola HTML yang sudah ada
6. Deploy (lihat bagian Deploy di bawah)

---

## Cara Update Nomor WhatsApp atau Rekening Bank

1. Buka `data/site-config.json` — ganti nilai `whatsappNumber`, `whatsappDisplay`, atau detail rekening
2. **PENTING:** Cari dan ganti nomor lama di semua file `.html` (gunakan Find & Replace di VS Code: `Ctrl+Shift+H`)
3. Pastikan nomor di footer, floating button, dan semua link `wa.me/...` sudah diperbarui
4. Deploy

---

## Cara Deploy ke Netlify

1. Buka [netlify.com](https://netlify.com) → Login
2. Drag and drop seluruh folder `rumah-singgah-tegar-sewan/` ke dashboard Netlify
3. Site langsung live. Selesai.

Untuk update: drag and drop ulang folder yang sudah diubah.

---

## File yang JANGAN Diubah

File-file berikut adalah struktur teknis — jangan diubah kecuali kamu tahu apa yang kamu lakukan:

- `css/style.css` — Sistem warna dan font. Mengubah ini akan merusak tampilan seluruh site.
- `js/main.js` — Navigasi mobile dan keamanan form.
- `netlify.toml` — Konfigurasi hosting dan keamanan.
- Semua file di `.planning/` — Dokumen referensi, tidak di-deploy.

---

## Stack

- HTML5 + Tailwind CSS (CDN)
- Vanilla JS (mobile nav, honeypot form)
- Hosting: Netlify free tier
- Forms: Netlify Forms (honeypot, no CAPTCHA)
- Maps: Google Maps `<iframe>` embed (no API key)
- Fonts: Google Fonts — Fredoka + Nunito
