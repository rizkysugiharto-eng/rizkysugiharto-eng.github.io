# Portfolio — Rizky Bagus Eka Sugiharto

Maintenance Engineer · Reliability Analyst · Heavy Equipment

Website portfolio statis (HTML + CSS), di-hosting gratis lewat GitHub Pages.

- `index.html` — seluruh isi halaman
- `assets/img/` — foto, screenshot project, dan sertifikat (format WebP)
- `assets/CV-Rizky-Bagus-Eka-Sugiharto.pdf` — CV yang bisa diunduh dari website
- `assets/Portfolio-Rizky-Bagus-Eka-Sugiharto.pdf` — versi PDF portfolio (A4, 11 halaman) untuk tombol **Download Portfolio**
- `tools/build-portfolio-pdf.mjs` — membuat ulang PDF portfolio dari `index.html`

## Memperbarui PDF portfolio

Setiap kali isi `index.html` berubah, buat ulang PDF-nya supaya ikut ter-update:

```bash
npm install playwright && npx playwright install chromium   # sekali saja
python3 -m http.server 8000                                  # terminal 1, di folder repo
node tools/build-portfolio-pdf.mjs http://localhost:8000/    # terminal 2
```

Script menyusun satu bagian per halaman A4 dan menyesuaikan ukuran isi supaya pas
(tidak terpotong, tidak setengah kosong). Setelah itu naikkan angka `?v=` pada link
`Portfolio-Rizky-Bagus-Eka-Sugiharto.pdf` di `index.html` supaya browser mengunduh versi baru.
