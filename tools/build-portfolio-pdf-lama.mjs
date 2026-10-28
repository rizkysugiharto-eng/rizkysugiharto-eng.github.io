// ARSIP: membuat assets/Portfolio-Rizky-Bagus-Eka-Sugiharto-lama.pdf dari portfolio-lama.html (desain lama).
// PDF desain baru dibuat dengan tools/build_portfolio_pdf.py.
// Setiap halaman A4 berisi satu bagian portfolio; isi yang terlalu panjang
// diperkecil otomatis supaya pas satu halaman (tidak terpotong).
//
// Cara pakai (butuh Node.js + Playwright):
//   npx playwright install chromium   (sekali saja)
//   python3 -m http.server 8000       (di folder repo, terminal lain)
//   node tools/build-portfolio-pdf.mjs http://localhost:8000/
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:8000/portfolio-lama.html';
const out = process.argv[3] ?? 'assets/Portfolio-Rizky-Bagus-Eka-Sugiharto-lama.pdf';
const SITE = 'https://rizkysugiharto-eng.github.io/';

// Susunan halaman: [section, filter isi]. Filter menerima clone section dan menghapus yang tidak dipakai.
const PAGES = [
  { name: 'cover', parts: ['header.hero', '.stats', '#about'] },
  { name: 'pengalaman-1', parts: ['#experience'], keepJobs: [0] },
  { name: 'pengalaman-2', parts: ['#experience'], keepJobs: [1], noHead: true },
  { name: 'project-01a', parts: ['#projects'], keepProjects: [0], dashFigs: [0, 1] },
  { name: 'project-01b', parts: ['#projects'], keepProjects: [0], dashFigs: [2, 3, 4], noHead: true, continued: true },
  { name: 'project-02', parts: ['#projects'], keepProjects: [1], noHead: true },
  { name: 'project-03-04', parts: ['#projects'], keepProjects: [2, 3], noHead: true },
  { name: 'project-05', parts: ['#projects'], keepProjects: [4], noHead: true },
  { name: 'keahlian', parts: ['#skills'] },
  { name: 'prestasi', parts: ['#achievements'] },
  { name: 'pendidikan-kontak', parts: ['#education', '#contact', 'body > footer'] },
];

const PDF_CSS = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0; background: #fff; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
  .nav, .to-top, .lightbox, .btns, .show-more, .tabs, .dash, .screen-only, .print-only.small { display: none !important; }
  .collapsible > * { display: block !important; }
  .dash-print { display: grid; gap: 14px; }
  .dash-print img, .live-print { width: 100%; border-radius: 10px; border: 1px solid var(--line); display: block; }
  .live-print { display: block !important; margin-bottom: 8px; }
  .live-links { display: flex !important; }
  .dash-print figure { margin: 0; }
  .dash-print figcaption { margin-top: 8px; padding: 10px 14px; border-left: 4px solid var(--accent); background: var(--bg); border-radius: 8px; font-size: var(--fs-sm); }
  .dash-print.split { grid-template-columns: 1fr 1fr; }
  .dash-print.split figure:first-child { grid-column: 1 / -1; }
  .gallery img:hover { transform: none; box-shadow: none; }
  section { padding: 48px 0; }
  .pdf-page { width: 794px; height: 1123px; overflow: hidden; position: relative; break-after: page; }
  .pdf-page:last-child { break-after: auto; }
  .pdf-inner { display: flex; flex-direction: column; }
  .pdf-inner > :last-child { flex: 1 0 auto; }
  .pdf-foot { position: absolute; left: 0; right: 0; bottom: 0; height: 30px; display: flex; justify-content: space-between; align-items: center;
              padding: 0 34px; font: 500 9px/1 Inter, sans-serif; color: #7b8190; letter-spacing: .3px; }
  .pdf-foot b { color: #875c00; font-weight: 600; }
  /* Pengalaman PLN sendirian di satu halaman: teks di atas, foto lebar di bawah */
  .pdf-page.pengalaman-2 .job { grid-template-columns: 1fr; gap: 24px; }
  .pdf-page.pengalaman-2 .job .gallery { width: 72%; margin: 0 auto; }
  /* Kartu "Download Portfolio" tidak perlu ada di dalam PDF portfolio itu sendiri */
  .contact-card[href*="Portfolio-"] { display: none; }
  .contact-grid { grid-template-columns: 1.5fr repeat(3, 1fr); }
  .continued { font-size: var(--fs-sm); color: var(--muted); font-weight: 500; }
`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
// Iframe pratinjau live tidak dicetak; jangan tunggu ia dimuat
await page.route(/fleet-maintenance-dashboard\/$/, (r) => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
await page.goto(url, { waitUntil: 'networkidle' });

const report = await page.evaluate(async ({ PAGES, PDF_CSS, SITE }) => {
  const W = 794, H = 1123, FOOT = 30, BASE_W = 1100, MIN_W = 900, MAX_W = 1500;

  // Hapus aturan responsif & cetak bawaan: lebar kertas (794 px) akan memicu layout HP
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (let i = rules.length - 1; i >= 0; i--) {
      const r = rules[i];
      if (r instanceof CSSMediaRule && /max-width|print/.test(r.conditionText)) sheet.deleteRule(i);
    }
  }
  document.head.insertAdjacentHTML('beforeend', `<style>${PDF_CSS}</style>`);

  const root = document.createElement('main');
  root.id = 'pdf';
  const pages = PAGES.map((spec, n) => {
    const pg = document.createElement('div');
    pg.className = 'pdf-page ' + spec.name;
    const inner = document.createElement('div');
    inner.className = 'pdf-inner';
    for (const sel of spec.parts) {
      const el = document.querySelector(sel).cloneNode(true);
      if (spec.noHead) el.querySelector('.sec-head')?.remove();
      if (spec.keepJobs) [...el.querySelectorAll('.job')].forEach((j, i) => spec.keepJobs.includes(i) || j.remove());
      if (spec.keepProjects) [...el.querySelectorAll('.project')].forEach((p, i) => spec.keepProjects.includes(i) || p.remove());
      if (spec.dashFigs) {
        const dp = el.querySelector('.dash-print');
        [...dp.children].forEach((f, i) => spec.dashFigs.includes(i) || f.remove());
        if (spec.continued) {
          dp.classList.add('split');
          const proj = el.querySelector('.project');
          proj.querySelectorAll(':scope > p:not(.more-link), :scope > .tags').forEach((x) => x.remove());
          proj.querySelector('h3').insertAdjacentHTML('beforeend', ' <span class="continued">(lanjutan)</span>');
        } else {
          el.querySelector('.project > .more-link')?.remove();
        }
      }
      inner.append(el);
    }
    pg.append(inner);
    pg.dataset.name = spec.name;
    pg.dataset.n = n + 1;
    return pg;
  });
  document.body.replaceChildren(root);
  root.append(...pages);
  // Link di PDF harus menunjuk ke website asli, bukan ke server lokal
  root.querySelectorAll('a[href]').forEach((a) => (a.href = new URL(a.getAttribute('href'), SITE).href));

  document.querySelectorAll('img').forEach((img) => (img.loading = 'eager'));
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.complete || new Promise((r) => (img.onload = img.onerror = r))));

  // Pas-kan setiap halaman: lebar desain 1100 px; bila terlalu tinggi, perlebar (huruf mengecil) sampai muat,
  // bila terlalu sedikit, persempit (huruf membesar) supaya halaman terisi
  const out = [];
  for (const pg of pages) {
    const inner = pg.firstChild;
    const last = +pg.dataset.n === pages.length;
    const avail = (pg.dataset.name === 'cover' || last) ? H : H - FOOT;
    pg.style.height = 'auto';
    let w = BASE_W, h;
    const measure = (width) => { inner.style.width = width + 'px'; inner.style.zoom = 1; return inner.scrollHeight; };
    for (w = BASE_W; w <= MAX_W; w += 20) { h = measure(w); if (h * (W / w) <= avail) break; }
    // Isi sedikit: persempit lebar desain (huruf & gambar membesar) selama masih muat
    if (w === BASE_W) {
      while (w - 20 >= MIN_W) { const h2 = measure(w - 20); if (h2 * (W / (w - 20)) > avail) break; w -= 20; h = h2; }
      measure(w);
    }
    let zoom = W / Math.min(w, MAX_W);
    if (w > MAX_W) { w = MAX_W; h = measure(w); zoom = Math.min(W / w, avail / h); }
    inner.style.width = w + 'px';
    inner.style.zoom = zoom;
    inner.style.minHeight = (avail / zoom) + 'px';
    inner.style.margin = '0 auto';
    pg.style.height = H + 'px';
    if (!(pg.dataset.name === 'cover' || last)) {
      pg.insertAdjacentHTML('beforeend', `<div class="pdf-foot"><span><b>Rizky Bagus Eka Sugiharto</b> · Portfolio</span><span>rizkysugiharto-eng.github.io</span><span>${pg.dataset.n} / ${pages.length}</span></div>`);
      // Latar footer mengikuti latar section terakhir di halaman
      pg.querySelector('.pdf-foot').style.background = getComputedStyle(inner.lastElementChild).backgroundColor;
    }
    out.push(`${pg.dataset.name}: width ${w}px, zoom ${zoom.toFixed(3)}, fill ${Math.round((h * zoom / avail) * 100)}%`);
  }

  // Perkecil foto ke ukuran tampil (±240 dpi) dan simpan sebagai JPEG supaya file PDF tidak puluhan MB
  const DPR = 2.5;
  for (const img of document.images) {
    const r = img.getBoundingClientRect();
    if (!r.width || !img.naturalWidth) continue;
    const scale = Math.min(1, Math.max((r.width * DPR) / img.naturalWidth, (r.height * DPR) / img.naturalHeight));
    const cw = Math.round(img.naturalWidth * scale), ch = Math.round(img.naturalHeight * scale);
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, cw, ch);
    const data = ctx.getImageData(0, 0, cw, ch).data;
    let transparent = false;
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] < 250) { transparent = true; break; }
    const src = transparent ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.82);
    await new Promise((res) => { img.onload = img.onerror = res; img.srcset = ''; img.src = src; });
  }
  return out;
}, { PAGES, PDF_CSS, SITE });

console.log(report.join('\n'));
await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log('PDF:', out);
