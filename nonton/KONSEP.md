# Catatan Nonton — Konsep (Fase 0)

Web pribadi untuk mencatat film/series yang sudah selesai, mengawal yang sedang
ditonton sampai tamat, dan mendapat rekomendasi dari selera sendiri.
Nama masih sementara. Alamat rencana: `rizkysugiharto-eng.github.io/nonton/`.

## Alur

Rekomendasi → Watchlist → Lagi Ditonton → Arsip (nilai + catatan + tag alur)
→ profil selera → kembali ke Rekomendasi.

Status satu judul: `watchlist` | `ditonton` | `selesai` | `berhenti`.

## Fitur

1. **Arsip** — daftar yang sudah tamat; filter genre, tahun rilis, tahun ditonton,
   jenis; urut nilai/terbaru/A–Z; nilai 1–10 (boleh ,5), catatan, tag alur;
   statistik (total jam, genre favorit); impor CSV Letterboxd/IMDb.
2. **Lagi Ditonton** — series: season/episode dari total, tombol +1 Episode;
   film: menit terakhir dari durasi, sisa waktu; milestone 25/50/75%; 100% →
   minta nilai lalu pindah ke Arsip; penanda 14 hari tanpa update.
3. **Rekomendasi** — profil selera dari selisih nilai terhadap rata-rata nilai
   sendiri (genre, tag alur, sutradara, era); kandidat dari TMDB
   (recommendations/similar/discover); tampilkan alasan; Masuk Watchlist /
   Gak Tertarik; mode Melebar (genre jarang, alur mirip).

   `skor = 0,45 × kecocokan alur + 0,35 × kecocokan genre + 0,20 × rating publik`

## Teknis

- Statis (HTML/CSS/JS) di folder `/nonton/` repo ini, GitHub Pages. Portfolio tidak disentuh.
- Data: `nonton/data/tontonan.json`. Mode Edit menyimpan lewat GitHub API dengan
  token fine-grained pribadi yang hanya disimpan di browser pemilik.
- Metadata film: TMDB (butuh API key gratis, mulai Fase 3).
- "Live": platform streaming tidak punya API progres publik. Opsi: Trakt.tv +
  extension scrobbler browser + GitHub Action terjadwal (opsional, Fase 5).

## Desain

Palet: `#F3F4F6` (kertas), `#1D2846` (tinta navy), `#949492` (abu batu).
Judul huruf kuas tulisan tangan, ilustrasi garis tinta (layar tancap di
pegunungan), nav tengah dengan garis bawah aktif, tombol pill.

## Tahapan

0. Konsep (sekarang) — tunggu dicek
1. Kerangka + Arsip + data awal
2. Lagi Ditonton + Mode Edit
3. Tambah judul otomatis (TMDB) + impor CSV
4. Rekomendasi + Watchlist
5. Sinkron Trakt (opsional)
6. Evaluasi (review kode, performa, keamanan token, aksesibilitas, go/no-go) → merge ke `main`

## Keputusan (9 Nov 2026)

- Skala nilai 1–10, boleh setengah (8,5)
- Publik: noindex, tidak di-link dari portfolio
- Poster asli dari TMDB (atribusi TMDB di footer); simpan `tmdbId`, `poster`
  (path), `ratingPublik` di JSON supaya pengunjung tidak memanggil API
- Rentang tahun: semua era, tanpa batas
- Bahasa: Indonesia santai, campur English kalau lebih natural
  (Watchlist, Rating, Season, Mode Edit)
- Data awal: metadata dari TMDB; daftar judul yang sudah ditonton + nilai dari pemilik
- API key TMDB dan token GitHub hanya disimpan di browser pemilik (Mode Edit)

## Kandidat nama

Layar Tancap (saran utama), Tamat., Kan., Sisa Durasi, Kursi Depan.
Logo stempel 観 tetap.
