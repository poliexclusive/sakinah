// ============================================================================
// core.js — API, cache SWR, router, UI helpers (vanilla, tanpa dependensi)
// ============================================================================
'use strict';
const CFG = window.POLEX_CONFIG;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'r' + Date.now() + Math.random().toString(16).slice(2));
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms || 250); }; };
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// ---------- tanggal (zona Asia/Jakarta, tanpa library) ----------
const wibNow = () => new Date(Date.now() + 7 * 3600e3);
const pad2 = n => String(n).padStart(2, '0');
const todayStr = () => { const d = wibNow(); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); };
const addDays = (s, n) => { const p = s.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); };
const hariDari = s => { const p = String(s).split('-').map(Number); return p[0] ? HARI[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()] : ''; };
const tglIndo = (s, pendek) => { const p = String(s || '').split('-').map(Number); if (!p[0]) return '-'; return p[2] + ' ' + (pendek ? BULAN[p[1] - 1].slice(0, 3) : BULAN[p[1] - 1]) + ' ' + p[0]; };
const tglHari = s => hariDari(s) + ', ' + tglIndo(s);
const ymNow = () => todayStr().slice(0, 7);
const bulanLabel = ym => { const p = ym.split('-'); return BULAN[+p[1] - 1] + ' ' + p[0]; };
const akhirBulan = ym => { const p = ym.split('-').map(Number); return ym + '-' + pad2(new Date(Date.UTC(p[0], p[1], 0)).getUTCDate()); };
const hp = s => String(s || '').replace(/\D/g, '');
const hp62 = s => { let d = hp(s); if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d; return d; };

// ---------- penyimpanan lokal (aman bila diblokir) ----------
const LS = {
  get(k, def) { try { const v = localStorage.getItem('px1:' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem('px1:' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('px1:' + k); } catch (e) {} },
  purge(prefix) { try { Object.keys(localStorage).filter(k => k.startsWith('px1:' + prefix)).forEach(k => localStorage.removeItem(k)); } catch (e) {} }
};

// ---------- state ----------
const App = { token: null, user: null, boot: null, perf: [] };
const isAdmin = () => App.user && App.user.peran === 'ADMIN';
function restoreSession() {
  const s = LS.get('sess');
  if (s && s.token && s.user && s.v === CFG.VERSI_SKEMA) { App.token = s.token; App.user = s.user; App.boot = LS.get('boot:' + s.user.username) || null; return true; }
  return false;
}
function saveSession(token, user, boot) {
  App.token = token; App.user = user; if (boot) App.boot = boot;
  LS.set('sess', { token, user, v: CFG.VERSI_SKEMA }); if (boot) LS.set('boot:' + user.username, boot);
}
function logout(expired) {
  const u = App.user && App.user.username;
  App.token = null; App.user = null; App.boot = null; LS.del('sess'); if (u) LS.purge('c:' + u + ':');
  if (expired) toast('Sesi berakhir. Silakan masuk kembali.', 'err');
  go('/login', true);
}

// ---------- API ----------
const gasReady = () => CFG.GAS_URL && /^https?:\/\//.test(CFG.GAS_URL);
async function api(action, data, o) {
  o = o || {};
  if (!gasReady()) return { success: false, code: 'CFG', message: 'URL backend belum diatur. Isi GAS_URL di js/config.js.' };
  const body = JSON.stringify({ action, data: data || {}, token: App.token, reqId: o.write ? (o.reqId || uid()) : undefined });
  const t0 = performance.now(); const tries = o.write ? 3 : 2;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), o.timeout || 28000);
    try {
      const r = await fetch(CFG.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow', signal: ctl.signal });
      clearTimeout(to);
      const j = await r.json();
      App.perf.push({ a: action, rtt: Math.round(performance.now() - t0), srv: j.ms, t: Date.now() }); if (App.perf.length > 60) App.perf.shift();
      if (!j.success && j.code === 'AUTH' && action !== 'login') { if (App.token) logout(true); }
      return j;
    } catch (e) { clearTimeout(to); if (i < tries - 1) await sleep(700 * (i + 1)); }
  }
  return { success: false, code: 'NET', message: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.' };
}
/** Tulis: tampilkan error sebagai toast, kembalikan data atau null. */
async function tulis(action, data, o) {
  const j = await api(action, data, Object.assign({ write: true }, o));
  if (!j.success) { if (!(o && o.silent)) toast(j.message || 'Gagal menyimpan.', 'err'); return null; }
  if (j.message && !(o && o.silent)) toast(j.message, 'ok');
  return j;
}
/** Stale-while-revalidate: render cache segera (0 ms), lalu perbarui dari server. */
async function swr(key, action, data, render, o) {
  o = o || {}; const ck = 'c:' + (App.user ? App.user.username : '_') + ':' + key, hit = LS.get(ck);
  let shown = false;
  if (hit && hit.d && !o.noCache) { try { render(hit.d, true); shown = true; } catch (e) { console.error(e); } }
  const j = await api(action, data, { quiet: true });
  if (j.success) { LS.set(ck, { t: Date.now(), d: j.data }); if (!o.guard || o.guard()) render(j.data, false); }
  else if (!shown && (!o.guard || o.guard())) { if (o.onError) o.onError(j); else renderError(j.message); }
  return j;
}
function renderError(msg) { const v = $('#view'); if (v) v.innerHTML = '<div class="card pad"><div class="empty">' + ic('alert', 36) + '<p><b>Tidak dapat memuat data</b></p><p>' + esc(msg || '') + '</p><button class="btn" onclick="route()">' + ic('refresh', 16) + ' Coba lagi</button></div></div>'; }
function invalidateCache(...keys) { const p = 'c:' + (App.user ? App.user.username : '_') + ':'; keys.length ? keys.forEach(k => LS.purge(p + k)) : LS.purge(p); }

// ---------- UI ----------
function toast(msg, tipe) {
  let h = $('#toasts'); if (!h) { h = document.createElement('div'); h.id = 'toasts'; h.setAttribute('role', 'status'); h.setAttribute('aria-live', 'polite'); document.body.appendChild(h); }
  const t = document.createElement('div'); t.className = 'toast ' + (tipe || '');
  t.innerHTML = ic(tipe === 'err' ? 'alert' : tipe === 'ok' ? 'checkc' : 'info', 18) + '<div>' + esc(msg) + '</div>'; h.appendChild(t);
  setTimeout(() => { t.style.opacity = 0; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, tipe === 'err' ? 6000 : 3500);
}
function modal(o) {
  const m = document.createElement('div'); m.className = 'mod'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.innerHTML = '<div class="box ' + (o.size || '') + '"><div class="mh"><h3>' + esc(o.title || '') + '</h3><button class="btn ghost ico sm" data-x aria-label="Tutup">' + ic('x') + '</button></div><div class="mb">' + (o.body || '') + '</div>' + (o.foot === false ? '' : '<div class="mf"></div>') + '</div>';
  const close = v => { document.removeEventListener('keydown', esc_); m.remove(); if (o.onClose) o.onClose(v); };
  const esc_ = e => { if (e.key === 'Escape') close(null); };
  document.addEventListener('keydown', esc_);
  m.addEventListener('mousedown', e => { if (e.target === m && !o.sticky) close(null); });
  $('[data-x]', m).onclick = () => close(null);
  const mf = $('.mf', m);
  if (mf) (o.buttons || [{ t: 'Tutup', v: null }]).forEach(b => { const e = document.createElement('button'); e.className = 'btn ' + (b.c || ''); e.innerHTML = (b.i ? ic(b.i, 16) + ' ' : '') + esc(b.t); e.onclick = async () => { if (b.fn) { e.disabled = true; const sp = e.innerHTML; e.innerHTML = '<span class="spin"></span>'; const r = await b.fn(m); e.disabled = false; e.innerHTML = sp; if (r === false) return; close(r === undefined ? b.v : r); } else close(b.v); }; mf.appendChild(e); });
  document.body.appendChild(m); const f = $('input,select,textarea', m); if (f && o.focus !== false) setTimeout(() => f.focus(), 50);
  return { el: m, close };
}
function konfirmasi(judul, pesan, o) {
  o = o || {};
  return new Promise(res => modal({ title: judul, size: 'sm', body: '<p style="margin:0">' + pesan + '</p>' + (o.alasan ? '<div class="f mt"><label>' + esc(o.alasan) + ' <i>*</i></label><textarea class="in" id="kf-alasan" rows="2"></textarea></div>' : ''), onClose: v => res(v),
    buttons: [{ t: 'Batal', v: null }, { t: o.ok || 'Ya, lanjutkan', c: o.bahaya ? 'dng' : 'pri', fn: m => { if (o.alasan) { const v = $('#kf-alasan', m).value.trim(); if (v.length < 3) { toast('Alasan wajib diisi.', 'err'); return false; } return v; } return true; } }] }));
}
const badge = s => '<span class="bd2 s-' + esc(s) + '">' + esc(s) + '</span>';
const skel = (n, h) => Array.from({ length: n || 4 }, () => '<div class="sk" style="height:' + (h || 16) + 'px;margin:14px 0"></div>').join('');
function btnBusy(b, on) { if (!b) return; if (on) { b._h = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="spin"></span>'; } else { b.disabled = false; if (b._h) b.innerHTML = b._h; } }
function copyText(t) {
  const lama = () => { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} a.remove(); if (ok) toast('Disalin.', 'ok'); else toast('Tidak dapat menyalin otomatis. Salin manual dari kolom pesan.', 'err'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('Disalin.', 'ok'), lama); else lama();
}
function unduh(nama, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function b64Blob(b64, type) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); }
function pager(total, hal, per) { const maks = Math.max(1, Math.ceil(total / per)); return '<div class="pager"><span>' + (total ? ((hal - 1) * per + 1) + '–' + Math.min(total, hal * per) + ' dari ' + total : 'Tidak ada data') + '</span><span class="grow"></span><button class="btn sm ico" data-pg="' + (hal - 1) + '" ' + (hal <= 1 ? 'disabled' : '') + ' aria-label="Sebelumnya">' + ic('left', 16) + '</button><span>Hal ' + hal + '/' + maks + '</span><button class="btn sm ico" data-pg="' + (hal + 1) + '" ' + (hal >= maks ? 'disabled' : '') + ' aria-label="Berikutnya">' + ic('right', 16) + '</button></div>'; }
function fieldErr(el, msg) { el.classList.add('bad'); let e = el.parentNode.querySelector('.errt'); if (!e) { e = document.createElement('div'); e.className = 'errt'; el.parentNode.appendChild(e); } e.textContent = msg; el.focus(); }
function clearErr(root) { $$('.bad', root).forEach(x => x.classList.remove('bad')); $$('.errt', root).forEach(x => x.remove()); }
const opt = (arr, sel, ph) => (ph ? '<option value="">' + esc(ph) + '</option>' : '') + arr.map(x => { const v = typeof x === 'object' ? x.v : x, l = typeof x === 'object' ? x.l : x; return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');

// ---------- router ----------
const ROUTES = [];
function page(path, def) { ROUTES.push(Object.assign({ path }, def)); }
let _cleanup = null, _navTok = 0;
function go(path, replace) { const h = '#' + path; if (location.hash === h) route(); else if (replace) location.replace(h); else location.hash = h; }
function matchRoute(p) {
  for (const r of ROUTES) {
    const a = r.path.split('/'), b = p.split('/'); if (a.length !== b.length && !r.path.endsWith('/*')) continue;
    const params = {}; let ok = true;
    for (let i = 0; i < a.length; i++) { if (a[i] === '*') break; if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i] || ''); else if (a[i] !== b[i]) { ok = false; break; } }
    if (ok) return { r, params };
  } return null;
}
async function route() {
  const raw = location.hash.replace(/^#/, '') || '/'; const [p, qs] = raw.split('?'); const q = Object.fromEntries(new URLSearchParams(qs || ''));
  if (_cleanup) { try { _cleanup(); } catch (e) {} _cleanup = null; }
  const m = matchRoute(p) || matchRoute('/404'); const tok = ++_navTok;
  if (m.r.pub) { document.body.classList.add('pub'); $('#app').innerHTML = ''; return m.r.render($('#app'), m.params, q); }
  if (!App.token) { if (p !== '/login') return go('/login', true); }
  else if (p === '/login') return go('/', true);
  if (m.r.admin && !isAdmin()) { toast('Menu ini khusus Admin.', 'err'); return go('/', true); }
  if (p === '/login') { $('#app').innerHTML = ''; return m.r.render($('#app'), {}, q); }
  if (!$('#view')) shell();
  setActiveNav(p, m.r.title);
  let v = $('#view'); const nv = v.cloneNode(false); v.replaceWith(nv); v = nv; v.innerHTML = skel(5, 20); window.scrollTo(0, 0);  // elemen baru = pendengar halaman lama ikut hilang
  const ctx = { tok, alive: () => tok === _navTok, q, params: m.params, onLeave: f => { _cleanup = f; } };
  try { await m.r.render(v, m.params, q, ctx); } catch (e) { console.error(e); if (ctx.alive()) renderError(e.message); }
}
window.addEventListener('hashchange', route);

// ---------- shell (sidebar + topbar) ----------
const NAV = [
  { g: 'Operasional', items: [
    { p: '/', t: 'Beranda', i: 'home' }, { p: '/daftar', t: 'Pendaftaran Baru', i: 'plus' }, { p: '/rekap', t: 'Rekap Hari Ini', i: 'list' }, { p: '/konfirmasi', t: 'Konfirmasi Booking', i: 'checkc', cnt: 'menunggu', lama: 1 },
    { p: '/antrean', t: 'Check-in & Antrean', i: 'ticket', lama: 1 }] },
  { g: 'Data', items: [{ p: '/data', t: 'Data Pasien', i: 'users' }, { p: '/laporan', t: 'Laporan & Grafik', i: 'chart' }] },
  { g: 'Administrasi', admin: true, items: [{ p: '/jadwal', t: 'Dokter', i: 'stetho' }, { p: '/wa', t: 'Notifikasi WhatsApp', i: 'wa', lama: 1 }, { p: '/crm', t: 'CRM Kontak', i: 'user', lama: 1 }, { p: '/pengaturan', t: 'Pengaturan', i: 'sliders' }] }
];
const BNAV = [{ p: '/', t: 'Beranda', i: 'home' }, { p: '/daftar', t: 'Daftar', i: 'plus' }, { p: '/rekap', t: 'Rekap', i: 'list' }, { p: '/konfirmasi', t: 'Konfirmasi', i: 'checkc', lama: 1 }, { p: '/antrean', t: 'Antrean', i: 'ticket', lama: 1 }, { p: '/data', t: 'Data', i: 'users' }];
function shell() {
  const nama = (App.boot && App.boot.config && App.boot.config.nama) || CFG.NAMA, parts = nama.split(' ');
  $('#app').innerHTML = '<aside class="side" id="side"><div class="brand"><div class="nm">' + esc(parts.slice(0, -1).join(' ')) + ' <b>' + esc(parts.slice(-1)) + '</b></div><div class="sub">Registration Suite</div></div><nav class="nav" id="nav">' +
    NAV.filter(g => !g.admin || isAdmin()).map(g => '<div class="grp">' + g.g + '</div>' + g.items.filter(n => !n.lama || fiturLama()).map(n => '<a data-p="' + n.p + '" href="#' + n.p + '">' + ic(n.i, 19) + '<span>' + n.t + '</span>' + (n.cnt ? '<span class="cnt hide" data-cnt="' + n.cnt + '"></span>' : '') + '</a>').join('')).join('') +
    '</nav><div class="me"><div class="avatar">' + esc((App.user.nama || '?').charAt(0).toUpperCase()) + '</div><div class="grow"><div class="n">' + esc(App.user.nama) + '</div><div class="r">' + (isAdmin() ? 'Administrator' : 'Petugas Pendaftaran') + '</div></div><button id="btn-out" aria-label="Keluar" title="Keluar">' + ic('logout', 18) + '</button></div></aside><div class="scrim" id="scrim"></div>' +
    '<div class="main"><header class="top"><button class="burger" id="burger" aria-label="Menu">' + ic('menu', 24) + '</button><div class="ttl" id="ttl"></div><span class="grow"></span><span class="date">' + tglHari(todayStr()) + '</span><button class="btn sm ico ghost" id="btn-pw" title="Ganti kata sandi" aria-label="Ganti kata sandi">' + ic('lock', 17) + '</button></header><main id="view"></main></div>' +
    '<nav class="bnav">' + BNAV.filter(n => !n.lama || fiturLama()).map(n => '<a data-p="' + n.p + '" href="#' + n.p + '">' + ic(n.i, 21) + n.t + '</a>').join('') + '</nav>';
  const side = $('#side'), scrim = $('#scrim'); const tog = o => { side.classList.toggle('open', o); scrim.classList.toggle('on', o); };
  $('#burger').onclick = () => tog(true); scrim.onclick = () => tog(false); $('#nav').onclick = e => { if (e.target.closest('a')) tog(false); };
  $('#btn-out').onclick = () => logout(); $('#btn-pw').onclick = ubahSandi;
  hitungMenunggu();
}
function setActiveNav(p, title) {
  const base = '/' + (p.split('/')[1] || ''); $$('[data-p]').forEach(a => a.classList.toggle('on', a.dataset.p === base));
  $('#ttl').textContent = title || ''; document.title = (title ? title + ' · ' : '') + CFG.NAMA;
}
function setBadge(n) { $$('[data-cnt="menunggu"]').forEach(e => { e.textContent = n; e.classList.toggle('hide', !n); }); }
async function hitungMenunggu() { const d = (App.boot && App.boot.dashboard); if (d && d.kpi) setBadge(d.kpi.menungguTotal || 0); }
function ubahSandi(wajib) {
  const m = modal({ title: wajib === true ? 'Ganti kata sandi (wajib)' : 'Ganti kata sandi', sticky: wajib === true, size: 'sm', body: (wajib === true ? '<p class="muted" style="margin-top:0">Demi keamanan, ganti kata sandi sementara Anda sebelum melanjutkan.</p>' : '') +
    '<div class="col"><div class="f"><label>Kata sandi saat ini</label><input class="in" type="password" id="pw0" autocomplete="current-password"></div><div class="f"><label>Kata sandi baru</label><input class="in" type="password" id="pw1" autocomplete="new-password"><span class="hint">Minimal 8 karakter, memuat huruf dan angka.</span></div><div class="f"><label>Ulangi kata sandi baru</label><input class="in" type="password" id="pw2" autocomplete="new-password"></div></div>',
    buttons: (wajib === true ? [] : [{ t: 'Batal', v: null }]).concat([{ t: 'Simpan', c: 'pri', fn: async el => {
      const a = $('#pw0', el).value, b = $('#pw1', el).value, c = $('#pw2', el).value;
      if (b !== c) { toast('Pengulangan kata sandi tidak sama.', 'err'); return false; }
      const r = await tulis('me.password', { lama: a, baru: b }); if (!r) return false;
      if (App.user) { App.user.wajibGanti = false; LS.set('sess', { token: App.token, user: App.user, v: CFG.VERSI_SKEMA }); } return true; } }]) });
  return m;
}
