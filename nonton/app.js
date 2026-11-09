/* Layar Tancap — catatan nonton pribadi.
   Data utama: data/tontonan.json. Perubahan disimpan dulu di browser,
   lalu bisa dikirim ke repo lewat GitHub API (Mode Edit). */
'use strict';

const CFG = {
  owner: 'rizkysugiharto-eng',
  repo: 'rizkysugiharto-eng.github.io',
  path: 'nonton/data/tontonan.json',
  branch: 'main',
};
const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/';
const WIKI_API = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

const GENRES = ['Aksi', 'Animasi', 'Dokumenter', 'Drama', 'Fantasi', 'Horor', 'Keluarga', 'Komedi', 'Kriminal',
  'Misteri', 'Musik', 'Perang', 'Petualangan', 'Romansa', 'Sejarah', 'Sci-Fi', 'Thriller', 'Western'];
const GENRE_TMDB = {
  28: ['Aksi'], 12: ['Petualangan'], 16: ['Animasi'], 35: ['Komedi'], 80: ['Kriminal'], 99: ['Dokumenter'],
  18: ['Drama'], 10751: ['Keluarga'], 14: ['Fantasi'], 36: ['Sejarah'], 27: ['Horor'], 10402: ['Musik'],
  9648: ['Misteri'], 10749: ['Romansa'], 878: ['Sci-Fi'], 53: ['Thriller'], 10752: ['Perang'], 37: ['Western'],
  10759: ['Aksi', 'Petualangan'], 10762: ['Keluarga'], 10765: ['Sci-Fi', 'Fantasi'], 10768: ['Perang'],
};
const STATUS_LABEL = { watchlist: 'Watchlist', ditonton: 'Lagi ditonton', selesai: 'Tamat', berhenti: 'Berhenti' };
const STALE_DAYS = 14;

/* ---------- penyimpanan browser (aman kalau diblokir) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage penuh/diblokir */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* abaikan */ } },
};
const K = { data: 'lt:data', dirty: 'lt:dirty', edit: 'lt:edit', gh: 'lt:gh', tmdb: 'lt:tmdb', wiki: 'lt:wiki' };

const S = {
  data: null,
  kandidat: [],
  edit: store.get(K.edit, false),
  dirty: store.get(K.dirty, false),
  melebar: false,
  lagiTab: 'ditonton',
  editingId: null,
  filter: { q: '', jenis: 'semua', genre: '', era: '', koleksi: '', tahunNonton: '', status: 'selesai', urut: 'nilai' },
  pilih: null,
  cari: '',
  pilihConfirm: false,
  visibleIds: [],
};

/* ---------- util ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const uid = () => 'j-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const angka = (n) => String(n).replace('.', ',');
function today() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function daysSince(iso) { if (!iso) return 0; return Math.floor((new Date(today()) - new Date(iso)) / 86400000); }
function fmtDur(min) {
  min = Math.max(0, Math.round(min || 0));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} j${m ? ` ${m} m` : ''}` : `${m} m`;
}
function fmtTanggal(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function bulanTahun(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
}
function relHari(iso) {
  const d = daysSince(iso);
  if (d <= 0) return 'hari ini';
  if (d === 1) return 'kemarin';
  if (d < 30) return `${d} hari lalu`;
  return fmtTanggal(iso);
}
function parseList(s) { return String(s || '').split(',').map((x) => x.trim()).filter(Boolean); }
function uniq(arr) { return [...new Set(arr)]; }

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

/* ---------- data ---------- */
const items = () => S.data.judul;
const byStatus = (st) => items().filter((i) => i.status === st);
const findItem = (id) => items().find((i) => i.id === id);

function keyOf(x) { return x.tmdbId ? `${x.jenis}-${x.tmdbId}` : `${norm(x.judul)}|${x.tahun || ''}`; }

function save(msg) {
  S.data.diperbarui = new Date().toISOString();
  S.dirty = true;
  store.set(K.data, S.data);
  store.set(K.dirty, true);
  render();
  if (msg) toast(msg);
}

async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function init() {
  let remote = null;
  try { remote = await loadJSON('data/tontonan.json'); } catch (e) { console.warn('Gagal memuat data', e); }
  try { S.kandidat = (await loadJSON('data/kandidat.json')).kandidat || []; } catch (e) { console.warn('Gagal memuat kandidat', e); }

  const local = store.get(K.data, null);
  const contohLama = local && remote && local.judul?.some((i) => i.contoh) && !remote.judul?.some((i) => i.contoh);
  const localNewer = local && !contohLama && (!remote || S.dirty || (local.diperbarui || '') >= (remote.diperbarui || ''));
  S.data = localNewer ? local : (remote || { versi: 1, judul: [], ditolak: [], kandidatTmdb: [] });
  S.data.judul ||= [];
  S.data.ditolak ||= [];
  S.data.kandidatTmdb ||= [];
  if (!localNewer) { S.dirty = false; store.set(K.dirty, false); }

  bindGlobal();
  window.addEventListener('hashchange', () => render(true));
  render(true);
}

/* ---------- poster ---------- */
function posterSrc(it, size = 'w342') {
  if (!it.poster) return null;
  return it.poster.startsWith('/') ? TMDB_IMG + size + it.poster : it.poster;
}
function posterHTML(it, extra = '') {
  const src = posterSrc(it);
  const initial = (it.judul || '?').replace(/^(the|a|an)\s+/i, '').charAt(0).toUpperCase();
  const img = src
    ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`
    : `<img data-wiki-id="${esc(it.id)}" alt="" hidden>`;
  return `<div class="poster">${extra}<div class="ph" aria-hidden="true"><b>${esc(initial)}</b><span>${esc(it.judul)}</span></div>${img}</div>`;
}

const wikiCache = store.get(K.wiki, {});
let wikiDown = false;
const wikiQueue = [];
let wikiActive = 0;

function wikiTitles(it) {
  if (it.wiki) return [it.wiki];
  const t = it.judul;
  if (it.jenis === 'series') return [`${t} (TV series)`, t];
  return it.tahun ? [`${t} (${it.tahun} film)`, `${t} (film)`, t] : [`${t} (film)`, t];
}
async function wikiLookup(it) {
  const ck = it.wiki || `${it.judul}|${it.tahun || ''}|${it.jenis}`;
  if (ck in wikiCache) return wikiCache[ck];
  for (const title of wikiTitles(it)) {
    const r = await fetch(WIKI_API + encodeURIComponent(title.replace(/ /g, '_')));
    if (r.status === 404) continue;
    if (!r.ok) throw new Error('wiki ' + r.status);
    const j = await r.json();
    if (j.type === 'disambiguation') continue;
    const src = j.thumbnail?.source || j.originalimage?.source;
    if (src) { wikiCache[ck] = src; store.set(K.wiki, wikiCache); return src; }
  }
  wikiCache[ck] = '';
  store.set(K.wiki, wikiCache);
  return '';
}
function pumpWiki() {
  while (wikiActive < 4 && wikiQueue.length && !wikiDown) {
    const { img, it } = wikiQueue.shift();
    wikiActive++;
    wikiLookup(it)
      .then((src) => { if (src && img.isConnected) { img.src = src; img.hidden = false; } })
      .catch(() => { wikiDown = true; })
      .finally(() => { wikiActive--; pumpWiki(); });
  }
}
function hydratePosters(root = document) {
  if (wikiDown) return;
  for (const img of $$('img[data-wiki-id]', root)) {
    const it = findItem(img.dataset.wikiId) || allKandidat().find((k) => k.id === img.dataset.wikiId);
    img.removeAttribute('data-wiki-id');
    if (it) wikiQueue.push({ img, it });
  }
  pumpWiki();
}
document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG' && e.target.closest('.poster')) e.target.remove(); }, true);

/* ---------- progres ---------- */
function progresOf(it) {
  const p = it.progres || {};
  if (it.jenis === 'film') {
    const tot = it.durasi || 0, done = clamp(p.menit || 0, 0, tot || Infinity);
    return { pct: tot ? done / tot : 0, done, tot, sisa: tot ? tot - done : null };
  }
  const tot = it.totalEpisode || 0, done = clamp(p.episode || 0, 0, tot || Infinity);
  return { pct: tot ? done / tot : 0, done, tot, sisa: tot ? (tot - done) * (it.durasiEpisode || 0) : null, sisaEps: tot ? tot - done : null };
}
function seasonEp(it, n) {
  const per = it.episodePerSeason;
  if (!per || !per.length || !n) return '';
  let left = n;
  for (let s = 0; s < per.length; s++) {
    if (left <= per[s]) return `S${s + 1} E${left}`;
    left -= per[s];
  }
  return '';
}
function jamTotal(list) {
  return list.reduce((a, i) => a + (i.jenis === 'film' ? (i.durasi || 0) : (i.totalEpisode || 0) * (i.durasiEpisode || 0)), 0) / 60;
}
function barHTML(pct) {
  const w = Math.round(pct * 1000) / 10;
  return `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}"><span style="width:${w}%"></span><i style="left:25%"></i><i style="left:50%"></i><i style="left:75%"></i></div>`;
}

/* ---------- profil selera & rekomendasi ---------- */
function allKandidat() {
  const seen = new Set();
  return [...(S.data?.kandidatTmdb || []), ...S.kandidat].filter((k) => {
    const n = norm(k.judul) + '|' + (k.tahun || '');
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}
function profil() {
  const rated = items().filter((i) => i.status === 'selesai' && typeof i.nilai === 'number');
  if (rated.length < 3) return null;
  const avg = rated.reduce((a, i) => a + i.nilai, 0) / rated.length;
  const g = {}, t = {}, d = {}, gCount = {};
  for (const i of rated) {
    const w = i.nilai - avg;
    (i.genre || []).forEach((x) => { g[x] = (g[x] || 0) + w; gCount[x] = (gCount[x] || 0) + 1; });
    (i.tagAlur || []).forEach((x) => { t[x] = (t[x] || 0) + w; });
    if (i.sutradara) d[i.sutradara] = (d[i.sutradara] || 0) + w;
  }
  for (const r of S.data.ditolak) {
    (r.tagAlur || []).forEach((x) => { t[x] = (t[x] || 0) - 0.5; });
    (r.genre || []).forEach((x) => { g[x] = (g[x] || 0) - 0.25; });
  }
  return { avg, g, t, d, gCount, rated };
}
const maxAbs = (m) => Math.max(1e-9, ...Object.values(m).map(Math.abs));

function skor(c, p) {
  const mg = maxAbs(p.g), mt = maxAbs(p.t);
  const gSum = (c.genre || []).reduce((a, x) => a + (p.g[x] || 0), 0);
  const tSum = (c.tagAlur || []).reduce((a, x) => a + (p.t[x] || 0), 0);
  const gs = clamp(gSum / (mg * 1.5), -1, 1);
  let ts = (c.tagAlur || []).length ? clamp(tSum / (mt * 1.5), -1, 1) : 0;
  if (c.sutradara && (p.d[c.sutradara] || 0) > 0) ts = clamp(ts + 0.25, -1, 1);
  const pub = c.ratingPublik ? clamp((c.ratingPublik - 5) / 4, 0, 1) : 0.6;
  return { total: Math.round(100 * (0.45 * (ts + 1) / 2 + 0.35 * (gs + 1) / 2 + 0.2 * pub)), ts, gs };
}
function alasan(c, p) {
  let best = null, bs = 0;
  for (const i of p.rated) {
    if (i.nilai <= p.avg) continue;
    const sharedT = (i.tagAlur || []).filter((x) => (c.tagAlur || []).includes(x));
    const sharedG = (i.genre || []).filter((x) => (c.genre || []).includes(x));
    const sameD = !!(i.sutradara && i.sutradara === c.sutradara);
    const s = sharedT.length * 2 + sharedG.length + (sameD ? 3 : 0) + (i.nilai - p.avg) * 0.5;
    if ((sharedT.length || sharedG.length || sameD) && s > bs) { bs = s; best = { i, sharedT, sharedG, sameD }; }
  }
  if (!best) return 'Cocok sama genre yang sering lu kasih nilai tinggi.';
  const { i, sharedT, sharedG, sameD } = best;
  let txt = `Karena lu kasih ${angka(i.nilai)} ke <i>${esc(i.judul)}</i>`;
  if (sameD) txt += ` (sutradaranya sama, ${esc(c.sutradara)})`;
  if (sharedT.length) txt += `, sama-sama “${sharedT.slice(0, 2).map(esc).join('” & “')}”`;
  else if (sharedG.length && !sameD) txt += `, sama-sama ${sharedG.slice(0, 2).map(esc).join(' & ')}`;
  return txt + '.';
}
function rekomendasi(limit = 12) {
  const p = profil();
  if (!p) return { p: null, list: [] };
  const taken = new Set([...items().map(keyOf), ...items().map((i) => norm(i.judul)), ...S.data.ditolak.map((r) => r.id)]);
  let list = allKandidat()
    .filter((c) => !taken.has(keyOf(c)) && !taken.has(norm(c.judul)) && !taken.has(c.id))
    .map((c) => {
      const s = skor(c, p);
      const novel = (c.genre || []).some((x) => !p.gCount[x]);
      return { c, ...s, novel };
    });
  if (S.melebar) list = list.filter((x) => x.novel && x.ts > 0).sort((a, b) => b.ts - a.ts || b.total - a.total);
  else list.sort((a, b) => b.total - a.total);
  return { p, list: list.slice(0, limit) };
}

/* ---------- render ---------- */
const ROUTES = ['beranda', 'arsip', 'lagi', 'watchlist', 'rekomendasi', 'cari'];
function route() { const h = location.hash.replace('#', ''); return ROUTES.includes(h) ? h : 'beranda'; }

function render(navigated = false) {
  if (!S.data) return;
  const r = route();
  $$('[data-nav]').forEach((a) => { if (a.dataset.nav === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const btn = $('#btn-edit');
  btn.setAttribute('aria-pressed', String(S.edit));
  btn.textContent = S.edit ? (S.dirty ? 'Mode Edit •' : 'Mode Edit') : 'Mode Edit';
  btn.title = S.dirty ? 'Ada perubahan yang belum disimpan ke GitHub' : '';
  renderBanner();
  const view = { beranda: viewBeranda, arsip: viewArsip, lagi: viewLagi, watchlist: viewWatchlist, rekomendasi: viewRekomendasi, cari: viewCari }[r];
  const app = $('#app');
  const keepFocus = !navigated && document.activeElement && app.contains(document.activeElement) ? document.activeElement.id : null;
  app.innerHTML = view();
  const titles = { beranda: 'Layar Tancap', arsip: 'Arsip', lagi: 'Lagi Ditonton', watchlist: 'Watchlist', rekomendasi: 'Rekomendasi', cari: 'Cari' };
  document.title = r === 'beranda' ? 'Layar Tancap · Catatan Nonton Rizky' : `${titles[r]} · Layar Tancap`;
  if (keepFocus && document.getElementById(keepFocus)) {
    const el = document.getElementById(keepFocus);
    el.focus();
    if (el.setSelectionRange && el.type === 'search') el.setSelectionRange(el.value.length, el.value.length);
  } else if (navigated && location.hash) { window.scrollTo(0, 0); }
  if (navigated && r === 'cari') $('#cari-q')?.focus();
  hydratePosters(app);
}

function renderBanner() {
  const b = $('#banner');
  const contoh = items().some((i) => i.contoh);
  if (!contoh) { b.hidden = true; b.innerHTML = ''; return; }
  b.hidden = false;
  b.innerHTML = `<div><span><b>Lagi pakai data contoh.</b> Judul dan nilainya cuma buat ngetes tampilan. Ganti sama tontonan lu lewat Mode Edit.</span>
    <button class="pill sm" type="button" data-act="open-edit">Buka Mode Edit</button></div>`;
}

function hero() {
  return `<section class="hero">
    <div>
      <h1>Setiap Tontonan Layak Diselesaikan</h1>
      <p>Catatan pribadi Rizky: film dan series yang udah tamat, yang lagi dikejar, dan yang antre buat ditonton berikutnya.</p>
      <div class="actions"><a class="pill soft" href="#arsip">Lihat Arsip</a>${S.edit ? '<button class="pill" type="button" data-act="add">+ Tambah judul</button>' : ''}</div>
    </div>
    ${ILLUSTRATION}
  </section>`;
}

function statsHTML() {
  const sel = byStatus('selesai');
  const p = profil();
  let fav = '–';
  if (p) {
    const best = Object.entries(p.g).sort((a, b) => b[1] - a[1])[0];
    if (best) fav = best[0];
  } else if (sel.length) {
    const cnt = {};
    sel.forEach((i) => (i.genre || []).forEach((g) => { cnt[g] = (cnt[g] || 0) + 1; }));
    fav = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || '–';
  }
  return `<div class="stats">
    <div><b>${sel.length}</b><small>judul tamat</small></div>
    <div><b>${byStatus('ditonton').length}</b><small>lagi ditonton</small></div>
    <div><b>${Math.round(jamTotal(sel))} j</b><small>total jam nonton</small></div>
    <div><b>${esc(fav)}</b><small>genre paling lu suka</small></div>
  </div>`;
}

function rail(id, title, list, { more = '', render = (x) => tile(x), empty = '' } = {}) {
  if (!list.length && !empty) return '';
  return `<section class="sec" aria-labelledby="h-${id}">
    <div class="sec-head"><h2 id="h-${id}">${esc(title)}</h2>
      <div class="rail-nav">${more}${list.length > 2 ? `
        <button class="icon-btn sm" type="button" data-act="rail" data-target="r-${id}" data-dir="-1" aria-label="Geser ${esc(title)} ke kiri">‹</button>
        <button class="icon-btn sm" type="button" data-act="rail" data-target="r-${id}" data-dir="1" aria-label="Geser ${esc(title)} ke kanan">›</button>` : ''}</div></div>
    ${list.length ? `<div class="rail" id="r-${id}">${list.map(render).join('')}</div>` : empty}
  </section>`;
}

function tileRek(x) {
  const c = x.c;
  return `<a class="tile" href="#rekomendasi">
    ${posterHTML(c, `<span class="label">${c.jenis === 'series' ? 'Series' : 'Film'}</span><span class="badge match">${x.total}%</span><span class="hov" aria-hidden="true">Lihat alasannya</span>`)}
    <div><h3>${esc(c.judul)}</h3><p class="sub">${esc([c.tahun, (c.genre || [])[0]].filter(Boolean).join(' · '))}</p></div>
  </a>`;
}

function viewBeranda() {
  const lagi = byStatus('ditonton').sort((a, b) => (b.diupdate || '').localeCompare(a.diupdate || ''));
  const tamat = byStatus('selesai').slice().sort((a, b) => (b.selesai || '').localeCompare(a.selesai || '') || (b.diupdate || '').localeCompare(a.diupdate || '') || (b.tahun || 0) - (a.tahun || 0)).slice(0, 15);
  const koleksi = uniq(items().filter((i) => i.koleksi && i.status !== 'watchlist').map((i) => i.koleksi));
  const watch = byStatus('watchlist').sort((a, b) => (b.diupdate || '').localeCompare(a.diupdate || ''));
  const { p, list } = rekomendasi(12);
  const genreCount = {};
  items().forEach((i) => (i.genre || []).forEach((g) => { genreCount[g] = (genreCount[g] || 0) + 1; }));
  const genres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]);
  const kol = koleksi.map((k) => rail('k-' + norm(k).replace(/ /g, '-'), k,
    items().filter((i) => i.koleksi === k && i.status !== 'watchlist').sort((a, b) => (a.tahun || 0) - (b.tahun || 0) || (a.urutanKoleksi || 0) - (b.urutanKoleksi || 0)),
    { more: `<a class="more" href="#arsip" data-act="go-koleksi" data-v="${esc(k)}">Semua</a>` })).join('');
  return `${hero()}${statsHTML()}
  <section class="sec" aria-labelledby="h-lagi">
    <div class="sec-head"><h2 id="h-lagi">Lanjutin nonton</h2><a class="more" href="#lagi">Semua progres →</a></div>
    ${lagi.length ? `<div class="cards">${lagi.slice(0, 4).map(cardProgres).join('')}</div>` : emptyHTML('Belum ada yang lagi ditonton', 'Pindahin judul dari Watchlist, atau tambah judul baru dengan status “Lagi ditonton”.')}
  </section>
  ${genres.length ? `<section class="sec" aria-labelledby="h-genre"><div class="sec-head"><h2 id="h-genre">Jelajah genre</h2></div>
    <div class="genre-row">${genres.map(([g, n]) => `<a class="genre" href="#arsip" data-act="go-genre" data-v="${esc(g)}"><span>${esc(g)}</span><b>${n}</b></a>`).join('')}</div></section>` : ''}
  ${rail('tamat', 'Baru masuk Arsip', tamat, { more: '<a class="more" href="#arsip">Buka Arsip →</a>', empty: emptyHTML('Arsip masih kosong', 'Judul yang udah lu tamatin bakal muncul di sini lengkap dengan nilainya.') })}
  ${kol}
  ${rail('watch', 'Watchlist', watch, { more: '<a class="more" href="#watchlist">Semua →</a>' })}
  ${rail('rek', 'Rekomendasi buat lu', p ? list : [], { render: tileRek, more: '<a class="more" href="#rekomendasi">Semua →</a>', empty: emptyHTML('Rekomendasi belum siap', 'Kasih nilai minimal 3 judul yang udah tamat, nanti saran muncul di sini.') })}`;
}

function viewCari() {
  const q = norm(S.cari);
  const hits = q ? items().filter((i) => norm([i.judul, i.judulAsli, i.sutradara, i.koleksi, ...(i.genre || []), ...(i.tagAlur || [])].join(' ')).includes(q)) : [];
  const order = { ditonton: 0, watchlist: 1, selesai: 2, berhenti: 3 };
  hits.sort((a, b) => order[a.status] - order[b.status] || (a.tahun || 0) - (b.tahun || 0));
  const taken = new Set(items().map((i) => norm(i.judul)));
  const luar = q ? allKandidat().filter((c) => !taken.has(norm(c.judul)) && norm([c.judul, c.sutradara, ...(c.genre || []), ...(c.tagAlur || [])].join(' ')).includes(q)).slice(0, 12) : [];
  return `<div class="page-title"><h1>Cari</h1><p>Cari di semua catatan lu: yang tamat, lagi ditonton, watchlist, dan yang di-drop.</p></div>
  <section class="sec">
    <div class="field bigsearch"><label for="cari-q" class="sr">Kata kunci</label>
      <input id="cari-q" type="search" placeholder="Judul, sutradara, genre, koleksi…" value="${esc(S.cari)}" autocomplete="off"></div>
    ${!q ? '<p class="sub">Contoh: “marvel”, “horor”, “nolan”, “time travel”.</p>'
      : hits.length ? `<p class="summary"><span><b>${hits.length}</b> judul di catatan lu</span></p><div class="grid">${hits.map((x) => tile(x, { status: true })).join('')}</div>`
      : emptyHTML(`Gak ada “${S.cari}” di catatan lu`, S.edit ? 'Mau ditambahin? Klik tombol di bawah.' : 'Coba kata kunci lain.', S.edit ? `<button class="pill solid" type="button" data-act="add-from-search">+ Tambah “${esc(S.cari)}”</button>` : '')}
    ${luar.length ? `<div class="sec-head"><h2>Belum pernah lu tonton</h2></div><div class="grid">${luar.map((c) => tileRek({ c, total: (profil() ? skor(c, profil()).total : '–') })).join('')}</div>` : ''}
  </section>`;
}

function emptyHTML(title, text, action = '') {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}

function tile(it, opts = {}) {
  if (typeof opts !== 'object') opts = {};
  const badge = typeof it.nilai === 'number' ? `<span class="badge" aria-label="Nilai ${angka(it.nilai)} dari 10"><i aria-hidden="true">★</i>${angka(it.nilai)}</span>`
    : it.status === 'selesai' ? '<span class="badge muted">belum dinilai</span>' : '';
  const labelText = opts.status ? STATUS_LABEL[it.status] : it.status === 'berhenti' ? 'Drop' : (it.jenis === 'series' ? 'Series' : 'Film');
  const label = `<span class="label${opts.status || it.status === 'berhenti' ? ' strong' : ''}">${esc(labelText)}</span>`;
  const meta = [it.jenis === 'series' ? 'Series' : 'Film', it.tahun].filter(Boolean).join(' · ');
  const picking = S.edit && S.pilih && route() === 'arsip';
  const on = picking && S.pilih.has(it.id);
  const tick = picking ? `<span class="tick" aria-hidden="true">${on ? '✓' : ''}</span>` : '';
  const hov = picking ? '' : '<span class="hov" aria-hidden="true">Detail</span>';
  return `<button class="tile${on ? ' on' : ''}" type="button" data-act="${picking ? 'pilih' : 'detail'}" data-id="${esc(it.id)}"${picking ? ` aria-pressed="${on}"` : ''}>
    ${posterHTML(it, badge + (picking ? tick : label) + hov)}
    <div><h3>${esc(it.judul)}</h3><p class="sub">${esc(meta)}</p></div>
  </button>`;
}

function cardProgres(it) {
  const pr = progresOf(it);
  const pct = Math.round(pr.pct * 100);
  const stale = daysSince(it.diupdate) >= STALE_DAYS && it.status === 'ditonton';
  let left, right;
  if (it.jenis === 'film') {
    left = pr.tot ? `<b>${fmtDur(pr.done)}</b> dari ${fmtDur(pr.tot)}` : 'Durasi belum diisi';
    right = pr.sisa != null ? `sisa ${fmtDur(pr.sisa)}` : '';
  } else {
    const se = seasonEp(it, pr.done);
    left = pr.tot ? `<b>Episode ${pr.done}</b> dari ${pr.tot}${se ? ` · ${se}` : ''}` : `<b>Episode ${pr.done}</b>`;
    right = pr.sisaEps != null ? `sisa ${pr.sisaEps} eps${pr.sisa ? `, kira-kira ${fmtDur(pr.sisa)}` : ''}` : '';
  }
  let acts = '';
  if (S.edit && it.status === 'ditonton') {
    acts = it.jenis === 'series'
      ? `<div class="actions"><button class="pill sm solid" type="button" data-act="ep-plus" data-id="${esc(it.id)}">+1 Episode</button>
         <button class="pill sm" type="button" data-act="ep-minus" data-id="${esc(it.id)}" aria-label="Kurangi satu episode">−1</button>
         <button class="pill sm" type="button" data-act="finish" data-id="${esc(it.id)}">Tandai tamat</button>
         <button class="pill sm" type="button" data-act="drop" data-id="${esc(it.id)}">Berhenti</button></div>`
      : `<div class="inline-input"><label class="sub" for="m-${esc(it.id)}">Menit terakhir</label>
         <input id="m-${esc(it.id)}" type="number" inputmode="numeric" min="0" max="${pr.tot || ''}" value="${pr.done}">
         <button class="pill sm solid" type="button" data-act="set-menit" data-id="${esc(it.id)}">Update</button></div>
         <div class="actions"><button class="pill sm" type="button" data-act="finish" data-id="${esc(it.id)}">Tandai tamat</button>
         <button class="pill sm" type="button" data-act="drop" data-id="${esc(it.id)}">Berhenti</button></div>`;
  } else if (S.edit && it.status === 'berhenti') {
    acts = `<div class="actions"><button class="pill sm" type="button" data-act="resume" data-id="${esc(it.id)}">Lanjut nonton lagi</button></div>`;
  }
  return `<article class="card">
    <div class="card-head">
      ${posterHTML(it)}
      <div><h3><button type="button" data-act="detail" data-id="${esc(it.id)}">${esc(it.judul)}</button></h3>
        <p class="sub">${it.jenis === 'series' ? 'Series' : 'Film'}${it.tahun ? ' · ' + it.tahun : ''} · update ${esc(relHari(it.diupdate))}</p></div>
      <div class="score">${pct}%<small>${it.status === 'berhenti' ? 'berhenti' : 'selesai'}</small></div>
    </div>
    ${barHTML(pr.pct)}
    <div class="prog"><span>${left}</span><span>${right}</span></div>
    ${stale ? `<div class="chips"><span class="chip warn">Udah ${daysSince(it.diupdate)} hari gak dilanjut</span></div>` : ''}
    ${it.status === 'berhenti' && it.catatan ? `<p class="note">“${esc(it.catatan)}”</p>` : ''}
    ${acts}
  </article>`;
}

function cardRek(x) {
  const c = x.c;
  const p = profil();
  const meta = [c.jenis === 'series' ? 'Series' : 'Film', c.tahun, (c.genre || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ');
  const acts = S.edit
    ? `<div class="actions"><button class="pill sm solid" type="button" data-act="rek-add" data-id="${esc(c.id)}">Masuk Watchlist</button>
       <button class="pill sm" type="button" data-act="rek-no" data-id="${esc(c.id)}">Gak tertarik</button></div>`
    : '';
  return `<article class="card">
    <div class="card-head">
      ${posterHTML(c)}
      <div><h3>${esc(c.judul)}</h3><p class="sub">${esc(meta)}</p>
        ${x.novel ? '<div class="chips" style="margin-top:6px"><span class="chip plot">Melebar</span></div>' : ''}</div>
      <div class="score">${x.total}<small>cocok</small></div>
    </div>
    <p class="why">${alasan(c, p)}</p>
    <div class="chips">${(c.tagAlur || []).map((t) => `<span class="chip plot">${esc(t)}</span>`).join('')}</div>
    ${acts}
  </article>`;
}

/* --- Arsip --- */
function eraOf(y) { if (!y) return ''; if (y < 1960) return 'klasik'; return String(Math.floor(y / 10) * 10); }
function viewArsip() {
  const f = S.filter;
  const base = items().filter((i) => i.status === f.status);
  const genres = uniq(base.flatMap((i) => i.genre || [])).sort((a, b) => a.localeCompare(b, 'id'));
  const eras = uniq(base.map((i) => eraOf(i.tahun)).filter(Boolean)).sort((a, b) => (a === 'klasik' ? -1 : b === 'klasik' ? 1 : b - a));
  const years = uniq(base.map((i) => (i.selesai || '').slice(0, 4)).filter(Boolean)).sort().reverse();
  const koleksi = uniq(base.map((i) => i.koleksi).filter(Boolean)).sort((a, b) => a.localeCompare(b, 'id'));
  const q = norm(f.q);
  let list = base.filter((i) =>
    (f.jenis === 'semua' || i.jenis === f.jenis) &&
    (!f.genre || (i.genre || []).includes(f.genre)) &&
    (!f.era || eraOf(i.tahun) === f.era) &&
    (!f.koleksi || i.koleksi === f.koleksi) &&
    (!f.tahunNonton || (i.selesai || '').startsWith(f.tahunNonton)) &&
    (!q || norm([i.judul, i.sutradara, i.koleksi, ...(i.tagAlur || [])].join(' ')).includes(q)));
  const urutRilis = (a, b) => (a.tahun || 9999) - (b.tahun || 9999) || (a.urutanKoleksi || 0) - (b.urutanKoleksi || 0);
  const sorters = {
    nilai: (a, b) => (b.nilai ?? -1) - (a.nilai ?? -1) || urutRilis(a, b),
    terbaru: (a, b) => (b.selesai || '').localeCompare(a.selesai || '') || urutRilis(a, b),
    rilis: (a, b) => -urutRilis(a, b),
    rilisLama: urutRilis,
    az: (a, b) => a.judul.localeCompare(b.judul, 'id'),
  };
  list.sort(sorters[f.urut] || sorters.nilai);
  S.visibleIds = list.map((i) => i.id);
  const rated = list.filter((i) => typeof i.nilai === 'number');
  const avg = rated.length ? (rated.reduce((a, i) => a + i.nilai, 0) / rated.length).toFixed(1) : '–';
  const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  const eraLabel = (e) => (e === 'klasik' ? 'Klasik (sebelum 1960)' : `${e}-an`);
  const pilih = S.pilih;
  let tools;
  if (S.edit && pilih) {
    const n = pilih.size;
    tools = `<div class="selectbar" role="region" aria-label="Pilih beberapa judul">
      <span><b>${n}</b> dipilih</span>
      <button class="pill sm" type="button" data-act="pilih-semua">Pilih semua yang tampil (${list.length})</button>
      ${n ? '<button class="pill sm" type="button" data-act="pilih-kosong">Kosongkan</button>' : ''}
      <span class="grow"></span>
      <button class="pill sm solid" type="button" data-act="pilih-watchlist"${n ? '' : ' disabled'}>Pindah ke Watchlist</button>
      <button class="pill sm danger" type="button" data-act="pilih-tanya-hapus"${n ? '' : ' disabled'}>Hapus</button>
      <button class="pill sm" type="button" data-act="pilih-off">Selesai milih</button>
      ${S.pilihConfirm && n ? `<div class="confirm full"><p>Hapus ${n} judul dari catatan?</p><div class="actions">
        <button class="pill sm" type="button" data-act="pilih-batal-hapus">Gak jadi</button>
        <button class="pill sm danger solid" type="button" data-act="pilih-hapus">Ya, hapus ${n} judul</button></div></div>` : ''}
    </div>`;
  } else {
    tools = `<div class="toolbar">
      <div class="summary"><span><b>${list.length}</b> judul</span><span>rata-rata nilai <b>${angka(avg)}</b></span><span><b>${Math.round(jamTotal(list))}</b> jam</span></div>
      ${S.edit ? '<div class="actions"><button class="pill" type="button" data-act="pilih-on">Pilih beberapa</button><button class="pill solid" type="button" data-act="add">+ Tambah judul</button></div>' : ''}
    </div>`;
  }
  return `<div class="page-title"><h1>Arsip</h1><p>Semua yang udah lu tamatin, plus nilai pribadi lu. Tahunnya bebas, dari film jadul sampai rilisan terbaru.</p></div>
  <section class="sec">
    <div class="filters" role="search">
      <div class="tabs" role="group" aria-label="Status">
        <button class="pill sm" type="button" data-act="f-status" data-v="selesai" aria-pressed="${f.status === 'selesai'}">Tamat (${byStatus('selesai').length})</button>
        <button class="pill sm" type="button" data-act="f-status" data-v="berhenti" aria-pressed="${f.status === 'berhenti'}">Di-drop (${byStatus('berhenti').length})</button>
      </div>
      <div class="row">
        <div class="field search"><label for="f-q">Cari</label><input id="f-q" type="search" placeholder="Judul, sutradara, koleksi, atau tag alur" value="${esc(f.q)}"></div>
        <div class="field"><label for="f-jenis2">Jenis</label><select id="f-jenis2" data-filter="jenis">${opt('semua', 'Film & series', f.jenis)}${opt('film', 'Film', f.jenis)}${opt('series', 'Series', f.jenis)}</select></div>
        ${koleksi.length ? `<div class="field"><label for="f-kol">Koleksi</label><select id="f-kol" data-filter="koleksi">${opt('', 'Semua', f.koleksi || '')}${koleksi.map((k) => opt(k, k, f.koleksi || '')).join('')}</select></div>` : ''}
        <div class="field"><label for="f-era">Era rilis</label><select id="f-era" data-filter="era">${opt('', 'Semua era', f.era)}${eras.map((e) => opt(e, eraLabel(e), f.era)).join('')}</select></div>
        <div class="field"><label for="f-tn">Ditonton tahun</label><select id="f-tn" data-filter="tahunNonton">${opt('', 'Kapan aja', f.tahunNonton)}${years.map((y) => opt(y, y, f.tahunNonton)).join('')}</select></div>
        <div class="field"><label for="f-urut">Urutkan</label><select id="f-urut" data-filter="urut">${opt('nilai', 'Nilai tertinggi', f.urut)}${opt('terbaru', 'Terakhir ditonton', f.urut)}${opt('rilis', 'Rilis terbaru', f.urut)}${opt('rilisLama', 'Rilis terlama', f.urut)}${opt('az', 'Judul A–Z', f.urut)}</select></div>
      </div>
      <div class="chips" role="group" aria-label="Genre">
        <button class="pill sm" type="button" data-act="f-genre" data-v="" aria-pressed="${!f.genre}">Semua genre</button>
        ${genres.map((g) => `<button class="pill sm" type="button" data-act="f-genre" data-v="${esc(g)}" aria-pressed="${f.genre === g}">${esc(g)}</button>`).join('')}
      </div>
    </div>
    ${tools}
    ${list.length ? `<div class="grid${pilih && S.edit ? ' picking' : ''}">${list.map((x) => tile(x)).join('')}</div>` : emptyHTML('Gak ada yang cocok', 'Coba longgarin filternya, atau hapus kata kunci pencarian.')}
  </section>`;
}

/* --- Lagi ditonton --- */
function viewLagi() {
  const lagi = byStatus('ditonton').sort((a, b) => (b.diupdate || '').localeCompare(a.diupdate || ''));
  const drop = byStatus('berhenti');
  const list = S.lagiTab === 'berhenti' ? drop : lagi;
  const sisaTotal = lagi.reduce((a, i) => a + (progresOf(i).sisa || 0), 0);
  return `<div class="page-title"><h1>Lagi Ditonton</h1><p>Biar on track. Series dihitung per episode, film per menit. Pas 100%, judulnya pindah ke Arsip dan lu tinggal kasih nilai.</p></div>
  <section class="sec">
    <div class="toolbar">
      <div class="tabs" role="group" aria-label="Tampilkan">
        <button class="pill sm" type="button" data-act="lagi-tab" data-v="ditonton" aria-pressed="${S.lagiTab === 'ditonton'}">On going (${lagi.length})</button>
        <button class="pill sm" type="button" data-act="lagi-tab" data-v="berhenti" aria-pressed="${S.lagiTab === 'berhenti'}">Berhenti (${drop.length})</button>
      </div>
      <div class="summary">${S.lagiTab === 'ditonton' && lagi.length ? `<span>Total sisa tontonan <b>${fmtDur(sisaTotal)}</b></span>` : ''}
        ${S.edit ? '<button class="pill solid" type="button" data-act="add" data-status="ditonton">+ Mulai nonton judul baru</button>' : ''}</div>
    </div>
    ${list.length ? `<div class="cards">${list.map(cardProgres).join('')}</div>`
      : emptyHTML(S.lagiTab === 'berhenti' ? 'Gak ada yang di-drop' : 'Lagi gak nonton apa-apa', S.lagiTab === 'berhenti' ? 'Mantap, semua yang lu mulai lu lanjutin.' : 'Ambil satu dari Watchlist, atau tambah judul baru.')}
  </section>`;
}

/* --- Watchlist --- */
function viewWatchlist() {
  const list = byStatus('watchlist').sort((a, b) => (b.diupdate || '').localeCompare(a.diupdate || ''));
  const card = (it) => `<article class="card">
    <div class="card-head">${posterHTML(it)}
      <div><h3><button type="button" data-act="detail" data-id="${esc(it.id)}">${esc(it.judul)}</button></h3>
        <p class="sub">${it.jenis === 'series' ? 'Series' : 'Film'}${it.tahun ? ' · ' + it.tahun : ''}${it.jenis === 'film' && it.durasi ? ' · ' + fmtDur(it.durasi) : ''}${it.jenis === 'series' && it.totalEpisode ? ` · ${it.totalEpisode} eps` : ''}</p>
        <div class="chips" style="margin-top:6px">${(it.genre || []).map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div></div>
      <span></span></div>
    ${S.edit ? `<div class="actions"><button class="pill sm solid" type="button" data-act="start" data-id="${esc(it.id)}">Mulai nonton</button>
      <button class="pill sm" type="button" data-act="remove" data-id="${esc(it.id)}">Hapus dari Watchlist</button></div>` : ''}
  </article>`;
  return `<div class="page-title"><h1>Watchlist</h1><p>Antrean tontonan: hasil rekomendasi yang lu terima, plus judul yang lu tambah sendiri.</p></div>
  <section class="sec">
    <div class="toolbar"><div class="summary"><span><b>${list.length}</b> judul antre</span><span>kira-kira <b>${Math.round(jamTotal(list))}</b> jam</span></div>
      <div class="actions"><a class="pill" href="#rekomendasi">Cari dari rekomendasi</a>${S.edit ? '<button class="pill solid" type="button" data-act="add" data-status="watchlist">+ Tambah judul</button>' : ''}</div></div>
    ${list.length ? `<div class="cards">${list.map(card).join('')}</div>` : emptyHTML('Watchlist kosong', 'Buka Rekomendasi dan masukin judul yang menarik.')}
  </section>`;
}

/* --- Rekomendasi --- */
function viewRekomendasi() {
  const { p, list } = rekomendasi(12);
  const tmdbBtn = S.edit ? `<button class="pill" type="button" data-act="tmdb-rek">${store.get(K.tmdb, '') ? 'Cari kandidat baru dari TMDB' : 'Pasang API key TMDB buat kandidat baru'}</button>` : '';
  let top = '';
  if (p) {
    const tg = Object.entries(p.t).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    const gg = Object.entries(p.g).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
    top = `<div class="filters">
      <p class="sub">Profil selera dari <b>${p.rated.length}</b> judul yang udah lu nilai (rata-rata ${angka(p.avg.toFixed(1))}).</p>
      <div class="chips"><span class="sub">Genre:</span>${gg.map((g) => `<span class="chip">${esc(g)}</span>`).join('') || '<span class="sub">belum kebaca</span>'}</div>
      <div class="chips"><span class="sub">Alur:</span>${tg.map((g) => `<span class="chip plot">${esc(g)}</span>`).join('') || '<span class="sub">belum kebaca</span>'}</div>
    </div>`;
  }
  return `<div class="page-title"><h1>Rekomendasi</h1><p>Diambil dari genre dan alur cerita yang sering lu kasih nilai di atas rata-rata lu sendiri. Judul yang lu tolak gak bakal muncul lagi.</p></div>
  <section class="sec">
    ${top}
    <div class="toolbar">
      <div class="tabs" role="group" aria-label="Mode">
        <button class="pill sm" type="button" data-act="melebar" data-v="0" aria-pressed="${!S.melebar}">Paling cocok</button>
        <button class="pill sm" type="button" data-act="melebar" data-v="1" aria-pressed="${S.melebar}">Melebar</button>
      </div>
      ${tmdbBtn}
    </div>
    ${S.melebar ? '<p class="sub">Mode Melebar: genre yang belum pernah lu nilai, tapi alurnya mirip sama favorit lu.</p>' : ''}
    ${!p ? emptyHTML('Rekomendasi belum siap', 'Kasih nilai minimal 3 judul di Arsip dulu.')
      : list.length ? `<div class="cards">${list.map(cardRek).join('')}</div>` : emptyHTML('Kandidat habis', 'Semua kandidat udah lu tonton atau tolak. Tambah kandidat baru dari TMDB lewat Mode Edit.')}
    ${!S.edit && p ? '<p class="sub">Buka Mode Edit buat masukin saran ke Watchlist.</p>' : ''}
  </section>`;
}

/* ---------- detail ---------- */
function openDetail(id) {
  const it = findItem(id);
  if (!it) return;
  const pr = progresOf(it);
  const rows = [
    ['Status', STATUS_LABEL[it.status]],
    ['Jenis', it.jenis === 'series' ? 'Series' : 'Film'],
    it.tahun && ['Rilis', it.tahun],
    it.koleksi && ['Koleksi', it.koleksi],
    it.sutradara && [it.jenis === 'series' ? 'Kreator' : 'Sutradara', it.sutradara],
    it.jenis === 'film' && it.durasi && ['Durasi', fmtDur(it.durasi)],
    it.jenis === 'series' && it.totalEpisode && ['Episode', `${it.totalEpisode}${it.episodePerSeason ? ` (${it.episodePerSeason.length} season)` : ''}`],
    (it.status === 'ditonton' || it.status === 'berhenti') && ['Progres', `${Math.round(pr.pct * 100)}%`],
    it.mulai && ['Mulai', fmtTanggal(it.mulai)],
    it.selesai && ['Tamat', fmtTanggal(it.selesai)],
    it.ratingPublik && ['Rating publik', angka(it.ratingPublik)],
  ].filter(Boolean);
  $('#detail-body').innerHTML = `
    ${it.backdrop ? `<div class="detail-bd"><img src="${esc(TMDB_IMG + 'w780' + it.backdrop)}" alt="" loading="lazy"></div>` : ''}
    <div class="dlg-head"><span class="sub">${esc(it.koleksi || (it.contoh ? 'Data contoh' : ''))}</span><button type="button" class="x" data-close aria-label="Tutup">×</button></div>
    <div class="detail">
      ${posterHTML(it)}
      <div class="info">
        <h2 id="detail-title">${esc(it.judul)}</h2>
        ${it.judulAsli ? `<p class="sub">${esc(it.judulAsli)}</p>` : ''}
        ${typeof it.nilai === 'number' ? `<div class="big">${angka(it.nilai)}<small>dari 10</small></div>` : ''}
        <div class="chips">${(it.genre || []).map((g) => `<span class="chip">${esc(g)}</span>`).join('')}${(it.tagAlur || []).map((t) => `<span class="chip plot">${esc(t)}</span>`).join('')}</div>
        ${it.catatan ? `<p class="note">“${esc(it.catatan)}”</p>` : ''}
        <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        ${S.edit ? `<div class="actions">
          ${it.status === 'selesai' && typeof it.nilai !== 'number' ? `<button class="pill sm solid" type="button" data-act="rate" data-id="${esc(it.id)}">Kasih nilai</button>` : ''}
          <button class="pill sm${it.status === 'selesai' && typeof it.nilai !== 'number' ? '' : ' solid'}" type="button" data-act="edit" data-id="${esc(it.id)}">Ubah</button>
          ${it.status === 'watchlist' ? `<button class="pill sm" type="button" data-act="start" data-id="${esc(it.id)}">Mulai nonton</button>` : ''}
          <button class="pill sm danger" type="button" data-act="ask-del" data-id="${esc(it.id)}">Hapus</button>
        </div>
        <div class="confirm" id="del-confirm" hidden><p>Hapus <b>${esc(it.judul)}</b> dari catatan?</p>
          <div class="actions"><button class="pill sm" type="button" data-act="cancel-del">Gak jadi</button>
          <button class="pill sm danger solid" type="button" data-act="del" data-id="${esc(it.id)}">Ya, hapus</button></div></div>` : ''}
      </div>
    </div>`;
  openDlg('#dlg-detail');
  hydratePosters($('#detail-body'));
}

/* ---------- dialog helpers ---------- */
function openDlg(sel) {
  const d = $(sel);
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function closeDlg(d) { if (d.open) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); } }

/* ---------- form tambah/ubah ---------- */
function allTags() { return uniq([...items(), ...allKandidat()].flatMap((i) => i.tagAlur || [])).sort((a, b) => a.localeCompare(b, 'id')); }

function openForm(id = null, preset = {}) {
  S.editingId = id;
  const it = id ? findItem(id) : { jenis: 'film', status: preset.status || 'selesai', genre: [], tagAlur: [] };
  const f = $('#form-judul');
  f.reset();
  $('#form-title').textContent = id ? `Ubah: ${it.judul}` : 'Tambah judul';
  $('#form-err').textContent = '';
  $('#tmdb-hasil').innerHTML = '';
  $('#f-cari').value = '';
  const hasKey = !!store.get(K.tmdb, '');
  $('#tmdb-search').hidden = !!id;
  $('#f-cari').disabled = !hasKey;
  $('#btn-cari').disabled = !hasKey;
  $('#tmdb-hint').textContent = hasKey
    ? 'Pilih hasil pencarian biar poster, genre, durasi, dan jumlah episode keisi otomatis.'
    : 'Pasang API key TMDB di Mode Edit biar bisa cari judul dan poster otomatis. Sementara isi manual dulu.';
  fillForm(it);
  openDlg('#dlg-form');
  setTimeout(() => (hasKey && !id ? $('#f-cari') : $('#f-judul')).focus(), 50);
}

let formExtra = {};
function fillForm(it) {
  formExtra = { tmdbId: it.tmdbId, ratingPublik: it.ratingPublik, wiki: it.wiki, backdrop: it.backdrop };
  $('#f-judul').value = it.judul || '';
  $('#f-jenis').value = it.jenis || 'film';
  $('#f-tahun').value = it.tahun || '';
  $('#f-status').value = it.status || 'selesai';
  $('#f-sutradara').value = it.sutradara || '';
  $('#f-koleksi').value = it.koleksi || '';
  $('#dl-koleksi').innerHTML = uniq(items().map((i) => i.koleksi).filter(Boolean)).map((k) => `<option value="${esc(k)}">`).join('');
  $('#f-genre').innerHTML = uniq([...GENRES, ...(it.genre || [])]).map((g, n) =>
    `<label><input type="checkbox" id="g-${n}" value="${esc(g)}"${(it.genre || []).includes(g) ? ' checked' : ''}><span>${esc(g)}</span></label>`).join('');
  $('#f-tag').value = (it.tagAlur || []).join(', ');
  renderTagSugg();
  $('#f-durasi').value = it.durasi || '';
  $('#f-menit').value = it.progres?.menit ?? '';
  $('#f-total').value = it.totalEpisode || '';
  $('#f-durep').value = it.durasiEpisode || '';
  $('#f-eps').value = (it.episodePerSeason || []).join(', ');
  $('#f-epdone').value = it.progres?.episode ?? '';
  const hasNilai = typeof it.nilai === 'number';
  $('#f-nilai').value = hasNilai ? it.nilai : 8;
  $('#f-belum').checked = !hasNilai && !!S.editingId;
  $('#f-selesai').value = it.selesai || today();
  $('#f-poster').value = it.poster && !it.poster.startsWith('/') ? it.poster : '';
  formExtra.posterPath = it.poster && it.poster.startsWith('/') ? it.poster : '';
  $('#f-catatan').value = it.catatan || '';
  syncForm();
}
function renderTagSugg() {
  const cur = parseList($('#f-tag').value).map(norm);
  $('#f-tag-sugg').innerHTML = allTags().filter((t) => !cur.includes(norm(t))).slice(0, 24)
    .map((t) => `<button type="button" class="chip plot" data-tag="${esc(t)}">+ ${esc(t)}</button>`).join('');
}
function syncForm() {
  const jenis = $('#f-jenis').value, st = $('#f-status').value;
  $$('#form-judul .only-film').forEach((el) => { el.hidden = jenis !== 'film'; });
  $$('#form-judul .only-series').forEach((el) => { el.hidden = jenis !== 'series'; });
  $$('#form-judul .only-prog').forEach((el) => { if (!(st === 'ditonton' || st === 'berhenti')) el.hidden = true; });
  $$('#form-judul .only-rate').forEach((el) => { el.hidden = st !== 'selesai'; });
  const belum = $('#f-belum').checked;
  $('#f-nilai').disabled = belum;
  $('#f-nilai-out').textContent = belum ? '–' : angka($('#f-nilai').value);
}

function readForm() {
  const v = (id) => $(id).value.trim();
  const num = (id) => { const x = parseFloat($(id).value); return Number.isFinite(x) ? x : undefined; };
  const judul = v('#f-judul');
  if (!judul) return { err: 'Judulnya diisi dulu.' };
  const jenis = v('#f-jenis'), status = v('#f-status');
  const tahun = num('#f-tahun');
  if (tahun && (tahun < 1870 || tahun > 2100)) return { err: 'Tahun rilis kayaknya salah ketik.' };
  const posterUrl = v('#f-poster');
  if (posterUrl && !/^https:\/\//i.test(posterUrl)) return { err: 'Link poster harus diawali https://' };
  const out = {
    judul, jenis, status, tahun,
    sutradara: v('#f-sutradara') || undefined,
    koleksi: v('#f-koleksi') || undefined,
    genre: $$('#f-genre input:checked').map((x) => x.value),
    tagAlur: uniq(parseList(v('#f-tag')).map((t) => t.toLowerCase())),
    catatan: v('#f-catatan') || undefined,
    poster: posterUrl || formExtra.posterPath || undefined,
    tmdbId: formExtra.tmdbId, ratingPublik: formExtra.ratingPublik, backdrop: formExtra.backdrop,
    wiki: posterUrl || formExtra.posterPath ? undefined : formExtra.wiki,
  };
  if (jenis === 'film') {
    out.durasi = num('#f-durasi');
    if (status === 'ditonton' || status === 'berhenti') out.progres = { menit: clamp(num('#f-menit') || 0, 0, out.durasi || 100000) };
  } else {
    out.totalEpisode = num('#f-total');
    out.durasiEpisode = num('#f-durep');
    const per = parseList(v('#f-eps')).map(Number).filter((n) => n > 0);
    out.episodePerSeason = per.length ? per : undefined;
    if (per.length && !out.totalEpisode) out.totalEpisode = per.reduce((a, b) => a + b, 0);
    if (status === 'ditonton' || status === 'berhenti') out.progres = { episode: clamp(num('#f-epdone') || 0, 0, out.totalEpisode || 100000) };
  }
  if (status === 'selesai') {
    out.nilai = $('#f-belum').checked ? undefined : parseFloat($('#f-nilai').value);
    out.selesai = v('#f-selesai') || today();
  }
  return { out };
}

function submitForm(e) {
  e.preventDefault();
  const { err, out } = readForm();
  if (err) { $('#form-err').textContent = err; return; }
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined && x !== ''));
  if (S.editingId) {
    const it = findItem(S.editingId);
    const keep = { id: it.id, mulai: it.mulai };
    if (out.status !== 'selesai') { delete it.nilai; delete it.selesai; }
    if (out.status === 'watchlist') delete it.progres;
    for (const k of ['koleksi', 'durasi', 'totalEpisode', 'durasiEpisode', 'episodePerSeason', 'sutradara', 'catatan', 'poster', 'wiki', 'nilai', 'progres']) delete it[k];
    Object.assign(it, clean(out), { id: keep.id, diupdate: today() });
    if (keep.mulai) it.mulai = keep.mulai;
    delete it.contoh;
    if (out.status === 'ditonton' && !it.mulai) it.mulai = today();
  } else {
    const dup = items().find((i) => keyOf(i) === keyOf(out) || (norm(i.judul) === norm(out.judul) && (!out.tahun || !i.tahun || i.tahun === out.tahun)));
    if (dup) { $('#form-err').textContent = `“${dup.judul}” udah ada di catatan (${STATUS_LABEL[dup.status]}).`; return; }
    const it = { id: uid(), ...clean(out), diupdate: today() };
    if (it.status === 'ditonton') it.mulai = today();
    items().push(it);
  }
  closeDlg($('#dlg-form'));
  closeDlg($('#dlg-detail'));
  save(S.editingId ? 'Perubahan disimpan' : 'Judul ditambahkan');
}

/* ---------- aksi progres ---------- */
let pendingFinish = null;
function askFinish(id) {
  const it = findItem(id);
  if (!it) return;
  pendingFinish = id;
  const udahTamat = it.status === 'selesai';
  $('#nilai-title').textContent = udahTamat ? 'Kasih nilai' : 'Tamat! Kasih nilai';
  $('#form-nilai button[type=submit]').textContent = udahTamat ? 'Simpan nilai' : 'Pindah ke Arsip';
  $('#nilai-judul').textContent = `${it.judul}${it.tahun ? ` (${it.tahun})` : ''}`;
  $('#n-nilai').value = it.nilai ?? 8;
  $('#n-nilai-out').textContent = angka(it.nilai ?? 8);
  $('#n-tag').value = (it.tagAlur || []).join(', ');
  $('#n-catatan').value = it.catatan || '';
  openDlg('#dlg-nilai');
}
function submitNilai(e) {
  e.preventDefault();
  const it = findItem(pendingFinish);
  if (!it) return;
  const udahTamat = it.status === 'selesai';
  it.status = 'selesai';
  it.nilai = parseFloat($('#n-nilai').value);
  it.tagAlur = uniq(parseList($('#n-tag').value).map((t) => t.toLowerCase()));
  const cat = $('#n-catatan').value.trim();
  if (cat) it.catatan = cat; else delete it.catatan;
  it.diupdate = today();
  delete it.contoh;
  closeDlg($('#dlg-nilai'));
  closeDlg($('#dlg-detail'));
  if (udahTamat) { save(`${it.judul} dapat nilai ${angka(it.nilai)}`); return; }
  it.selesai = today();
  if (it.jenis === 'film') it.progres = { menit: it.durasi || 0 };
  else it.progres = { episode: it.totalEpisode || it.progres?.episode || 0 };
  save(`${it.judul} masuk Arsip dengan nilai ${angka(it.nilai)}`);
}
function setProgress(it, patch) {
  it.progres = { ...(it.progres || {}), ...patch };
  it.diupdate = today();
  delete it.contoh;
  const pr = progresOf(it);
  save();
  if (pr.tot && pr.done >= pr.tot) askFinish(it.id);
}

/* ---------- TMDB ---------- */
async function tmdb(path, params = {}) {
  const key = store.get(K.tmdb, '');
  if (!key) throw new Error('API key TMDB belum dipasang.');
  const url = new URL(TMDB_API + path);
  Object.entries({ language: 'en-US', ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
  const headers = { accept: 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; else url.searchParams.set('api_key', key);
  const r = await fetch(url, { headers });
  if (r.status === 401) throw new Error('API key TMDB ditolak. Cek lagi key-nya di Mode Edit.');
  if (!r.ok) throw new Error(`TMDB error ${r.status}`);
  return r.json();
}
function genresFromTmdb(list) {
  return uniq((list || []).flatMap((g) => GENRE_TMDB[g.id ?? g] || []));
}
async function cariTmdb() {
  const q = $('#f-cari').value.trim();
  if (!q) return;
  const ul = $('#tmdb-hasil');
  ul.innerHTML = '<li class="sub">Lagi nyari…</li>';
  try {
    const j = await tmdb('/search/multi', { query: q, include_adult: 'false' });
    const res = (j.results || []).filter((r) => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 8);
    if (!res.length) { ul.innerHTML = '<li class="sub">Gak ketemu. Coba judul aslinya (bahasa Inggris atau bahasa asal).</li>'; return; }
    ul.innerHTML = res.map((r) => {
      const title = r.title || r.name, year = (r.release_date || r.first_air_date || '').slice(0, 4);
      const img = r.poster_path ? `<img src="${TMDB_IMG}w92${esc(r.poster_path)}" alt="">` : '<span class="noimg"></span>';
      return `<li><button type="button" data-tmdb="${r.media_type}:${r.id}">${img}<span><b>${esc(title)}</b><small>${r.media_type === 'tv' ? 'Series' : 'Film'}${year ? ' · ' + year : ''}${r.original_title && r.original_title !== title ? ' · ' + esc(r.original_title) : ''}</small></span></button></li>`;
    }).join('');
  } catch (e) { ul.innerHTML = `<li class="err">${esc(e.message)}</li>`; }
}
async function pilihTmdb(ref) {
  const [type, id] = ref.split(':');
  const ul = $('#tmdb-hasil');
  ul.innerHTML = '<li class="sub">Ngambil detail…</li>';
  try {
    const d = await tmdb(`/${type}/${id}`, { append_to_response: type === 'movie' ? 'credits,keywords' : 'keywords' });
    const it = {
      judul: d.title || d.name,
      jenis: type === 'tv' ? 'series' : 'film',
      tahun: parseInt((d.release_date || d.first_air_date || '').slice(0, 4), 10) || undefined,
      genre: genresFromTmdb(d.genres),
      tagAlur: parseList($('#f-tag').value),
      status: $('#f-status').value,
      tmdbId: d.id,
      poster: d.poster_path || undefined,
      backdrop: d.backdrop_path || undefined,
      ratingPublik: d.vote_average ? Math.round(d.vote_average * 10) / 10 : undefined,
    };
    if (type === 'movie') {
      it.durasi = d.runtime || undefined;
      it.sutradara = (d.credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name).slice(0, 2).join(', ') || undefined;
    } else {
      it.totalEpisode = d.number_of_episodes || undefined;
      it.durasiEpisode = (d.episode_run_time || [])[0] || d.last_episode_to_air?.runtime || undefined;
      it.episodePerSeason = (d.seasons || []).filter((s) => s.season_number > 0 && s.episode_count > 0).map((s) => s.episode_count);
      it.sutradara = (d.created_by || []).map((c) => c.name).slice(0, 2).join(', ') || undefined;
    }
    const keep = { status: $('#f-status').value, catatan: $('#f-catatan').value };
    fillForm({ ...it, ...keep });
    ul.innerHTML = `<li class="sub">Terisi dari TMDB: ${esc(it.judul)}. Tinggal cek, kasih nilai atau tag alur, lalu Simpan.</li>`;
  } catch (e) { ul.innerHTML = `<li class="err">${esc(e.message)}</li>`; }
}
async function tmdbKandidat() {
  if (!store.get(K.tmdb, '')) { openEdit(); toast('Masukin API key TMDB dulu'); return; }
  const p = profil();
  if (!p) { toast('Kasih nilai minimal 3 judul dulu'); return; }
  const seeds = p.rated.filter((i) => i.tmdbId && i.nilai > p.avg).sort((a, b) => b.nilai - a.nilai).slice(0, 6);
  if (!seeds.length) { toast('Belum ada judul favorit yang tersambung ke TMDB. Tambah judul lewat pencarian TMDB dulu.'); return; }
  toast('Lagi nyari kandidat di TMDB…');
  try {
    const found = new Map();
    for (const s of seeds) {
      const type = s.jenis === 'series' ? 'tv' : 'movie';
      const j = await tmdb(`/${type}/${s.tmdbId}/recommendations`);
      for (const r of (j.results || []).slice(0, 10)) {
        if (!(r.media_type === 'movie' || r.media_type === 'tv' || !r.media_type)) continue;
        const mt = r.media_type || type;
        const k = `${mt}:${r.id}`;
        if (found.has(k)) continue;
        found.set(k, {
          id: `t-${mt}-${r.id}`, tmdbId: r.id, jenis: mt === 'tv' ? 'series' : 'film',
          judul: r.title || r.name, tahun: parseInt((r.release_date || r.first_air_date || '').slice(0, 4), 10) || undefined,
          genre: genresFromTmdb(r.genre_ids), tagAlur: [], poster: r.poster_path || undefined,
          ratingPublik: r.vote_average ? Math.round(r.vote_average * 10) / 10 : undefined,
        });
      }
    }
    const list = [...found.values()].slice(0, 30);
    // Ambil kata kunci (bahan "alur") buat 30 kandidat teratas
    await Promise.all(list.map(async (c) => {
      try {
        const kw = await tmdb(`/${c.jenis === 'series' ? 'tv' : 'movie'}/${c.tmdbId}/keywords`);
        c.tagAlur = (kw.keywords || kw.results || []).slice(0, 8).map((x) => x.name.toLowerCase());
      } catch { /* kandidat tetap dipakai tanpa tag */ }
    }));
    S.data.kandidatTmdb = list;
    save(`${list.length} kandidat baru dari TMDB`);
  } catch (e) { toast(e.message); }
}

/* ---------- GitHub ---------- */
function b64utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function pushGithub() {
  const token = store.get(K.gh, '');
  if (!token) { toast('Masukin token GitHub dulu'); $('#s-gh').focus(); return; }
  const api = `https://api.github.com/repos/${CFG.owner}/${CFG.repo}/contents/${CFG.path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const btn = $('#s-push');
  btn.disabled = true;
  btn.textContent = 'Menyimpan…';
  try {
    let sha;
    const g = await fetch(`${api}?ref=${CFG.branch}`, { headers, cache: 'no-store' });
    if (g.ok) sha = (await g.json()).sha;
    else if (g.status === 401) throw new Error('Token GitHub ditolak. Cek lagi token-nya.');
    else if (g.status !== 404) throw new Error(`GitHub error ${g.status}`);
    S.data.diperbarui = new Date().toISOString();
    const body = { message: `Update catatan nonton (${today()})`, content: b64utf8(JSON.stringify(S.data, null, 2) + '\n'), branch: CFG.branch, ...(sha ? { sha } : {}) };
    const r = await fetch(api, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (r.status === 409) throw new Error('Data di GitHub berubah dari tempat lain. Coba simpan lagi.');
    if (r.status === 403 || r.status === 404) throw new Error('Token gak punya izin tulis ke repo ini.');
    if (!r.ok) throw new Error(`Gagal nyimpen (${r.status})`);
    S.dirty = false;
    store.set(K.dirty, false);
    store.set(K.data, S.data);
    toast('Tersimpan ke GitHub. Web ke-update dalam 1–2 menit.');
    render();
    updateEditStatus();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan ke GitHub';
  }
}

/* ---------- Mode Edit ---------- */
function updateEditStatus() {
  const n = items().length;
  $('#s-status').textContent = S.dirty
    ? `Ada perubahan yang baru tersimpan di browser ini (${n} judul). Klik “Simpan ke GitHub” biar orang lain juga lihat.`
    : `Semua data sama dengan yang di GitHub (${n} judul).`;
  $('#s-contoh-wrap').hidden = !items().some((i) => i.contoh);
}
function openEdit() {
  $('#s-edit').checked = S.edit;
  $('#s-gh').value = store.get(K.gh, '');
  $('#s-tmdb').value = store.get(K.tmdb, '');
  $('#s-confirm').hidden = true;
  updateEditStatus();
  openDlg('#dlg-edit');
}
function exportJSON() {
  const blob = new Blob([JSON.stringify(S.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `layar-tancap-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function importJSON(file) {
  try {
    const j = JSON.parse(await file.text());
    if (!Array.isArray(j.judul)) throw new Error('Format file gak dikenal.');
    S.data = { versi: 1, ditolak: [], kandidatTmdb: [], ...j };
    save(`Dipulihkan: ${j.judul.length} judul`);
    updateEditStatus();
  } catch (e) { toast(`Gagal memulihkan: ${e.message}`); }
}

/* ---------- event ---------- */
function bindGlobal() {
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) { closeDlg(closeBtn.closest('dialog')); return; }
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const id = t.dataset.id, v = t.dataset.v;
    const it = id ? findItem(id) : null;
    switch (t.dataset.act) {
      case 'detail': openDetail(id); break;
      case 'open-edit': openEdit(); break;
      case 'add': openForm(null, { status: t.dataset.status }); break;
      case 'edit': closeDlg($('#dlg-detail')); openForm(id); break;
      case 'ask-del': $('#del-confirm').hidden = false; break;
      case 'cancel-del': $('#del-confirm').hidden = true; break;
      case 'del': S.data.judul = items().filter((i) => i.id !== id); closeDlg($('#dlg-detail')); save('Judul dihapus'); break;
      case 'f-status': S.filter.status = v; S.filter.genre = ''; render(); break;
      case 'f-genre': S.filter.genre = v; render(); break;
      case 'lagi-tab': S.lagiTab = v; render(); break;
      case 'melebar': S.melebar = v === '1'; render(); break;
      case 'ep-plus': if (it) setProgress(it, { episode: (it.progres?.episode || 0) + 1 }); break;
      case 'ep-minus': if (it) setProgress(it, { episode: Math.max(0, (it.progres?.episode || 0) - 1) }); break;
      case 'set-menit': {
        const inp = document.getElementById(`m-${id}`);
        const m = parseInt(inp?.value, 10);
        if (it && Number.isFinite(m)) setProgress(it, { menit: clamp(m, 0, it.durasi || m) });
        break;
      }
      case 'finish': case 'rate': askFinish(id); break;
      case 'pilih-on': S.pilih = new Set(); S.pilihConfirm = false; render(); break;
      case 'pilih-off': S.pilih = null; S.pilihConfirm = false; render(); break;
      case 'pilih': if (S.pilih) { if (S.pilih.has(id)) S.pilih.delete(id); else S.pilih.add(id); S.pilihConfirm = false; render(); } break;
      case 'pilih-semua': if (S.pilih) { S.visibleIds.forEach((x) => S.pilih.add(x)); render(); } break;
      case 'pilih-kosong': if (S.pilih) { S.pilih.clear(); S.pilihConfirm = false; render(); } break;
      case 'pilih-tanya-hapus': S.pilihConfirm = true; render(); break;
      case 'pilih-batal-hapus': S.pilihConfirm = false; render(); break;
      case 'pilih-hapus': {
        const n = S.pilih.size;
        S.data.judul = items().filter((i) => !S.pilih.has(i.id));
        S.pilih = new Set(); S.pilihConfirm = false;
        save(`${n} judul dihapus`);
        break;
      }
      case 'pilih-watchlist': {
        let n = 0;
        for (const i of items()) {
          if (!S.pilih.has(i.id)) continue;
          i.status = 'watchlist'; i.diupdate = today();
          delete i.nilai; delete i.selesai; delete i.progres; delete i.mulai; delete i.contoh;
          n++;
        }
        S.pilih = new Set(); S.pilihConfirm = false;
        save(`${n} judul dipindah ke Watchlist`);
        break;
      }
      case 'drop': if (it) { it.status = 'berhenti'; it.diupdate = today(); delete it.contoh; save(`${it.judul} dipindah ke Berhenti`); } break;
      case 'resume': if (it) { it.status = 'ditonton'; it.diupdate = today(); delete it.contoh; S.lagiTab = 'ditonton'; save(`Lanjut nonton ${it.judul}`); } break;
      case 'start': if (it) {
        it.status = 'ditonton'; it.mulai = today(); it.diupdate = today();
        it.progres = it.jenis === 'film' ? { menit: 0 } : { episode: 0 };
        delete it.contoh;
        closeDlg($('#dlg-detail'));
        save(`Mulai nonton ${it.judul}`);
      } break;
      case 'remove': S.data.judul = items().filter((i) => i.id !== id); save('Dihapus dari Watchlist'); break;
      case 'rek-add': {
        const c = allKandidat().find((k) => k.id === id);
        if (!c) break;
        const { id: _cid, keterangan: _k, ...rest } = c;
        items().push({ ...rest, id: uid(), status: 'watchlist', diupdate: today() });
        save(`${c.judul} masuk Watchlist`);
        break;
      }
      case 'rek-no': {
        const c = allKandidat().find((k) => k.id === id);
        if (!c) break;
        S.data.ditolak.push({ id: c.id, judul: c.judul, tahun: c.tahun, genre: c.genre, tagAlur: c.tagAlur });
        save(`${c.judul} gak bakal disaranin lagi`);
        break;
      }
      case 'tmdb-rek': tmdbKandidat(); break;
      case 'rail': {
        const el = document.getElementById(t.dataset.target);
        if (el) el.scrollBy({ left: Number(t.dataset.dir) * el.clientWidth * 0.85, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        break;
      }
      case 'go-genre': S.filter = { ...S.filter, status: 'selesai', genre: v, koleksi: '', q: '' }; break;
      case 'go-koleksi': S.filter = { ...S.filter, status: 'selesai', koleksi: v, genre: '', q: '', urut: 'rilisLama' }; break;
      case 'add-from-search': openForm(null, { judul: S.cari }); setTimeout(() => { $('#f-judul').value = S.cari; if (!$('#f-cari').disabled) { $('#f-cari').value = S.cari; cariTmdb(); } }, 60); break;
      default: break;
    }
  });

  $('#app').addEventListener('input', (e) => {
    if (e.target.id === 'f-q') { S.filter.q = e.target.value; render(); }
    if (e.target.id === 'cari-q') { S.cari = e.target.value; render(); }
  });
  $('#app').addEventListener('change', (e) => {
    const k = e.target.dataset.filter;
    if (k) { S.filter[k] = e.target.value; render(); }
  });
  $('#app').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.inline-input input')) {
      e.preventDefault();
      e.target.closest('.card').querySelector('[data-act="set-menit"]').click();
    }
  });

  $('#btn-edit').addEventListener('click', openEdit);
  $('#s-edit').addEventListener('change', (e) => { S.edit = e.target.checked; store.set(K.edit, S.edit); render(); });
  $('#s-simpan-key').addEventListener('click', () => {
    const gh = $('#s-gh').value.trim(), tm = $('#s-tmdb').value.trim();
    if (gh) store.set(K.gh, gh); else store.del(K.gh);
    if (tm) store.set(K.tmdb, tm); else store.del(K.tmdb);
    toast('Key disimpan di browser ini');
    render();
  });
  $('#s-push').addEventListener('click', () => {
    const gh = $('#s-gh').value.trim();
    if (gh) store.set(K.gh, gh);
    pushGithub();
  });
  $('#s-export').addEventListener('click', exportJSON);
  $('#s-import').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importJSON(f); e.target.value = ''; });
  $('#s-hapus-contoh').addEventListener('click', () => { $('#s-confirm').hidden = false; });
  $('#s-confirm-no').addEventListener('click', () => { $('#s-confirm').hidden = true; });
  $('#s-confirm-yes').addEventListener('click', () => {
    S.data.judul = items().filter((i) => !i.contoh);
    S.data.ditolak = [];
    $('#s-confirm').hidden = true;
    save('Data contoh dihapus');
    updateEditStatus();
  });
  $('#s-reset').addEventListener('click', async () => {
    store.del(K.data);
    store.del(K.dirty);
    S.dirty = false;
    try { S.data = await loadJSON('data/tontonan.json'); S.data.ditolak ||= []; S.data.kandidatTmdb ||= []; } catch { toast('Gagal memuat ulang dari server'); return; }
    render();
    updateEditStatus();
    toast('Data dimuat ulang dari server');
  });

  const form = $('#form-judul');
  form.addEventListener('submit', submitForm);
  form.addEventListener('input', (e) => {
    if (e.target.id === 'f-nilai') $('#f-nilai-out').textContent = angka(e.target.value);
    if (e.target.id === 'f-tag') renderTagSugg();
  });
  form.addEventListener('change', (e) => { if (['f-jenis', 'f-status', 'f-belum'].includes(e.target.id)) syncForm(); });
  $('#f-tag-sugg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    const cur = parseList($('#f-tag').value);
    cur.push(b.dataset.tag);
    $('#f-tag').value = uniq(cur).join(', ');
    renderTagSugg();
  });
  $('#btn-cari').addEventListener('click', cariTmdb);
  $('#f-cari').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cariTmdb(); } });
  $('#tmdb-hasil').addEventListener('click', (e) => { const b = e.target.closest('[data-tmdb]'); if (b) pilihTmdb(b.dataset.tmdb); });

  $('#form-nilai').addEventListener('submit', submitNilai);
  $('#n-nilai').addEventListener('input', (e) => { $('#n-nilai-out').textContent = angka(e.target.value); });

  // Klik di luar kotak dialog = tutup
  $$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) closeDlg(d); }));
}

/* ---------- ilustrasi hero (layar tancap di pegunungan) ---------- */
const ILLUSTRATION = `<svg viewBox="0 0 360 240" role="img" aria-label="Ilustrasi garis: layar tancap di kaki gunung, diapit pohon pinus, dengan proyektor dan bangku penonton" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
  <circle cx="300" cy="42" r="14"/>
  <path d="M40 52c6-10 22-10 26 0 8-2 14 4 12 10H34c-4-6 0-12 6-10z"/>
  <path d="M190 34c5-8 18-8 21 0 7-2 12 3 10 8h-36c-3-5 0-10 5-8z"/>
  <path d="M0 150 62 84l26 28 60-70 46 54 14-12 50 46 30-24 72 60"/>
  <path d="M150 42l-12 30M156 50l-6 26M210 104l-8 18M72 96l-10 20M300 116l-8 14" stroke-width="1.2" opacity=".55"/>
  <path d="M0 206c40-6 80 4 120-2s90-6 130 0 80 4 110-2"/>
  <path d="M20 214l4-6M60 216l3-6M210 214l4-6M330 214l3-6M150 218l3-5" stroke-width="1.2"/>
  <g fill="currentColor" stroke="none">
    <polygon points="28,140 14,176 42,176"/><polygon points="28,156 12,196 44,196"/><rect x="25" y="194" width="6" height="12"/>
    <polygon points="62,128 46,170 78,170"/><polygon points="62,146 42,200 82,200"/><rect x="59" y="198" width="6" height="8"/>
    <polygon points="306,136 292,170 320,170"/><polygon points="306,150 288,198 324,198"/><rect x="303" y="196" width="6" height="10"/>
    <polygon points="338,150 326,180 350,180"/><polygon points="338,164 322,202 354,202"/><rect x="335" y="200" width="6" height="6"/>
  </g>
  <polygon points="112,186 170,102 170,160" fill="currentColor" fill-opacity=".08" stroke="none"/>
  <rect x="166" y="94" width="112" height="70" rx="2" fill="var(--paper)"/>
  <path d="M186 148l20-26 14 16 10-10 26 20" stroke-width="1.6"/>
  <circle cx="248" cy="116" r="6" stroke-width="1.6"/>
  <path d="M172 164v42M272 164v42"/>
  <rect x="96" y="184" width="22" height="14" rx="2"/>
  <circle cx="103" cy="180" r="5"/><circle cx="113" cy="180" r="5"/>
  <path d="M100 198v8M114 198v8"/>
  <path d="M190 200h40M196 200v6M224 200v6" stroke-width="1.6"/>
</svg>`;

init();
