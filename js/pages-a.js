// pages-a.js — komponen bersama booking, login, verifikasi publik, beranda, form pendaftaran
'use strict';
const TRANSISI_UI = { Terdaftar: ['Selesai', 'Batal'], Menunggu: ['Terdaftar', 'Terkonfirmasi', 'Batal'], Terkonfirmasi: ['Hadir', 'Batal'], Hadir: ['Selesai', 'Batal'], Selesai: [], Batal: ['Terdaftar'] };
const fiturLama = () => !!(App.boot && App.boot.config && App.boot.config.fiturLama);
const hpOk = s => /^(0|62)8\d{7,12}$/.test(hp(s));
const emailOk = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const nikOk = s => /^\d{16}$/.test(String(s || '').trim());
const dokterNama = id => { const d = ((App.boot && App.boot.dokter) || []).find(x => x.ID_Dokter === id); return d ? d.Nama_Dokter : ''; };

// ---------- aksi bersama untuk baris pendaftaran ----------
/** Ubah status dengan UI optimistis: tampilan berubah lebih dulu, dikembalikan bila server menolak. */
async function ubahStatus(r, ke, rerender, alasan) {
  const lama = Object.assign({}, r); r.status = ke; if (ke === 'Batal') r.alasan = alasan; if (rerender) rerender();
  const j = await api('daftar.status', { id: r.id, status: ke, alasan }, { write: true });
  if (!j.success) { Object.assign(r, lama); if (rerender) rerender(); toast(j.message || 'Gagal mengubah status.', 'err'); return false; }
  Object.assign(r, j.data); invalidateCache(); if (rerender) rerender(); toast(j.message, 'ok'); return true;
}
function tombolAksi(r) {
  const a = [];
  if (r.status === 'Terdaftar') return '<button class="btn sm pri" data-share="' + esc(r.id) + '">' + ic('wa', 14) + ' Kirim bukti</button>';
  if (r.status === 'Menunggu') a.push(['Terkonfirmasi', 'Konfirmasi', 'ok', 'check']);
  if (r.status === 'Terkonfirmasi') a.push(['Hadir', 'Check-in', 'pri', 'ticket']);
  if (r.status === 'Hadir') a.push(['Selesai', 'Selesai', 'pri', 'checkc']);
  return a.map(x => '<button class="btn sm ' + x[2] + '" data-st="' + x[0] + '" data-id="' + esc(r.id) + '">' + ic(x[3], 14) + ' ' + x[1] + '</button>').join('');
}
/** Pasang pendengar klik untuk tombol [data-st] dan baris [data-open] dalam sebuah wadah. */
function pasangAksiBaris(root, getRows, rerender) {
  root.addEventListener('click', async e => {
    const sh = e.target.closest('[data-share]');
    if (sh) { e.stopPropagation(); const r = getRows().find(x => x.id === sh.dataset.share); if (r) bagikanBukti(r, sh); return; }
    const b = e.target.closest('[data-st]');
    if (b) { e.stopPropagation(); const r = getRows().find(x => x.id === b.dataset.id); if (!r) return; btnBusy(b, true); await ubahStatus(r, b.dataset.st, rerender); return; }
    const o = e.target.closest('[data-open]'); if (o && !e.target.closest('button,a')) { const r = getRows().find(x => x.id === o.dataset.open); if (r) bukaDetail(r, rerender); }
  });
}
async function kirimWA(r) {
  const w = window.open('', '_blank'); const j = await api('wa.link', { id: r.id });
  if (!j.success) { if (w) w.close(); return toast(j.message, 'err'); }
  if (w) w.location = j.data.url; else location.href = j.data.url;
}
function urlVerif(r) { const base = String((App.boot.config && App.boot.config.appUrl) || (location.origin + location.pathname)).replace(/\/+$/, '').replace(/\/index\.html$/, ''); return base + '/#/v/' + r.kode; }
function namaBerkas(r) { const t = String(r.tgl).split('-'); return 'Booking_' + t[2] + '_' + t[1] + '_' + t[0] + '__' + String(r.nama).trim().replace(/[^A-Za-z0-9]+/g, '_').toUpperCase() + '.pdf'; }
function buatBuktiBlob(r) { return Tiket.pdf({ nama: r.nama, rm: r.rm, tgl: r.tgl, jam: r.jam || '', alamat: r.alamat, dokter: r.dokter, id: r.id, verifUrl: urlVerif(r) }); }
const PESAN_BAWAAN = "Assalamu'alaikum Bapak/Ibu {nama},\n\nBerikut bukti booking *Poli Exclusive RSI Sakinah Mojokerto*:\n\n📅 {hari}, {tanggal}\n🕐 Pukul {jam} WIB\n👨‍⚕️ {dokter}\n🔖 Kode booking: {id}\n\nMohon hadir 15 menit lebih awal dan membawa kartu identitas. Tunjukkan bukti booking ini kepada petugas pendaftaran.\n\nTerima kasih 🙏";
function pesanBukti(r) {
  const tpl = (App.boot.config && App.boot.config.pesanBukti) || PESAN_BAWAAN, v = { nama: r.nama, hari: r.hari || hariDari(r.tgl), tanggal: tglIndo(r.tgl), jam: r.jam || jamTxt(r), dokter: r.dokter, id: r.id, rm: r.rm || '' };
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));
}
function linkWA(r, teks) { let n = hp(r.hp); if (n.startsWith('0')) n = '62' + n.slice(1); else if (n.startsWith('8')) n = '62' + n; return 'https://wa.me/' + n + '?text=' + encodeURIComponent(teks); }
async function cetakBukti(r, btn) {
  btnBusy(btn, true);
  try { unduh(namaBerkas(r), await buatBuktiBlob(r)); toast('Booking confirmation diunduh.', 'ok'); }
  catch (e) { toast('Bukti belum dapat dibuat: ' + (e && e.message || e), 'err'); }
  btnBusy(btn, false);
}
/** Satu ketukan: PDF + pesan ke WhatsApp. HP memakai menu bagikan; komputer mengunduh PDF, menyalin pesan, dan membuka chat. */
async function bagikanBukti(r, btn) {
  btnBusy(btn, true);
  try {
    const blob = await buatBuktiBlob(r), teks = pesanBukti(r), file = new File([blob], namaBerkas(r), { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: teks }); btnBusy(btn, false); return; } catch (e) { if (e && e.name === 'AbortError') { btnBusy(btn, false); return; } }
    }
    unduh(file.name, blob); copyText(teks);
    toast('PDF diunduh dan pesan disalin. Lampirkan PDF di chat WhatsApp.', 'ok');
    window.open(linkWA(r, teks), '_blank');
  } catch (e) { toast('Gagal menyiapkan bukti: ' + (e && e.message || e), 'err'); }
  btnBusy(btn, false);
}
function bukaDetail(r, rerender) {
  const nm = r.nama, st = TRANSISI_UI[r.status] || [];
  const dl = [['Kode booking', '<span class="code">' + esc(r.id) + '</span>'], ['Status', badge(r.status)], ['Jenis kunjungan', esc(r.kunjungan) + ' · ' + (r.sasa === 'Sasa' ? '<span class="chip gold">SASA (baru)</span>' : '<span class="chip">Lama</span>')],
    ['Jadwal', esc(tglHari(r.tgl)) + ' · pukul ' + esc(jamTxt(r)) + ' WIB'], ['Dokter', esc(r.dokter)], ['Penjamin', esc(r.jenis)], ['No. RM', esc(r.rm || '-')], ['Antrean', esc(r.antrean || '-')], ['No. WhatsApp', esc(r.hp || '-')],
    ['NIK', esc(r.nik || '-')], ['Alamat', esc(r.alamat || '-')], ['Catatan', esc(r.catatan || '-')]].concat(r.alasan ? [['Alasan batal', esc(r.alasan)]] : []).concat([['Dibuat', esc((r.dibuat || '') + ' oleh ' + (r.dibuatOleh || '-'))]]);
  const m = modal({ title: nm, size: 'lg', body: '<div class="fg">' + dl.map(x => '<div><div class="lbl">' + x[0] + '</div><div>' + x[1] + '</div></div>').join('') + '</div>', foot: false });
  const bar = document.createElement('div'); bar.className = 'mf';
  const add = (id, label, ico, cls) => { const b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.dataset.a = id; b.innerHTML = ic(ico, 16) + ' ' + label; bar.appendChild(b); };
  if (r.status !== 'Batal') { add('share', 'Kirim bukti', 'wa', 'pri'); add('bukti', 'Unduh PDF', 'file'); }
  add('edit', 'Ubah catatan', 'edit');
  if (['Terdaftar', 'Menunggu', 'Terkonfirmasi'].includes(r.status)) add('jadwal', 'Jadwal ulang', 'calendar');
  st.forEach(s => add('st:' + s, s === 'Batal' ? 'Batalkan' : s === 'Menunggu' && r.status === 'Batal' ? 'Aktifkan kembali' : s === 'Menunggu' ? 'Kembali ke menunggu' : s === 'Hadir' ? 'Check-in' : s === 'Terkonfirmasi' ? 'Konfirmasi' : s, s === 'Batal' ? 'ban' : 'check', s === 'Batal' ? 'dng' : (s === 'Terkonfirmasi' || s === 'Hadir' || s === 'Selesai') ? 'pri' : ''));
  if (isAdmin()) add('hapus', 'Hapus', 'trash', 'dng');
  $('.box', m.el).appendChild(bar);
  bar.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'bukti') return cetakBukti(r, b); if (a === 'share') return bagikanBukti(r, b); if (a === 'wa') return kirimWA(r);
    if (a === 'edit') { m.close(); return ubahCatatan(r, rerender); } if (a === 'jadwal') { m.close(); return jadwalUlang(r, rerender); }
    if (a === 'hapus') { const ok = await konfirmasi('Hapus data pendaftaran?', 'Data <b>' + esc(r.nama) + '</b> (' + esc(r.id) + ') akan dihapus permanen dan tidak dapat dikembalikan.', { bahaya: true, ok: 'Hapus permanen' }); if (!ok) return; const j = await tulis('daftar.delete', { id: r.id }); if (j) { invalidateCache(); m.close(); if (rerender) rerender('hapus', r); } return; }
    if (a.startsWith('st:')) { const ke = a.slice(3); let alasan; if (ke === 'Batal') { alasan = await konfirmasi('Batalkan booking?', 'Booking <b>' + esc(r.nama) + '</b> akan dibatalkan.', { alasan: 'Alasan pembatalan', bahaya: true, ok: 'Ya, batalkan' }); if (!alasan) return; } m.close(); await ubahStatus(r, ke, rerender, alasan); }
  };
}
function ubahCatatan(r, rerender) {
  const jenis = (App.boot.referensi['Jenis Pasien'] || []);
  modal({ title: 'Ubah data booking', size: 'sm', body: '<div class="col"><div class="f"><label>Jenis pasien / penjamin</label><select class="in" id="uc-j">' + opt(jenis, r.jenis) + '</select></div><div class="f"><label>Catatan</label><textarea class="in" id="uc-c" maxlength="500">' + esc(r.catatan) + '</textarea></div></div>',
    buttons: [{ t: 'Batal', v: null }, { t: 'Simpan', c: 'pri', fn: async el => { const j = await tulis('daftar.update', { id: r.id, catatan: $('#uc-c', el).value, jenisPasien: $('#uc-j', el).value }); if (!j) return false; Object.assign(r, j.data); invalidateCache(); if (rerender) rerender(); return true; } }] });
}
const jamTxt = r => r.jam || (r.sesi === 'Pagi' ? '08:00' : r.sesi === 'Sore' ? '16:00' : '—');
const jamNow = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function jadwalUlang(r, rerender) {
  const m = modal({ title: 'Jadwal ulang — ' + r.nama, body: '<div class="col"><div class="fg"><div class="f"><label>Tanggal baru</label><input class="in" type="date" id="ju-t" min="' + (isAdmin() ? '' : todayStr()) + '" value="' + esc(r.tgl) + '"></div><div class="f"><label>Jam kunjungan</label><input class="in" type="time" id="ju-j" value="' + esc(r.jam || '') + '"></div></div><div class="f"><label>Dokter</label><select class="in" id="ju-s"><option>Memuat…</option></select></div><div class="hint">Pasien akan diberi tahu lewat WhatsApp/Email bila notifikasi aktif.</div></div>',
    buttons: [{ t: 'Batal', v: null }, { t: 'Ubah jadwal', c: 'pri', fn: async el => { const dokterId = $('#ju-s', el).value, jam = $('#ju-j', el).value; if (!dokterId || dokterId === '-') { toast('Pilih dokter.', 'err'); return false; } if (!jam) { toast('Isi jam kunjungan.', 'err'); return false; } const j = await tulis('daftar.reschedule', { id: r.id, tanggal: $('#ju-t', el).value, jam, dokterId }); if (!j) return false; Object.assign(r, j.data); invalidateCache(); if (rerender) rerender(); return true; } }] });
  const muat = async () => { const s = $('#ju-s', m.el); s.innerHTML = '<option>Memuat…</option>'; const j = await api('slot', { tanggal: $('#ju-t', m.el).value || r.tgl }); if (!j.success || !j.data.slot.length) { s.innerHTML = '<option value="-">Belum ada dokter aktif</option>'; return; } s.innerHTML = j.data.slot.map(x => '<option value="' + x.dokterId + '"' + (x.dokterId === r.dokterId ? ' selected' : '') + '>' + esc(x.dokter) + '</option>').join(''); };
  $('#ju-t', m.el).onchange = muat; muat();
}

// ---------- LOGIN ----------
page('/login', { title: 'Masuk', render(el) {
  const nama = CFG.NAMA;
  el.innerHTML = '<div class="lg"><section class="hero"><div><div class="brand" style="padding:0;border:0"><div class="nm" style="font-size:26px">Poli Exclusive <b>Sakinah</b></div><div class="sub">Registration Suite</div></div></div><div><h1>Pelayanan eksklusif<br>dimulai dari <em>pendaftaran</em><br>yang rapi.</h1><p class="sp"></p><p>Registrasi pasien, konfirmasi booking, antrean dan laporan kunjungan — dalam satu tempat, tanpa lagi menyalin ke spreadsheet bulanan.</p></div><div class="sm" style="color:#94A3B8">© ' + new Date().getFullYear() + ' ' + esc(nama) + '</div></section>' +
    '<section class="formw"><form class="card" id="lf" autocomplete="on" novalidate><h2>Masuk</h2><p class="muted" style="margin:4px 0 20px">Gunakan akun petugas atau admin Anda.</p>' +
    (gasReady() ? '' : '<div class="errt" style="margin-bottom:12px;padding:10px;background:var(--warn-bg);border-radius:8px;color:var(--warn)">URL backend belum diatur. Edit <span class="code">js/config.js</span> lalu isi <b>GAS_URL</b>.</div>') +
    '<div class="col"><div class="f"><label for="lu">Username</label><input class="in" id="lu" name="username" autocomplete="username" autocapitalize="none" required></div><div class="f"><label for="lp">Kata sandi</label><div style="position:relative"><input class="in" id="lp" name="password" type="password" autocomplete="current-password" required style="padding-right:44px"><button type="button" class="btn ghost ico sm" id="lt" style="position:absolute;right:4px;top:6px" aria-label="Tampilkan kata sandi">' + ic('eye', 17) + '</button></div></div><div class="errt" id="le" role="alert"></div><button class="btn pri blk" id="lb" style="min-height:46px">Masuk</button></div></form></section></div>';
  $('#lt').onclick = () => { const p = $('#lp'); p.type = p.type === 'password' ? 'text' : 'password'; };
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const u = $('#lu').value.trim(), p = $('#lp').value, err = $('#le'); err.textContent = '';
    if (!u || !p) { err.textContent = 'Username dan kata sandi wajib diisi.'; return; }
    const b = $('#lb'); btnBusy(b, true); const j = await api('login', { username: u, sandi: p }); btnBusy(b, false);
    if (!j.success) { err.textContent = j.message || 'Gagal masuk.'; $('#lp').select(); return; }
    saveSession(j.data.token, j.data.user, j.data.boot); location.hash = '#/'; await sleep(30);
    if (j.data.user.wajibGanti) ubahSandi(true);
  };
  setTimeout(() => $('#lu') && $('#lu').focus(), 50); document.title = 'Masuk · ' + nama;
} });

// ---------- VERIFIKASI PUBLIK ----------
page('/v/:kode', { pub: true, title: 'Verifikasi Booking', async render(el, p) {
  document.title = 'Verifikasi Booking · ' + CFG.NAMA; el.innerHTML = '<div class="ver"><div class="card pad center" id="vr">' + skel(4, 18) + '</div></div>';
  const j = await api('verify', { k: p.kode }); const c = $('#vr');
  if (!j.success) { c.innerHTML = '<div style="color:var(--err)">' + ic('ban', 48) + '</div><h2 style="margin-top:8px">Tidak Ditemukan</h2><p class="muted">' + esc(j.message || 'Kode verifikasi tidak dikenali.') + '</p>'; return; }
  const d = j.data, ok = d.valid && d.cocokBukti;
  c.innerHTML = '<div style="color:' + (ok ? 'var(--ok)' : 'var(--err)') + '">' + ic(ok ? 'checkc' : 'alert', 52) + '</div><h2 style="margin:8px 0 4px">' + (ok ? 'Booking Valid' : d.valid ? 'Jadwal Telah Berubah' : 'Booking Dibatalkan') + '</h2><p class="muted" style="margin:0 0 18px">' + esc(d.institusi) + '</p>' +
    '<div style="text-align:left;border-top:1px dashed var(--line);padding-top:16px" class="col">' + [['Kode booking', '<span class="code">' + esc(d.kode) + '</span>'], ['Pasien', esc(d.pasien)], ['Dokter', esc(d.dokter)], ['Jadwal', esc(d.hari + ', ' + tglIndo(d.tanggal))], ['Jam', esc(d.jam ? d.jam + ' WIB' : d.sesi)], ['Status', badge(d.status)]].map(x => '<div class="row" style="justify-content:space-between"><span class="muted">' + x[0] + '</span><b style="text-align:right">' + x[1] + '</b></div>').join('') + '</div>' + (ok ? '' : '<p class="errt" style="margin-top:14px">' + (d.valid ? 'Bukti yang Anda bawa dibuat sebelum jadwal diubah. Data di atas adalah jadwal terbaru.' : 'Hubungi petugas pendaftaran untuk memastikan jadwal Anda.') + '</p>');
} });
page('/404', { title: 'Tidak ditemukan', render(el) { el.innerHTML = '<div class="card pad"><div class="empty">' + ic('search', 36) + '<p><b>Halaman tidak ditemukan</b></p><a class="btn" href="#/">Ke Beranda</a></div></div>'; } });

// ---------- BERANDA ----------
page('/', { title: 'Beranda', async render(el, p, q, ctx) {
  let tgl = todayStr(), D = null; const semuaRows = () => (D ? D.rows : []);
  el.innerHTML = '<div class="ph"><div><h1 id="hi"></h1><div class="sub" id="hs"></div></div><div class="act"><div class="seg" id="dsel"><button id="dprev" aria-label="Hari sebelumnya">' + ic('left', 16) + '</button><button id="dtoday">Hari ini</button><button id="dnext" aria-label="Hari berikutnya">' + ic('right', 16) + '</button></div><a class="btn gold" href="#/daftar">' + ic('plus', 17) + ' Pendaftaran Baru</a></div></div><div id="dash">' + skel(6, 22) + '</div>';
  const jam = wibNow().getUTCHours(); $('#hi').textContent = (jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam') + ', ' + App.user.nama.split(' ')[0];
  const render = () => {
    if (!D) return; const k = D.kpi; $('#hs').textContent = tglHari(D.tanggal) + (D.tanggal === todayStr() ? ' · hari ini' : '');
    const kp = (l, v, s, c) => '<div class="card kpi ' + (c || '') + '"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + s + '</div></div>';
    const dari = D.rows.filter(r => r.status !== 'Batal');
    $('#dash').innerHTML = '<div class="grid g4">' + kp('Pasien hari ini', k.total, k.onsite + ' onsite · ' + k.appointment + ' appointment') + kp('Sesi pagi', dari.filter(r => r.sesi === 'Pagi').length, 'sebelum pukul 13:00', 'warn') + kp('Sesi sore', dari.filter(r => r.sesi === 'Sore').length, 'pukul 13:00 dan sesudahnya', 'info') + kp('Bulan ini', k.sasaBulan + k.lamaBulan, k.sasaBulan + ' Sasa (baru) · ' + k.lamaBulan + ' lama', 'ok') + '</div>' +
      '<div class="grid g12 mt"><div class="card"><div class="hd"><h3>Jadwal ' + (D.tanggal === todayStr() ? 'hari ini' : 'tanggal ini') + '</h3><a class="btn sm" href="#/rekap">Rekap ' + ic('right', 14) + '</a></div>' +
      (D.rows.length ? '<div class="tw"><table class="t stack"><thead><tr><th>Jam</th><th>Pasien</th><th>Dokter</th><th>Status</th><th></th></tr></thead><tbody>' + D.rows.map(r => '<tr class="cl" data-open="' + esc(r.id) + '"><td data-l="Jam" class="b">' + esc(jamTxt(r)) + '</td><td data-l="Pasien"><div class="nm">' + esc(r.nama) + (r.sasa === 'Sasa' ? ' <span class="chip gold">SASA</span>' : '') + '</div><div class="sub">' + esc(r.jenis) + ' · ' + esc(r.kunjungan) + '</div></td><td data-l="Dokter">' + esc(r.dokter) + '</td><td data-l="Status">' + badge(r.status) + '</td><td class="nolbl right">' + tombolAksi(r) + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty">' + ic('calendar', 34) + '<p>Belum ada pendaftaran pada tanggal ini.</p><a class="btn pri" href="#/daftar">' + ic('plus', 16) + ' Daftarkan pasien</a></div>') + '</div>' +
      '<div class="col"><div class="card"><div class="hd"><h3>Dokter ' + (D.tanggal === todayStr() ? 'hari ini' : 'tanggal ini') + '</h3></div><div class="bd col" style="gap:14px">' + (D.dokter.length ? D.dokter.map(s => '<div class="row" style="justify-content:space-between"><div><b>' + esc(s.dokter) + '</b><div class="sm muted">' + esc(s.spesialis || '') + (s.ruang ? ' · ' + esc(s.ruang) : '') + '</div></div><span class="chip' + (s.jumlah ? ' gold' : '') + '">' + s.jumlah + ' pasien</span></div>').join('') : '<div class="muted">Belum ada dokter aktif.</div>') + '</div></div>' +
      '<div class="card"><div class="hd"><h3>Rekap pagi untuk asisten</h3></div><div class="bd col"><div class="sm muted">Daftar pasien hari ini beserta jadwal asisten, siap dikirim ke grup.</div><a class="btn gold" href="#/rekap">' + ic('list', 16) + ' Buka Rekap Hari Ini</a></div></div></div></div>';
    if (fiturLama()) setBadge(k.menungguTotal);
  };
  const rerender = () => { render(); };
  pasangAksiBaris(el, () => (D ? D.rows.concat(D.menunggu) : []), () => { invalidateCache(); load(); });
  const load = async () => { await swr('dash:' + tgl, 'dashboard', { tanggal: tgl }, (d, dariCache) => { if (!ctx.alive()) return; D = d; render(); }, { guard: ctx.alive }); };
  $('#dprev').onclick = () => { tgl = addDays(tgl, -1); load(); }; $('#dnext').onclick = () => { tgl = addDays(tgl, 1); load(); }; $('#dtoday').onclick = () => { tgl = todayStr(); load(); };
  if (App.boot && App.boot.dashboard && App.boot.dashboard.tanggal === tgl && !LS.get('c:' + App.user.username + ':dash:' + tgl)) { D = App.boot.dashboard; render(); }
  const iv = setInterval(() => { if (document.visibilityState === 'visible') api('dashboard', { tanggal: tgl }).then(j => { if (j.success && ctx.alive()) { D = j.data; render(); } }); }, 45000);
  ctx.onLeave(() => clearInterval(iv)); load();
} });

// ---------- FORM PENDAFTARAN ----------
page('/daftar', { title: 'Pendaftaran Baru', async render(el, p, q, ctx) {
  const S = { kunj: 'Appointment', tgl: todayStr(), slot: null, mode: 'lama', pasien: null, slots: [], reqId: uid(), busy: false };
  const jenis = (App.boot.referensi['Jenis Pasien'] || ['Umum']);
  el.innerHTML = '<div class="ph"><div><h1>Pendaftaran Baru</h1><div class="sub">Isi dari atas ke bawah.<span class="deskonly"> <kbd>F3</kbd> cari pasien · <kbd>F4</kbd> simpan · <kbd>Esc</kbd> kosongkan</span></div></div></div><div class="grid" style="grid-template-columns:minmax(0,1fr) 340px;align-items:start" id="dg"><div class="col" style="gap:16px">' +
    '<div class="card pad"><div class="row wrap" style="justify-content:space-between"><div><div class="lbl">1 · Jenis kunjungan</div><div class="seg mt" style="margin-top:6px" id="sk"><button data-k="Appointment" class="on">Appointment</button><button data-k="Onsite">Onsite (langsung datang)</button></div></div><div class="f" style="min-width:210px"><label>Tanggal kunjungan</label><input class="in" type="date" id="ft" value="' + S.tgl + '" min="' + (isAdmin() ? '' : todayStr()) + '"></div></div><div class="hint" style="margin-top:8px" id="th"></div></div>' +
    '<div class="card pad"><div class="lbl">2 · Dokter & jam kunjungan</div><div class="f" style="max-width:220px;margin-top:10px"><label for="fjam">Jam kunjungan (WIB) <i>*</i></label><input class="in" type="time" id="fjam" step="60"></div><div class="hint" id="jh" style="margin:6px 0 10px">Jam bebas sesuai kesepakatan dengan pasien.</div><div class="slotg" id="sg">' + skel(2, 70) + '</div></div>' +
    '<div class="card pad"><div class="row wrap" style="justify-content:space-between"><div class="lbl">3 · Data pasien</div><div class="seg" id="sm"><button data-m="lama" class="on">' + ic('search', 14) + ' Pasien terdaftar</button><button data-m="baru">' + ic('star', 14) + ' Pasien baru (kartu SASA)</button></div></div><div id="pb" class="mt" style="margin-top:14px"></div></div>' +
    '<div class="card pad"><div class="lbl">4 · Penjamin & catatan</div><div class="fg mt" style="margin-top:10px"><div class="f"><label for="fj">Jenis pasien / penjamin <i>*</i></label><select class="in" id="fj">' + opt(jenis, '', 'Pilih…') + '</select></div><div class="f"><label for="fc">Catatan</label><input class="in" id="fc" maxlength="500" placeholder="Opsional, mis. keluhan / permintaan khusus"></div></div></div>' +
    '<div class="row" style="justify-content:flex-end;gap:10px"><button class="btn" id="fr">Kosongkan</button><button class="btn gold" id="fs" style="min-width:200px;min-height:46px">' + ic('check', 18) + ' Simpan pendaftaran <kbd class="deskonly" style="margin-left:4px">F4</kbd></button></div></div>' +
    '<aside class="rail" id="rail"></aside></div>';
  if (window.innerWidth < 1000) $('#dg').style.gridTemplateColumns = '1fr';
  const bagianPasien = () => {
    const pb = $('#pb');
    if (S.mode === 'lama') {
      pb.innerHTML = S.pasien ? '<div class="card" style="background:var(--gold-soft);border-color:#E7D5A7;padding:14px 16px"><div class="row"><div class="grow"><div class="b" style="font-size:16px">' + esc(S.pasien.nama) + '</div><div class="sm muted">RM ' + esc(S.pasien.rm) + (S.pasien.nik ? ' · NIK ' + esc(S.pasien.nik) : '') + '</div></div><button class="btn sm" id="pg">Ganti</button></div></div><div class="fg mt" style="margin-top:12px"><div class="f"><label>No. WhatsApp <i>*</i></label><input class="in" id="pp-hp" value="' + esc(S.pasien.hp) + '" inputmode="tel"></div><div class="f"><label>Email</label><input class="in" id="pp-em" type="email" value="' + esc(S.pasien.email || '') + '"></div><div class="f full"><label>Alamat</label><input class="in" id="pp-al" value="' + esc(S.pasien.alamat || '') + '"></div></div><div class="hint">Perubahan kontak di atas akan memperbarui data pasien.</div>'
        : '<div class="f" style="position:relative"><label for="ps">Cari nama, No. RM, NIK, atau No. HP</label><input class="in" id="ps" placeholder="Ketik minimal 2 huruf…" autocomplete="off"><div class="sugg hide" id="sg2" role="listbox"></div></div><div class="hint" style="margin-top:8px">Belum terdaftar? Pilih tab <b>Pasien baru</b> di atas — pasien baru otomatis mendapat kartu SASA.</div>';
      if (!S.pasien) pasangCari();
    } else pb.innerHTML = '<div class="fg"><div class="f full"><label for="pn">Nama lengkap <i>*</i></label><input class="in" id="pn" autocomplete="off" maxlength="100"></div><div class="f"><label for="ph">No. WhatsApp <i>*</i></label><input class="in" id="ph" inputmode="tel" placeholder="08xxxxxxxxxx"></div><div class="f"><label for="pk">NIK (16 digit)</label><input class="in" id="pk" inputmode="numeric" maxlength="16"></div><div class="f"><label for="pt">Tanggal lahir</label><input class="in" id="pt" type="date" max="' + todayStr() + '"></div><div class="f"><label for="pj">Jenis kelamin</label><select class="in" id="pj"><option value="">—</option><option>Laki-laki</option><option>Perempuan</option></select></div><div class="f"><label for="pe">Email</label><input class="in" id="pe" type="email"></div><div class="f"><label for="pr">No. RM (kosongkan untuk otomatis)</label><input class="in" id="pr" maxlength="30"></div><div class="f full"><label for="pa">Alamat</label><input class="in" id="pa" maxlength="200"></div></div>';
    const g = $('#pg'); if (g) g.onclick = () => { S.pasien = null; bagianPasien(); setTimeout(() => $('#ps') && $('#ps').focus(), 30); };
  };
  function pasangCari() {
    const inp = $('#ps'), box = $('#sg2'); let items = [], idx = -1;
    const tampil = () => { box.classList.toggle('hide', !items.length && inp.value.trim().length < 2); box.innerHTML = items.length ? items.map((x, i) => '<button type="button" data-i="' + i + '" class="' + (i === idx ? 'on' : '') + '"><div class="b">' + esc(x.nama) + (x.sasa ? ' <span class="chip gold">SASA</span>' : '') + '</div><div class="sm muted">RM ' + esc(x.rm) + ' · ' + esc(x.hp) + (x.nik ? ' · NIK ' + esc(x.nik) : '') + '</div></button>').join('') : '<div class="empty" style="padding:14px">Tidak ditemukan. Daftarkan sebagai pasien baru.</div>'; };
    const cari = debounce(async () => { const v = inp.value.trim(); if (v.length < 2) { items = []; return tampil(); } const j = await api('pasien.search', { q: v }); if (j.success && inp.value.trim() === v) { items = j.data.slice(0, 8); idx = items.length ? 0 : -1; tampil(); } }, 220);
    const pilih = i => { S.pasien = items[i]; bagianPasien(); ringkas(); };
    inp.oninput = cari; box.onclick = e => { const b = e.target.closest('[data-i]'); if (b) pilih(+b.dataset.i); };
    inp.onkeydown = e => { if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); tampil(); e.preventDefault(); } else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); tampil(); e.preventDefault(); } else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); pilih(idx); } };
  }
  const muatSlot = async () => {
    const g = $('#sg'); S.slot = null; ringkas(); $('#th').textContent = tglHari(S.tgl);
    await swr('slot:' + S.tgl, 'slot', { tanggal: S.tgl }, d => { if (!ctx.alive() || d.tanggal !== S.tgl) return; S.slots = d.slot; const keep = S.slot; renderSlot(); }, { guard: () => ctx.alive() && true });
  };
  const renderSlot = () => {
    const g = $('#sg'); if (!S.slots.length) { g.innerHTML = '<div class="muted" style="grid-column:1/-1;padding:10px 0">Belum ada dokter aktif. Tambahkan dokter di menu Dokter.</div>'; return; }
    g.innerHTML = S.slots.map((s, i) => '<button type="button" class="slot' + (S.slot === s.dokterId ? ' on' : '') + '" data-i="' + i + '"><div class="dn">' + esc(s.dokter) + '</div><div class="ds">' + esc(s.spesialis || '') + (s.ruang ? ' · ' + esc(s.ruang) : '') + '</div><div class="row" style="margin-top:6px"><span class="chip' + (s.jumlah ? ' gold' : '') + '">' + ic('clock', 12) + ' ' + s.jumlah + ' pasien' + (s.jam.length ? ' · ' + esc([...new Set(s.jam)].join(', ')) : '') + '</span></div></button>').join('');
  };
  const ringkas = () => {
    if (S.hasil) return;
    const s = S.slots.find(x => x.dokterId === S.slot); const jm = $('#fjam') && $('#fjam').value; const nama = S.mode === 'lama' ? (S.pasien && S.pasien.nama) : ($('#pn') && $('#pn').value.trim());
    $('#rail').innerHTML = S.hasil ? '' : '<div class="ticket"><div class="k">Ringkasan pendaftaran</div><div class="tcode" style="margin:6px 0 0">' + (S.kunj === 'Onsite' ? 'ONSITE' : 'BOOKING') + '</div><dl><dt>Pasien</dt><dd>' + esc(nama || '—') + '</dd><dt>Status</dt><dd>' + (S.mode === 'baru' ? 'Baru · kartu SASA' : 'Pasien lama') + '</dd><dt>Dokter</dt><dd>' + esc(s ? s.dokter : '—') + '</dd><dt>Tanggal</dt><dd>' + esc(tglIndo(S.tgl)) + '</dd><dt>Jam</dt><dd>' + esc(jm ? jm + ' WIB' : '—') + '</dd></dl></div>' + (S.kunj === 'Appointment' ? '<p class="hint" style="margin-top:10px">Setelah disimpan, bukti booking bisa langsung dikirim ke pasien lewat WhatsApp.</p>' : '<p class="hint" style="margin-top:10px">Pasien Onsite dicatat untuk hari ini dengan jam sekarang.</p>');
  };
  const kosongkan = () => { S.slot = null; S.pasien = null; S.hasil = null; S.reqId = uid(); $('#fj').value = ''; $('#fc').value = ''; $('#fjam').value = S.kunj === 'Onsite' ? jamNow() : ''; bagianPasien(); renderSlot(); ringkas(); };
  el.addEventListener('click', e => {
    if (S.hasil && e.target.closest('#sk,#sm,#sg')) { S.hasil = null; S.reqId = uid(); }
    const k = e.target.closest('#sk [data-k]'); if (k) { S.kunj = k.dataset.k; $$('#sk button').forEach(b => b.classList.toggle('on', b === k)); if (S.kunj === 'Onsite') { S.tgl = todayStr(); $('#ft').value = S.tgl; $('#ft').disabled = true; $('#fjam').value = jamNow(); muatSlot(); } else $('#ft').disabled = false; ringkas(); }
    const m = e.target.closest('#sm [data-m]'); if (m) { S.mode = m.dataset.m; $$('#sm button').forEach(b => b.classList.toggle('on', b === m)); bagianPasien(); ringkas(); if (S.mode === 'baru') $('#pn').addEventListener('input', debounce(ringkas, 200)); }
    const s = e.target.closest('#sg [data-i]'); if (s && !s.disabled) { const x = S.slots[+s.dataset.i]; S.slot = x.dokterId; renderSlot(); ringkas(); }
  });
  $('#ft').onchange = () => { if (S.hasil) { S.hasil = null; S.reqId = uid(); } S.tgl = $('#ft').value; if (S.tgl) muatSlot(); };
  $('#fjam').oninput = ringkas;
  $('#fr').onclick = kosongkan;
  const simpan = async () => {
    if (S.busy) return; clearErr(el);
    const s = S.slots.find(x => x.dokterId === S.slot); if (!s) { toast('Pilih dokter terlebih dahulu.', 'err'); return $('#sg').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test($('#fjam').value)) return fieldErr($('#fjam'), 'Isi jam kunjungan (contoh 14:30).');
    if (!$('#fj').value) return fieldErr($('#fj'), 'Pilih jenis pasien / penjamin.');
    const d = { kunjungan: S.kunj, tanggal: S.tgl, jam: $('#fjam').value, dokterId: s.dokterId, jenisPasien: $('#fj').value, catatan: $('#fc').value.trim(), mode: S.mode };
    if (S.mode === 'lama') {
      if (!S.pasien) { toast('Cari dan pilih pasien terlebih dahulu.', 'err'); return $('#ps') && $('#ps').focus(); }
      const h = $('#pp-hp').value, em = $('#pp-em').value.trim(); if (!hpOk(h)) return fieldErr($('#pp-hp'), 'Nomor WhatsApp tidak valid (contoh 0812xxxxxxxx).'); if (em && !emailOk(em)) return fieldErr($('#pp-em'), 'Format email tidak valid.');
      d.pasienId = S.pasien.id; d.pasien = { hp: h, email: em, alamat: $('#pp-al').value.trim() };
    } else {
      const n = $('#pn').value.trim(), h = $('#ph').value, k = $('#pk').value.trim(), em = $('#pe').value.trim();
      if (n.length < 3) return fieldErr($('#pn'), 'Nama lengkap wajib diisi.'); if (!hpOk(h)) return fieldErr($('#ph'), 'Nomor WhatsApp tidak valid (contoh 0812xxxxxxxx).');
      if (k && !nikOk(k)) return fieldErr($('#pk'), 'NIK harus 16 digit angka.'); if (em && !emailOk(em)) return fieldErr($('#pe'), 'Format email tidak valid.');
      d.pasien = { nama: n, hp: h, nik: k, tglLahir: $('#pt').value, jk: $('#pj').value, email: em, rm: $('#pr').value.trim(), alamat: $('#pa').value.trim() };
    }
    S.busy = true; const b = $('#fs'); btnBusy(b, true);
    const j = await tulis('daftar.save', d, { reqId: S.reqId }); S.busy = false; btnBusy(b, false);
    if (!j) { if (S.slot) muatSlot(); return; }
    invalidateCache(); const bk = j.data.booking; S.hasil = bk;
    $('#rail').innerHTML = '<div class="ticket"><div class="k">Pendaftaran tersimpan ' + ic('checkc', 14) + '</div><div class="tcode">' + esc(bk.id) + '</div><dl><dt>Pasien</dt><dd>' + esc(bk.nama) + '</dd><dt>No. RM</dt><dd>' + esc(bk.rm) + '</dd><dt>Dokter</dt><dd>' + esc(bk.dokter) + '</dd><dt>Jadwal</dt><dd>' + esc(tglIndo(bk.tgl, true) + ' · ' + jamTxt(bk) + ' WIB') + '</dd>' + (bk.sasa === 'Sasa' ? '<dt>Kartu</dt><dd style="color:var(--gold-h)">SASA baru ★</dd>' : '') + '</dl></div><div class="col" style="margin-top:12px"><button class="btn gold blk" id="r-wa" style="min-height:48px">' + ic('wa', 18) + ' Kirim bukti ke WhatsApp</button><button class="btn blk" id="r-pdf">' + ic('file', 16) + ' Unduh PDF</button><button class="btn blk" id="r-cp">' + ic('copy', 16) + ' Salin pesan</button><button class="btn blk ghost" id="r-new">' + ic('plus', 16) + ' Pendaftaran berikutnya</button></div>';
    $('#r-wa').onclick = ev => bagikanBukti(bk, ev.currentTarget); $('#r-pdf').onclick = ev => cetakBukti(bk, ev.currentTarget); $('#r-cp').onclick = () => copyText(pesanBukti(bk)); $('#r-new').onclick = () => { kosongkan(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    if (window.innerWidth < 1000) $('#rail').scrollIntoView({ behavior: 'smooth' });
    S.slots = []; muatSlot();
  };
  $('#fs').onclick = simpan;
  const key = e => { if (e.key === 'F3') { e.preventDefault(); if (S.mode === 'lama' && !S.pasien) $('#ps') && $('#ps').focus(); else if (S.mode === 'baru') $('#pn').focus(); } else if (e.key === 'F4') { e.preventDefault(); simpan(); } else if (e.key === 'Escape' && !$('.mod')) { kosongkan(); } };
  document.addEventListener('keydown', key); ctx.onLeave(() => document.removeEventListener('keydown', key));
  bagianPasien(); ringkas(); muatSlot();
} });
