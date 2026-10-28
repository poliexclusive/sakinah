// pages-e.js — Rekap Hari Ini: daftar pasien + jadwal asisten, siap dibagikan ke grup (gambar + teks)
const addHari = (t, n) => { const p = String(t).split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.toISOString().slice(0, 10); };
const Rekap = (function () {
  const kunciAs = tgl => 'px1:asisten:' + tgl;
  function asistenBawaan() { try { const a = JSON.parse((App.boot.config && App.boot.config.asisten) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function asistenHari(tgl) { try { const s = localStorage.getItem(kunciAs(tgl)); if (s) return JSON.parse(s); } catch (e) { /* abaikan */ } return asistenBawaan().map(x => ({ nama: x.nama, jam: x.jam })); }
  function simpanAsistenHari(tgl, a) { try { localStorage.setItem(kunciAs(tgl), JSON.stringify(a)); } catch (e) { /* abaikan */ } }
  const tarikSesi = r => (r.jam ? (r.jam < '13:00' ? 'Pagi' : 'Sore') : r.sesi);
  const jamR = r => r.jam || r.sesi || '';
  const tglPendek = t => { const p = String(t).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };

  function teks(tgl, as) {
    const nm = n => '@' + String(n).replace(/^@/, '');
    return 'Poli exclusive\n' + hariDari(tgl) + ' ' + tglIndo(tgl) + '\n\n\nAssisten\n' + as.filter(a => a.nama).map(a => '• ' + nm(a.nama) + ' : jam ' + a.jam).join('\n');
  }

  /** Gambar tabel ala spreadsheet (Sasa/Lama, Tanggal, Pagi, Sore, Dokter, Pasien). */
  async function gambar(tgl, rows) {
    try { await Promise.all(['600 20px "EB Garamond"', '500 14px "EB Garamond"'].map(f => document.fonts.load(f))); } catch (e) { /* font cadangan */ }
    const S = 2, kol = [{ h: 'Tanggal', w: 104 }, { h: 'Pagi', w: 84 }, { h: 'Sore', w: 84 }, { h: 'Dokter', w: 240 }, { h: 'Pasien', w: 250 }, { h: 'Catatan', w: 238 }];
    const W = kol.reduce((a, k) => a + k.w, 0), RH = 30, TH = 52, HH = 28, H = TH + HH + Math.max(rows.length, 1) * RH + 1;
    const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S; const c = cv.getContext('2d'); c.scale(S, S);
    const SERIF = '"EB Garamond", "Times New Roman", Georgia, serif';
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#0B192C'); g.addColorStop(1, '#14284A'); c.fillStyle = g; c.fillRect(0, 0, W, TH);
    c.fillStyle = '#C5A059'; c.fillRect(0, TH - 2, W, 2);
    c.textBaseline = 'middle'; c.fillStyle = '#C5A059'; c.font = '600 20px ' + SERIF; c.textAlign = 'left'; c.fillText('POLI EXCLUSIVE', 16, TH / 2 - 2);
    c.fillStyle = '#F4EBD3'; c.font = '500 14px ' + SERIF; c.textAlign = 'right'; c.fillText(hariDari(tgl) + ', ' + tglIndo(tgl) + ' · ' + rows.length + ' pasien', W - 16, TH / 2 - 2);
    let x = 0; c.fillStyle = '#EFE6CF'; c.fillRect(0, TH, W, HH);
    c.fillStyle = '#0B192C'; c.font = '600 13px ' + SERIF; c.textAlign = 'center'; kol.forEach(k => { c.fillText(k.h, x + k.w / 2, TH + HH / 2); x += k.w; });
    rows.forEach((r, i) => {
      const y = TH + HH + i * RH, ses = tarikSesi(r), cells = [tglPendek(r.tgl), ses === 'Pagi' ? jamR(r) : '', ses === 'Sore' ? jamR(r) : '', r.dokter, String(r.nama).toUpperCase(), String(r.catatan || '').replace(/\s+/g, ' ')];
      let cx = 0; kol.forEach((k, j) => {
        if (j === 1 && cells[j]) { c.fillStyle = '#A9EBA0'; c.fillRect(cx, y, k.w, RH); }
        if (j === 2 && cells[j]) { c.fillStyle = '#FFE680'; c.fillRect(cx, y, k.w, RH); }
        c.fillStyle = '#111'; c.font = (j >= 1 && j <= 2 && cells[j] ? '600 ' : '500 ') + '14px ' + SERIF; c.textAlign = j >= 3 ? 'left' : 'center';
        let t = cells[j]; const px = j >= 3 ? cx + 8 : cx + k.w / 2, mx = k.w - 14; if (j >= 3) { while (t.length > 1 && c.measureText(t).width > mx) t = t.slice(0, -1); }
        c.fillText(t, px, y + RH / 2 + 1); cx += k.w;
      });
    });
    c.strokeStyle = '#7B8494'; c.lineWidth = 1; c.beginPath();
    const n = Math.max(rows.length, 1);
    for (let i = 0; i <= n + 1; i++) { const y = TH + (i === 0 ? 0 : HH + (i - 1) * RH) + .5; c.moveTo(0, y); c.lineTo(W, y); }
    x = 0; for (let j = 0; j <= kol.length; j++) { c.moveTo(x + .5, TH); c.lineTo(x + .5, H); x += (kol[j] || { w: 0 }).w; }
    c.stroke();
    if (!rows.length) { c.fillStyle = '#6B7280'; c.font = 'italic 500 14px ' + SERIF; c.textAlign = 'center'; c.fillText('Belum ada pendaftaran', W / 2, TH + HH + RH / 2); }
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }

  page('/rekap', { title: 'Rekap Hari Ini', async render(el, p, q, ctx) {
    const S = { tgl: todayStr(), rows: [], as: [] };
    el.innerHTML = '<div class="ph"><div><h1>Rekap Hari Ini</h1><div class="sub">Daftar pasien dan jadwal asisten, siap dikirim ke grup.</div></div><div class="act"><div class="seg"><button id="rp" aria-label="Hari sebelumnya">' + ic('left', 16) + '</button><button id="rt">Hari ini</button><button id="rn" aria-label="Hari berikutnya">' + ic('right', 16) + '</button></div><input class="in" type="date" id="rd" style="width:auto"></div></div>' +
      '<div class="grid g12"><div class="card"><div class="hd"><h3 id="rh">Pasien terdaftar</h3><span class="chip gold" id="rc"></span></div><div id="rtb">' + skel(4, 22) + '</div></div>' +
      '<div class="col"><div class="card"><div class="hd"><h3>Asisten</h3><button class="btn sm" id="ra">' + ic('plus', 14) + ' Tambah</button></div><div class="bd col" id="rl"></div><div class="bd row wrap" style="padding-top:0;gap:8px"><button class="btn sm" id="rd0">Kembalikan bawaan</button>' + (isAdmin() ? '<button class="btn sm" id="rsb">Simpan sebagai bawaan</button>' : '') + '</div></div>' +
      '<div class="card"><div class="hd"><h3>Pesan</h3></div><div class="bd col"><textarea class="in" id="rtx" rows="9"></textarea><button class="btn gold blk" id="rsh" style="min-height:46px">' + ic('wa', 18) + ' Bagikan ke grup</button><div class="row" style="gap:8px"><button class="btn grow" id="rim">' + ic('file', 15) + ' Unduh gambar</button><button class="btn grow" id="rcp">' + ic('copy', 15) + ' Salin teks</button></div></div></div></div></div>';
    $('#rd').value = S.tgl;
    const sync = () => { $('#rtx').value = teks(S.tgl, S.as); };
    const lis = () => { $('#rl').innerHTML = S.as.length ? S.as.map((a, i) => '<div style="display:grid;grid-template-columns:1fr 1fr 34px;gap:6px;align-items:center"><input class="in" style="padding:0 8px;font-size:13px;min-width:0" data-n="' + i + '" value="' + esc(a.nama) + '" placeholder="Nama"><input class="in" data-j="' + i + '" value="' + esc(a.jam) + '" placeholder="07.00-09.00" style="padding:0 8px;font-size:13px;min-width:0"><button class="btn sm ico" data-x="' + i + '" aria-label="Hapus">' + ic('x', 14) + '</button></div>').join('') : '<div class="muted sm">Belum ada asisten.</div>'; };
    const tabel = () => {
      $('#rc').textContent = S.rows.length + ' pasien';
      $('#rtb').innerHTML = S.rows.length ? '<div class="tw"><table class="t"><thead><tr><th>Tanggal</th><th>Pagi</th><th>Sore</th><th>Dokter</th><th>Pasien</th><th>Catatan</th></tr></thead><tbody>' + S.rows.map(r => { const s = tarikSesi(r); return '<tr class="cl" data-open="' + esc(r.id) + '"><td class="nowrap">' + esc(tglPendek(r.tgl)) + '</td><td class="b" style="' + (s === 'Pagi' ? 'background:#C9F3C2' : '') + '">' + (s === 'Pagi' ? esc(jamR(r)) : '') + '</td><td class="b" style="' + (s === 'Sore' ? 'background:#FFEFA0' : '') + '">' + (s === 'Sore' ? esc(jamR(r)) : '') + '</td><td>' + esc(r.dokter) + '</td><td class="b">' + esc(String(r.nama).toUpperCase()) + (r.sasa === 'Sasa' ? ' <span class="chip gold">SASA</span>' : '') + '</td><td class="muted">' + esc(r.catatan || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">' + ic('calendar', 34) + '<p>Belum ada pendaftaran pada tanggal ini.</p></div>';
    };
    const muat = async () => {
      $('#rd').value = S.tgl; $('#rh').textContent = hariDari(S.tgl) + ', ' + tglIndo(S.tgl);
      S.as = asistenHari(S.tgl); lis(); sync();
      const j = await api('rekap', { tanggal: S.tgl }); if (!ctx.alive()) return; if (!j.success) return renderError(j.message);
      S.rows = j.data.rows; tabel();
    };
    const pindah = n => { S.tgl = n; muat(); };
    $('#rp').onclick = () => pindah(addHari(S.tgl, -1)); $('#rn').onclick = () => pindah(addHari(S.tgl, 1)); $('#rt').onclick = () => pindah(todayStr()); $('#rd').onchange = e => { if (e.target.value) pindah(e.target.value); };
    el.addEventListener('input', e => {
      const n = e.target.dataset.n, j = e.target.dataset.j;
      if (n !== undefined) S.as[+n].nama = e.target.value; else if (j !== undefined) S.as[+j].jam = e.target.value; else return;
      simpanAsistenHari(S.tgl, S.as); sync();
    });
    el.addEventListener('click', async e => {
      const op = e.target.closest('tr[data-open]'); if (op && !e.target.closest('button,a,input')) { const r = S.rows.find(x => x.id === op.dataset.open); if (r) bukaDetail(r, () => muat()); return; }
    const x = e.target.closest('[data-x]'); if (x) { S.as.splice(+x.dataset.x, 1); simpanAsistenHari(S.tgl, S.as); lis(); sync(); return; }
      if (e.target.closest('#ra')) { S.as.push({ nama: '', jam: '' }); simpanAsistenHari(S.tgl, S.as); lis(); sync(); const k = $$('[data-n]', el); if (k.length) k[k.length - 1].focus(); return; }
      if (e.target.closest('#rd0')) { try { localStorage.removeItem(kunciAs(S.tgl)); } catch (er) { /* abaikan */ } S.as = asistenHari(S.tgl); lis(); sync(); return; }
      if (e.target.closest('#rsb')) { const b = e.target.closest('#rsb'); btnBusy(b, true); const j = await tulis('config.save', { ASISTEN: JSON.stringify(S.as.filter(a => a.nama)) }); btnBusy(b, false); if (j) await refreshBoot(); return; }
      if (e.target.closest('#rcp')) return copyText($('#rtx').value);
      const im = e.target.closest('#rim'), sh = e.target.closest('#rsh');
      if (im || sh) {
        const b = im || sh; btnBusy(b, true);
        try {
          const blob = await gambar(S.tgl, S.rows), nama = 'Rekap_Poli_Exclusive_' + S.tgl + '.png', file = new File([blob], nama, { type: 'image/png' });
          if (sh && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: $('#rtx').value }); btnBusy(b, false); return; } catch (er) { if (er && er.name === 'AbortError') { btnBusy(b, false); return; } } }
          unduh(nama, blob); if (sh) { copyText($('#rtx').value); toast('Gambar diunduh dan teks disalin. Tempel di grup WhatsApp.', 'ok'); }
        } catch (er) { toast('Gagal membuat gambar: ' + (er && er.message || er), 'err'); }
        btnBusy(b, false);
      }
    });
    muat();
  } });
  return { gambar: gambar, teks: teks };
})();
