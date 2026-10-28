"""Membuat assets/Portfolio-Rizky-Bagus-Eka-Sugiharto.pdf dari index.html (desain baru).

Memakai tampilan cetak (@media print) di index.html, dicetak oleh Microsoft Edge headless,
lalu gambar di dalam PDF dikompres dan link lokal diganti ke alamat website live.

Cara pakai (Windows, butuh Python + PyMuPDF: `pip install pymupdf`):
    python -m http.server 8000              # terminal 1, di folder repo
    python tools/build_portfolio_pdf.py     # terminal 2

Setelah itu naikkan angka ?v= pada link Portfolio-Rizky-Bagus-Eka-Sugiharto.pdf di index.html.
"""
import os
import subprocess
import sys
import tempfile

import pymupdf

LOCAL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/"
LIVE = "https://rizkysugiharto-eng.github.io/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "assets/Portfolio-Rizky-Bagus-Eka-Sugiharto.pdf"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

with tempfile.TemporaryDirectory() as tmp:
    raw = os.path.join(tmp, "raw.pdf")
    # Jendela sangat tinggi supaya semua gambar lazy-load ikut termuat sebelum dicetak
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", f"--user-data-dir={tmp}\\profile",
                    "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw",
                    "--virtual-time-budget=20000", "--window-size=1280,40000",
                    f"--print-to-pdf={raw}", LOCAL], check=True, capture_output=True)

    doc = pymupdf.open(raw)
    # Link relatif ikut tercetak sebagai alamat server lokal: ganti ke website live
    fixed = 0
    for page in doc:
        for link in page.get_links():
            uri = link.get("uri", "")
            if uri.startswith(LOCAL):
                link["uri"] = LIVE + uri[len(LOCAL):]
                page.update_link(link)
                fixed += 1
    # Gambar hasil cetak browser tidak terkompres (bisa >50 MB): kompres ulang ke JPEG
    doc.rewrite_images(dpi_threshold=160, dpi_target=150, quality=80, lossy=True, lossless=True,
                       bitonal=False, color=True, gray=True, set_to_gray=False)
    doc.save(OUT, garbage=4, deflate=True, clean=True)
    pages = doc.page_count
    doc.close()  # Windows: file harus ditutup sebelum folder sementara dihapus

print(f"{OUT}: {pages} halaman, {os.path.getsize(OUT) / 1e6:.1f} MB, {fixed} link diarahkan ke {LIVE}")
