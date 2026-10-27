// charts.js — grafik SVG mandiri (batang berkelompok/bertumpuk, batang horizontal, donat)
const PALET = ['#0B192C', '#C5A059', '#1E3E62', '#10B981', '#94A3B8', '#B45309', '#6366F1', '#0EA5E9'];
const Charts = (function () {
  const e = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function nice(max) { if (max <= 0) return 5; const p = Math.pow(10, Math.floor(Math.log10(max))), f = max / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  function ticks(max) { const top = nice(max), step = top / (top >= 5 ? 5 : top); const t = []; for (let v = 0; v <= top + 1e-9; v += step) t.push(Math.round(v * 100) / 100); return t; }
  /** spec: {labels:[], series:[{name,color,values:[]}], stacked:bool, h} */
  function bars(spec) {
    const W = 720, H = spec.h || 300, L = 40, R = 10, T = 14, B = 34, iw = W - L - R, ih = H - T - B, n = spec.labels.length, S = spec.series;
    const sums = spec.labels.map((_, i) => spec.stacked ? S.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max.apply(null, S.map(s => s.values[i] || 0)));
    const tk = ticks(Math.max.apply(null, sums.concat([1]))), top = tk[tk.length - 1], y = v => T + ih - (v / top) * ih;
    let g = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + e(spec.title || 'Grafik') + '" style="display:block;max-width:100%;height:auto">';
    tk.forEach(v => { g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#E2E8F0" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" font-size="11" fill="#64748B" text-anchor="end">' + v + '</text>'; });
    const gw = iw / n, bw = Math.min(46, gw * (spec.stacked ? .6 : .78) / (spec.stacked ? 1 : S.length));
    spec.labels.forEach((lb, i) => {
      const cx = L + gw * i + gw / 2; let acc = 0;
      S.forEach((s, k) => {
        const v = s.values[i] || 0; if (!v) return; const col = s.color || PALET[k % PALET.length];
        let x, yy, hh; if (spec.stacked) { x = cx - bw / 2; yy = y(acc + v); hh = y(acc) - y(acc + v); acc += v; } else { x = cx - (S.length * bw) / 2 + k * bw; yy = y(v); hh = y(0) - y(v); }
        g += '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + (bw - (spec.stacked ? 0 : 2)).toFixed(1) + '" height="' + Math.max(hh, 0).toFixed(1) + '" rx="2" fill="' + col + '"><title>' + e(lb + ' — ' + s.name + ': ' + v) + '</title></rect>';
        if (!spec.stacked && hh > 14 && gw > 40) g += '<text x="' + (x + (bw - 2) / 2).toFixed(1) + '" y="' + (yy - 4).toFixed(1) + '" font-size="10.5" font-weight="700" fill="#334155" text-anchor="middle">' + v + '</text>';
      });
      if (spec.stacked && sums[i] > 0) g += '<text x="' + cx.toFixed(1) + '" y="' + (y(sums[i]) - 5).toFixed(1) + '" font-size="11" font-weight="800" fill="#0B192C" text-anchor="middle">' + sums[i] + '</text>';
      g += '<text x="' + cx.toFixed(1) + '" y="' + (H - 12) + '" font-size="11.5" fill="#475569" text-anchor="middle">' + e(lb) + '</text>';
    });
    return g + '</svg>';
  }
  /** spec: {items:[{label,value,color}], unit} — batang horizontal berurut, label di kiri */
  function hbars(spec) {
    const it = spec.items, rh = 34, W = 720, L = Math.min(240, Math.max(110, Math.max.apply(null, it.map(x => x.label.length)) * 6.6)), R = 56, H = it.length * rh + 8, max = Math.max.apply(null, it.map(x => x.value).concat([1]));
    let g = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + e(spec.title || 'Grafik') + '" style="display:block;max-width:100%;height:auto">';
    it.forEach((x, i) => { const y = 4 + i * rh, w = (W - L - R) * x.value / max, col = x.color || PALET[i % PALET.length];
      g += '<text x="' + (L - 10) + '" y="' + (y + 21) + '" font-size="12.5" fill="#334155" text-anchor="end">' + e(x.label.length > 34 ? x.label.slice(0, 33) + '…' : x.label) + '</text><rect x="' + L + '" y="' + (y + 6) + '" width="' + Math.max(w, x.value ? 3 : 0).toFixed(1) + '" height="20" rx="3" fill="' + col + '"><title>' + e(x.label + ': ' + x.value) + '</title></rect><text x="' + (L + w + 8).toFixed(1) + '" y="' + (y + 21) + '" font-size="12" font-weight="800" fill="#0B192C">' + x.value + '</text>'; });
    return g + '</svg>';
  }
  function donut(spec) {
    const it = spec.items.filter(x => x.value > 0), tot = it.reduce((a, x) => a + x.value, 0), R = 78, r = 50, cx = 100, cy = 100;
    let g = '<svg class="chart" viewBox="0 0 200 200" width="100%" role="img" aria-label="' + e(spec.title || 'Grafik') + '" style="display:block;max-width:220px;height:auto;margin:auto">';
    if (!tot) return g + '<circle cx="100" cy="100" r="64" fill="none" stroke="#E2E8F0" stroke-width="28"/><text x="100" y="105" text-anchor="middle" font-size="13" fill="#64748B">Belum ada data</text></svg>';
    let a0 = -Math.PI / 2;
    it.forEach((x, i) => { const frac = x.value / tot, a1 = a0 + frac * Math.PI * 2 - (it.length > 1 ? 0.012 : 0), big = a1 - a0 > Math.PI ? 1 : 0, col = x.color || PALET[i % PALET.length];
      if (frac > .9999) g += '<circle cx="100" cy="100" r="' + ((R + r) / 2) + '" fill="none" stroke="' + col + '" stroke-width="' + (R - r) + '"><title>' + e(x.label + ': ' + x.value) + '</title></circle>';
      else g += '<path d="M' + (cx + R * Math.cos(a0)).toFixed(2) + ' ' + (cy + R * Math.sin(a0)).toFixed(2) + 'A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + (cx + R * Math.cos(a1)).toFixed(2) + ' ' + (cy + R * Math.sin(a1)).toFixed(2) + 'L' + (cx + r * Math.cos(a1)).toFixed(2) + ' ' + (cy + r * Math.sin(a1)).toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + (cx + r * Math.cos(a0)).toFixed(2) + ' ' + (cy + r * Math.sin(a0)).toFixed(2) + 'Z" fill="' + col + '"><title>' + e(x.label + ': ' + x.value + ' (' + Math.round(frac * 100) + '%)') + '</title></path>';
      a0 += frac * Math.PI * 2; });
    return g + '<text x="100" y="98" text-anchor="middle" font-size="26" font-weight="600" font-family="EB Garamond,Georgia,serif" fill="#0B192C">' + tot + '</text><text x="100" y="116" text-anchor="middle" font-size="10.5" fill="#64748B">' + e(spec.unit || 'total') + '</text></svg>';
  }
  const legend = items => '<div class="legend">' + items.map((x, i) => '<span><i style="background:' + (x.color || PALET[i % PALET.length]) + '"></i>' + e(x.name || x.label) + (x.value != null ? ' <b>' + x.value + '</b>' : '') + '</span>').join('') + '</div>';
  return { bars, hbars, donut, legend };
})();
