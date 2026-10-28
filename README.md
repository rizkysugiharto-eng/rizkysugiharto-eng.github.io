# Portfolio — Rizky Bagus Eka Sugiharto

Maintenance Engineer · Reliability Analyst · Heavy Equipment

Website portfolio statis (HTML + CSS), di-hosting gratis lewat GitHub Pages.

- `index.html` — seluruh isi halaman (desain "Riwayat Servis Unit", Oktober 2026)
- `assets/img/` — foto, screenshot project, sertifikat, dan logo (format WebP/PNG)
- `assets/img/og-cover-2026.jpg` — gambar preview saat link dibagikan di LinkedIn/WhatsApp
- `assets/CV-Rizky-Bagus-Eka-Sugiharto.pdf` — CV yang bisa diunduh dari website
- `assets/Portfolio-Rizky-Bagus-Eka-Sugiharto.pdf` — versi PDF portfolio (A4, 12 halaman) untuk tombol **Download Portfolio**
- `tools/build_portfolio_pdf.py` — membuat ulang PDF portfolio dari `index.html`

## Memperbarui PDF portfolio

Setiap kali isi `index.html` berubah, buat ulang PDF-nya supaya ikut ter-update
(Windows, butuh Python dan Microsoft Edge):

```bash
pip install pymupdf                       # sekali saja
python -m http.server 8000                # terminal 1, di folder repo
python tools/build_portfolio_pdf.py       # terminal 2
```

Script mencetak tampilan cetak (`@media print`) di `index.html` lewat Edge, mengompres
gambarnya, dan mengganti link lokal ke alamat website. Setelah itu naikkan angka `?v=`
pada link `Portfolio-Rizky-Bagus-Eka-Sugiharto.pdf` di `index.html` supaya browser
mengunduh versi baru.

## Arsip desain lama

Desain sebelum Oktober 2026 (gelap + kuning, foto bulat di kiri) tetap disimpan:

- `portfolio-lama.html` — halaman lengkap desain lama (tidak diindeks mesin pencari)
- `assets/Portfolio-Rizky-Bagus-Eka-Sugiharto-lama.pdf` — PDF portfolio desain lama
- `tools/build-portfolio-pdf-lama.mjs` — script PDF desain lama (butuh Node.js + Playwright)
- tag git `v1-desain-lama` — kondisi repo terakhir sebelum desain baru
