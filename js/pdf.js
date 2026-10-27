// pdf.js — penulis PDF mandiri: teks Helvetica (metrik AFM), tabel berhalaman, grafik vektor
const Pdf = (function () {
  const WR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  const WIN = { 8211: 0x96, 8212: 0x97, 8230: 0x85, 8226: 0x95, 8217: 0x92, 8216: 0x91, 8220: 0x93, 8221: 0x94, 10003: 118, 10004: 118, 8594: 62, 183: 0xB7 };
  const code = ch => { const c = ch.charCodeAt(0); if (c === 9) return 32; if (c >= 32 && c < 127) return c; if (c >= 160 && c < 256) return c; return WIN[c] || 63; };
  const cw = (c, bold) => (c >= 32 && c < 127 ? (bold ? WB : WR)[c - 32] : 556);
  const tw = (s, size, bold) => { let w = 0; for (const ch of String(s)) w += cw(code(ch), bold); return w * size / 1000; };
  const rgb = h => { h = (h || '#000000').replace('#', ''); return [0, 2, 4].map(i => (parseInt(h.substr(i, 2), 16) / 255).toFixed(3)).join(' '); };
  const f2 = n => (Math.round(n * 100) / 100).toString();
  function wrap(s, maxW, size, bold) {
    const out = [];
    String(s == null ? '' : s).split('\n').forEach(par => {
      const words = par.split(/\s+/).filter(Boolean); let line = '';
      if (!words.length) { out.push(''); return; }
      words.forEach(w => {
        while (tw(w, size, bold) > maxW && w.length > 1) { let k = w.length; while (k > 1 && tw(w.slice(0, k), size, bold) > maxW) k--; if (line) { out.push(line); line = ''; } out.push(w.slice(0, k)); w = w.slice(k); }
        const t = line ? line + ' ' + w : w;
        if (tw(t, size, bold) <= maxW) line = t; else { out.push(line); line = w; }
      }); out.push(line);
    }); return out;
  }
  class Doc {
    constructor(o) { o = o || {}; this.land = o.orientation === 'l'; this.W = this.land ? 841.89 : 595.28; this.H = this.land ? 595.28 : 841.89; this.m = o.margin || 40; this.pages = []; this.footer = o.footer || ''; this.addPage(); }
    get cw() { return this.W - 2 * this.m; }
    addPage() { this.ops = []; this.pages.push(this.ops); this.y = this.m; return this; }
    op(s) { this.ops.push(s); }
    setFill(c) { this.op(rgb(c) + ' rg'); } setStroke(c) { this.op(rgb(c) + ' RG'); }
    text(s, x, y, o) {
      o = o || {}; const size = o.size || 10, bold = !!o.bold; s = String(s == null ? '' : s);
      const w = tw(s, size, bold); if (o.align === 'right') x -= w; else if (o.align === 'center') x -= w / 2;
      let hex = ''; for (const ch of s) hex += code(ch).toString(16).padStart(2, '0');
      this.op('BT ' + rgb(o.color || '#0B192C') + ' rg /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + f2(x) + ' ' + f2(this.H - y - size * 0.78) + ' Td <' + hex + '> Tj ET'); return w;
    }
    rect(x, y, w, h, o) { o = o || {}; const p = f2(x) + ' ' + f2(this.H - y - h) + ' ' + f2(w) + ' ' + f2(h) + ' re'; if (o.fill) { this.op(rgb(o.fill) + ' rg ' + p + ' f'); } if (o.stroke) { this.op(rgb(o.stroke) + ' RG ' + (o.lw || 0.6) + ' w ' + p + ' S'); } }
    line(x1, y1, x2, y2, c, lw) { this.op(rgb(c || '#E2E8F0') + ' RG ' + (lw || 0.6) + ' w ' + f2(x1) + ' ' + f2(this.H - y1) + ' m ' + f2(x2) + ' ' + f2(this.H - y2) + ' l S'); }
    poly(pts, fill) { this.op(rgb(fill) + ' rg ' + pts.map((p, i) => f2(p[0]) + ' ' + f2(this.H - p[1]) + (i ? ' l' : ' m')).join(' ') + ' h f'); }
    need(h) { if (this.y + h > this.H - this.m - 14) this.addPage(); }
    kop(inst, alamat, judul, sub) {
      this.rect(0, 0, this.W, 74, { fill: '#0B192C' }); this.rect(0, 74, this.W, 3, { fill: '#C5A059' });
      this.text(inst, this.m, 20, { size: 17, bold: true, color: '#FFFFFF' }); this.text(alamat || '', this.m, 43, { size: 8.5, color: '#CBD5E1' });
      this.text('LAPORAN', this.W - this.m, 22, { size: 8, color: '#DFBA73', align: 'right', bold: true });
      this.y = 96; this.text(judul, this.m, this.y, { size: 16, bold: true }); this.y += 24; if (sub) { this.text(sub, this.m, this.y, { size: 9.5, color: '#64748B' }); this.y += 20; }
    }
    h2(s) { this.need(40); this.y += 8; this.rect(this.m, this.y + 1, 3, 13, { fill: '#C5A059' }); this.text(s, this.m + 9, this.y, { size: 12, bold: true }); this.y += 24; }
    para(s, o) { o = o || {}; const size = o.size || 9.5; wrap(s, this.cw, size, false).forEach(l => { this.need(size + 5); this.text(l, this.m, this.y, { size, color: o.color || '#334155' }); this.y += size + 4; }); this.y += 4; }
    kpis(items) {
      const n = items.length, gap = 10, w = (this.cw - gap * (n - 1)) / n; this.need(58);
      items.forEach((it, i) => { const x = this.m + i * (w + gap); this.rect(x, this.y, w, 50, { fill: '#F8FAFC', stroke: '#E2E8F0' }); this.rect(x, this.y, 3, 50, { fill: '#C5A059' });
        this.text(String(it.l).toUpperCase(), x + 12, this.y + 8, { size: 7, bold: true, color: '#64748B' }); this.text(String(it.v), x + 12, this.y + 21, { size: 19, bold: true }); });
      this.y += 64;
    }
    /** cols:[{h,w(0..1 bagian lebar),a:'r'|'l'|'c',bold}], rows: array of array */
    table(cols, rows, o) {
      o = o || {}; const size = o.size || 8.5, pad = 5, tot = cols.reduce((a, c) => a + (c.w || 1), 0), ws = cols.map(c => this.cw * (c.w || 1) / tot);
      const head = () => { this.need(26); this.rect(this.m, this.y, this.cw, 20, { fill: '#0B192C' }); let x = this.m; cols.forEach((c, i) => { this.text(c.h, c.a === 'r' ? x + ws[i] - pad : x + pad, this.y + 6, { size: 7.5, bold: true, color: '#FFFFFF', align: c.a === 'r' ? 'right' : 'left' }); x += ws[i]; }); this.y += 20; };
      head();
      rows.forEach((r, ri) => {
        const lines = r.map((v, i) => wrap(v, ws[i] - 2 * pad, size, cols[i].bold)), hh = Math.max.apply(null, lines.map(l => l.length)) * (size + 3) + 8;
        if (this.y + hh > this.H - this.m - 14) { this.addPage(); head(); }
        if (ri % 2) this.rect(this.m, this.y, this.cw, hh, { fill: '#F8FAFC' }); if (o.boldLast && ri === rows.length - 1) this.rect(this.m, this.y, this.cw, hh, { fill: '#F6EFDF' });
        let x = this.m; lines.forEach((l, i) => { l.forEach((ln, k) => this.text(ln, cols[i].a === 'r' ? x + ws[i] - pad : x + pad, this.y + 4 + k * (size + 3), { size, bold: cols[i].bold || (o.boldLast && ri === rows.length - 1), align: cols[i].a === 'r' ? 'right' : 'left', color: '#1E293B' })); x += ws[i]; });
        this.line(this.m, this.y + hh, this.m + this.cw, this.y + hh, '#E2E8F0'); this.y += hh;
      });
      if (!rows.length) { this.text('Tidak ada data.', this.m + pad, this.y + 6, { size: 9, color: '#64748B' }); this.y += 24; }
      this.y += 10;
    }
    bars(spec, h) {
      h = h || 170; this.need(h + 40); const x0 = this.m + 30, w = this.cw - 34, y0 = this.y + 6, ih = h - 30, n = spec.labels.length, S = spec.series;
      const sums = spec.labels.map((_, i) => spec.stacked ? S.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max.apply(null, S.map(s => s.values[i] || 0))), mx = Math.max.apply(null, sums.concat([1]));
      const p = Math.pow(10, Math.floor(Math.log10(mx))), fr = mx / p, top = (fr <= 1 ? 1 : fr <= 2 ? 2 : fr <= 5 ? 5 : 10) * p, steps = top >= 10 ? (top % 5 === 0 ? 5 : 4) : Math.min(top, 5);
      for (let i = 0; i <= steps; i++) { const v = top * i / steps, y = y0 + ih - ih * i / steps; this.line(x0, y, x0 + w, y, '#E2E8F0'); this.text(Math.round(v * 10) / 10, x0 - 5, y - 4, { size: 7, color: '#64748B', align: 'right' }); }
      const gw = w / n, bw = Math.min(26, gw * (spec.stacked ? .6 : .8) / (spec.stacked ? 1 : S.length));
      spec.labels.forEach((lb, i) => { const cx = x0 + gw * i + gw / 2; let acc = 0;
        S.forEach((s, k) => { const v = s.values[i] || 0; if (!v) return; const c = s.color || PALET[k % PALET.length], hh = ih * v / top;
          if (spec.stacked) { this.rect(cx - bw / 2, y0 + ih - ih * (acc + v) / top, bw, hh, { fill: c }); acc += v; } else { const x = cx - S.length * bw / 2 + k * bw; this.rect(x, y0 + ih - hh, bw - 1, hh, { fill: c }); this.text(v, x + (bw - 1) / 2, y0 + ih - hh - 9, { size: 6.5, align: 'center', bold: true, color: '#334155' }); } });
        if (spec.stacked && sums[i]) this.text(sums[i], cx, y0 + ih - ih * sums[i] / top - 9, { size: 7, bold: true, align: 'center' });
        this.text(lb, cx, y0 + ih + 6, { size: 7.5, color: '#475569', align: 'center' }); });
      this.y += h + 4; this.legend(S.map((s, k) => ({ name: s.name, color: s.color || PALET[k % PALET.length] })));
    }
    hbars(items) {
      const rh = 18, L = 150; this.need(Math.min(items.length, 8) * rh + 8); const mx = Math.max.apply(null, items.map(x => x.value).concat([1])), w = this.cw - L - 36;
      items.forEach((it, i) => { this.need(rh + 2); const lb = wrap(it.label, L - 10, 8.5, false)[0] || ''; this.text(lb + (wrap(it.label, L - 10, 8.5, false).length > 1 ? '…' : ''), this.m + L - 8, this.y + 3, { size: 8.5, align: 'right', color: '#334155' });
        const bw = Math.max(w * it.value / mx, it.value ? 2 : 0); this.rect(this.m + L, this.y + 1, bw, 12, { fill: it.color || PALET[i % PALET.length] }); this.text(it.value, this.m + L + bw + 5, this.y + 3, { size: 8.5, bold: true }); this.y += rh; });
      this.y += 6;
    }
    donut(spec, cx, cy, R, r) {
      const it = spec.items.filter(x => x.value > 0), tot = it.reduce((a, x) => a + x.value, 0); if (!tot) { this.text('Belum ada data', cx, cy - 4, { size: 9, align: 'center', color: '#64748B' }); return; }
      let a0 = -Math.PI / 2; it.forEach((x, i) => { const sw = x.value / tot * Math.PI * 2, n = Math.max(6, Math.ceil(sw / 0.1)), pts = [];
        for (let k = 0; k <= n; k++) { const a = a0 + sw * k / n; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } for (let k = n; k >= 0; k--) { const a = a0 + sw * k / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
        this.poly(pts, x.color || PALET[i % PALET.length]); a0 += sw; });
      this.text(tot, cx, cy - 9, { size: 16, bold: true, align: 'center' }); this.text(spec.unit || 'total', cx, cy + 8, { size: 7, color: '#64748B', align: 'center' });
    }
    legend(items) { let x = this.m, y = this.y; items.forEach(it => { const w = tw(it.name, 8, false) + 26; if (x + w > this.m + this.cw) { x = this.m; y += 14; } this.rect(x, y + 1, 8, 8, { fill: it.color }); this.text(it.name, x + 12, y, { size: 8, color: '#334155' }); x += w; }); this.y = y + 18; }
    blob() {
      const total = this.pages.length, objs = [], add = s => { objs.push(s); return objs.length; };
      add('<< /Type /Catalog /Pages 2 0 R >>'); add(''); const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2o = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const kids = [];
      this.pages.forEach((ops, i) => {
        this.ops = ops; this.line(this.m, this.H - 28, this.W - this.m, this.H - 28, '#E2E8F0'); this.text(this.footer, this.m, this.H - 24, { size: 7.5, color: '#94A3B8' }); this.text('Halaman ' + (i + 1) + ' / ' + total, this.W - this.m, this.H - 24, { size: 7.5, color: '#94A3B8', align: 'right' });
        const body = ops.join('\n'), c = add('<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream'), p = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f2(this.W) + ' ' + f2(this.H) + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2o + ' 0 R >> >> /Contents ' + c + ' 0 R >>'); kids.push(p + ' 0 R');
      });
      objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + total + ' >>';
      let out = '%PDF-1.4\n', xref = []; objs.forEach((o, i) => { xref.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
      const xr = out.length; out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + xref.map(x => String(x).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF';
      const u = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u[i] = out.charCodeAt(i) & 255; return new Blob([u], { type: 'application/pdf' });
    }
  }
  return { Doc, tw };
})();
