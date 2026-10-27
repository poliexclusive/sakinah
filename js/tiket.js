// tiket.js — Booking Confirmation ala boarding pass (kanvas → JPEG → PDF 612×198 pt)
// Dibuat di browser: instan, tanpa Google Docs, QR vektor tajam. Tidak butuh pustaka luar.
const Tiket = (function () {
  const W = 612, H = 198, S = 4;                       // satuan pt; S = faktor resolusi kanvas
  const NAVY = '#0B192C', NAVY2 = '#14284A', GOLD = '#C5A059', GOLD_D = '#8F6F2F', IVORY = '#FBF8F1';
  const SERIF = '"EB Garamond", "Cormorant Garamond", Georgia, serif', SANS = 'Manrope, "Segoe UI", Arial, sans-serif';

  const muatGambar = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  async function siapFont() {
    try { await Promise.all(['600 24px "EB Garamond"', '500 12px "EB Garamond"', '500 10px Manrope', '700 10px Manrope', '800 10px Manrope'].map(f => document.fonts.load(f))); } catch (e) { /* pakai font cadangan */ }
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function teks(c, s, x, y, font, warna, o) {
    o = o || {}; c.font = font; c.fillStyle = warna; c.textAlign = o.align || 'left'; c.textBaseline = 'alphabetic';
    if ('letterSpacing' in c) c.letterSpacing = (o.ls || 0) + 'px';
    c.fillText(s, x, y);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  }
  function muat(c, s, maks, font) { c.font = font; if (c.measureText(s).width <= maks) return s; while (s.length > 1 && c.measureText(s + '…').width > maks) s = s.slice(0, -1); return s + '…'; }
  function gambarCover(c, im, x, y, w, h) { const k = Math.max(w / im.width, h / im.height), iw = w / k, ih = h / k; c.drawImage(im, (im.width - iw) / 2, (im.height - ih) * .45, iw, ih, x, y, w, h); }

  /** d: { nama, rm, tgl (YYYY-MM-DD), jam, alamat, dokter, id, kode, verifUrl } */
  async function gambar(d, aset) {
    await siapFont();
    const [lobi, logo] = aset || await Promise.all([muatGambar('img/lobi.jpg'), muatGambar('img/logo-rs.png')]);
    const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    const c = cv.getContext('2d'); c.scale(S, S); c.imageSmoothingQuality = 'high';

    // kartu
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    c.save(); rr(c, 0, 0, W, H, 12); c.clip();
    c.fillStyle = IVORY; c.fillRect(0, 0, W, H);

    // foto lobi di sisi kanan + gradasi lembut agar teks tetap terbaca
    const fx = 214;
    if (lobi) {
      c.save(); c.beginPath(); c.rect(fx, 0, W - fx, H); c.clip(); gambarCover(c, lobi, fx, 0, W - fx, H); c.restore();
      const g = c.createLinearGradient(fx, 0, W, 0);
      g.addColorStop(0, 'rgba(251,248,241,1)'); g.addColorStop(.30, 'rgba(251,248,241,.94)'); g.addColorStop(.72, 'rgba(251,248,241,.70)'); g.addColorStop(1, 'rgba(251,248,241,.48)');
      c.fillStyle = g; c.fillRect(fx, 0, W - fx, H);
    }

    // strip kiri navy + dekorasi diagonal emas
    const sw = 36;
    const gs = c.createLinearGradient(0, 0, 0, H); gs.addColorStop(0, NAVY2); gs.addColorStop(1, NAVY);
    c.fillStyle = gs; c.fillRect(0, 0, sw, H);
    c.save(); c.beginPath(); c.rect(0, 0, sw, H); c.clip();
    [[0, .55], [9, .32], [18, .18]].forEach(function (p) {
      c.fillStyle = 'rgba(197,160,89,' + p[1] + ')'; c.beginPath();
      c.moveTo(0, 26 + p[0]); c.lineTo(sw, 2 + p[0]); c.lineTo(sw, 10 + p[0]); c.lineTo(0, 34 + p[0]); c.closePath(); c.fill();
    });
    c.restore();
    c.fillStyle = GOLD; c.fillRect(sw, 0, 1.6, H);
    c.save(); c.translate(sw / 2 + 4.5, H / 2 + 22); c.rotate(-Math.PI / 2);
    teks(c, 'POLI EXCLUSIVE', 0, 0, '800 11.5px ' + SANS, GOLD, { align: 'center', ls: 2.6 }); c.restore();

    // judul
    const x1 = 56;
    teks(c, 'Booking Confirmation', x1, 36, '600 23px ' + SERIF, NAVY, { ls: .3 });
    const gl = c.createLinearGradient(x1, 0, x1 + 150, 0); gl.addColorStop(0, GOLD); gl.addColorStop(1, 'rgba(197,160,89,0)');
    c.fillStyle = gl; c.fillRect(x1, 43, 150, 1.4);

    // logo RS (di atas panel putih tembus pandang)
    if (logo) {
      const lw = 156, lh = lw * logo.height / logo.width, lx = W - lw - 22, ly = 12;
      c.save(); c.shadowColor = 'rgba(11,25,44,.18)'; c.shadowBlur = 8; c.shadowOffsetY = 1.5; c.fillStyle = 'rgba(255,255,255,.93)'; rr(c, lx - 8, ly - 5, lw + 16, lh + 10, 7); c.fill(); c.restore();
      c.drawImage(logo, lx, ly, lw, lh);
    }

    // data pasien
    const xa = x1, xb = 252, lab = '700 6.4px ' + SANS, val = '600 10.5px ' + SANS, ls = 1.1;
    const kol = (label, nilai, x, y, maks) => { teks(c, label, x, y, lab, GOLD_D, { ls: ls }); teks(c, muat(c, nilai || '-', maks, val), x, y + 13.5, val, NAVY); };
    const tglP = d.tgl ? new Date(d.tgl + 'T00:00:00') : null;
    const tglT = tglP ? String(tglP.getDate()).padStart(2, '0') + '/' + String(tglP.getMonth() + 1).padStart(2, '0') + '/' + tglP.getFullYear() : '-';
    kol('NAMA PASIEN', String(d.nama || '').toUpperCase(), xa, 76, 184);
    kol('NOMOR REKAM MEDIS', d.rm || '-', xa, 112, 184);
    kol('TANGGAL', tglT, xa, 148, 90); kol('PUKUL', d.jam ? d.jam + ' WIB' : '-', xa + 92, 148, 90);
    kol('ALAMAT', String(d.alamat || '').toUpperCase(), xb, 76, 190);
    kol('DOKTER SPESIALIS', d.dokter, xb, 112, 190);
    kol('KODE BOOKING', d.id, xb, 148, 190);

    // QR verifikasi
    const qz = 4, m = QR.matrix(d.verifUrl), n = m.length, q = 64, mx = W - q - 28, my = 66, cell = q / (n + qz * 2);
    c.save(); c.shadowColor = 'rgba(11,25,44,.22)'; c.shadowBlur = 9; c.shadowOffsetY = 2; c.fillStyle = '#fff'; rr(c, mx - 6, my - 6, q + 12, q + 12, 7); c.fill(); c.restore();
    c.strokeStyle = GOLD; c.lineWidth = .9; rr(c, mx - 6, my - 6, q + 12, q + 12, 7); c.stroke();
    c.fillStyle = NAVY; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) c.fillRect(mx + (x + qz) * cell - .02, my + (y + qz) * cell - .02, cell + .04, cell + .04);
    teks(c, 'SCAN UNTUK VERIFIKASI', mx + q / 2, my + q + 17, '700 5.6px ' + SANS, GOLD_D, { align: 'center', ls: .9 });

    // footer navy
    const fy = H - 25;
    const gf = c.createLinearGradient(0, 0, W, 0); gf.addColorStop(0, NAVY); gf.addColorStop(1, NAVY2);
    c.fillStyle = gf; c.fillRect(sw, fy, W - sw, 25); c.fillStyle = GOLD; c.fillRect(sw, fy, W - sw, 1);
    const fs = '600 7.2px ' + SANS;
    teks(c, '@rsisakinah_official   ·   rsisakinah.co.id   ·   @rsisakinahmojokerto', x1, fy + 10.6, fs, '#E9DDBF', { ls: .2 });
    teks(c, 'Mohon hadir 15 menit lebih awal dan membawa kartu identitas.', x1, fy + 20, '500 6.4px ' + SANS, 'rgba(233,221,191,.7)');
    teks(c, 'FREE PARKIR KHUSUS', W - 22, fy + 15, '800 8.2px ' + SANS, GOLD, { align: 'right', ls: 1.2 });
    c.restore();

    // bingkai emas tipis
    c.strokeStyle = 'rgba(197,160,89,.9)'; c.lineWidth = 1; rr(c, .5, .5, W - 1, H - 1, 12); c.stroke();
    return cv;
  }

  // ---- PDF 1 halaman berisi gambar JPEG ----
  function pdfDariJpeg(jpg, pw, ph) {
    const enc = new TextEncoder(), bagian = [], off = []; let len = 0;
    const tulis = x => { const b = typeof x === 'string' ? enc.encode(x) : x; bagian.push(b); len += b.length; };
    const obj = (i, isi) => { off[i] = len; tulis(i + ' 0 obj\n'); tulis(isi); tulis('\nendobj\n'); };
    tulis('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    off[4] = len; tulis('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + pw + ' /Height ' + ph + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'); tulis(jpg); tulis('\nendstream\nendobj\n');
    const isi = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q';
    obj(5, '<< /Length ' + isi.length + ' >>\nstream\n' + isi + '\nendstream');
    obj(6, '<< /Title (Booking Confirmation) /Producer (Poli Exclusive Sakinah) >>');
    const xr = len; let t = 'xref\n0 7\n0000000000 65535 f \n';
    for (let i = 1; i <= 6; i++) t += String(off[i]).padStart(10, '0') + ' 00000 n \n';
    tulis(t + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xr + '\n%%EOF');
    const out = new Uint8Array(len); let p = 0; bagian.forEach(b => { out.set(b, p); p += b.length; });
    return new Blob([out], { type: 'application/pdf' });
  }

  async function pdf(d, aset) {
    const cv = await gambar(d, aset);
    const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', .93));
    const jpg = new Uint8Array(await blob.arrayBuffer());
    return pdfDariJpeg(jpg, cv.width, cv.height);
  }
  return { gambar: gambar, pdf: pdf };
})();
