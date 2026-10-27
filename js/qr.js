// qr.js — pembuat QR mandiri (salinan QrLib.gs; terverifikasi dengan decoder OpenCV)
const QR=(function(){
// ============================================================================
// Berkas 6/6: QrLib.gs — pembuat QR Code mandiri (tanpa library eksternal)
// Mode byte (UTF-8), koreksi galat M, versi 1–10 (maks 213 byte), keluaran PNG 1-bit.
// Murni JavaScript: dapat dijalankan di Apps Script maupun Node (untuk pengujian).
// ============================================================================

const QR_DATA_CW = [0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216];   // codeword data, ECC M
const QR_EC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const QR_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const QR_ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

let _GF_EXP = null, _GF_LOG = null;
function gfInit_() {
  if (_GF_EXP) return;
  _GF_EXP = new Array(512); _GF_LOG = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) { _GF_EXP[i] = x; _GF_LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) _GF_EXP[i] = _GF_EXP[i - 255];
}
function gfMul_(a, b) { return (a === 0 || b === 0) ? 0 : _GF_EXP[_GF_LOG[a] + _GF_LOG[b]]; }
function rsGenerator_(n) {
  gfInit_();
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= gfMul_(g[j], _GF_EXP[i]); }
    g = next;
  }
  return g; // koefisien dari pangkat tertinggi, panjang n+1
}
function rsRemainder_(data, n) {
  const g = rsGenerator_(n), res = new Array(n).fill(0);
  for (let i = 0; i < data.length; i++) {
    const f = data[i] ^ res[0];
    res.shift(); res.push(0);
    if (f) for (let j = 0; j < n; j++) res[j] ^= gfMul_(g[j + 1], f);
  }
  return res;
}
function utf8Bytes_(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xD800 && c < 0xDC00 && i + 1 < s.length) { c = 0x10000 + ((c - 0xD800) << 10) + (s.charCodeAt(++i) - 0xDC00); }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

/** Mengembalikan matriks boolean [baris][kolom] (true = modul gelap). */
function qrMatrix_(text) {
  const bytes = utf8Bytes_(String(text));
  let ver = 0;
  for (let v = 1; v <= 10; v++) { const cap = QR_DATA_CW[v] - (v < 10 ? 2 : 3); if (bytes.length <= cap) { ver = v; break; } }
  if (!ver) throw new Error('Teks QR terlalu panjang (maks 213 byte).');
  const size = 17 + 4 * ver, totalData = QR_DATA_CW[ver];

  // --- 1. bitstream data ---
  const bits = [];
  const put = function (val, len) { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach(function (b) { put(b, 8); });
  const cap = totalData * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; cw.push(b); }
  for (let pad = 0xEC; cw.length < totalData; pad ^= 0xEC ^ 0x11) cw.push(pad);

  // --- 2. blok + koreksi galat + interleave ---
  const nb = QR_BLOCKS[ver], ec = QR_EC_PER_BLOCK[ver], shortLen = Math.floor(totalData / nb), nLong = totalData % nb;
  const blocks = [], ecs = [];
  let k = 0;
  for (let i = 0; i < nb; i++) {
    const len = shortLen + (i >= nb - nLong ? 1 : 0), d = cw.slice(k, k + len); k += len;
    blocks.push(d); ecs.push(rsRemainder_(d, ec));
  }
  const final = [];
  for (let i = 0; i < shortLen + 1; i++) blocks.forEach(function (b) { if (i < b.length) final.push(b[i]); });
  for (let i = 0; i < ec; i++) ecs.forEach(function (e) { final.push(e[i]); });
  const allBits = [];
  final.forEach(function (b) { for (let i = 7; i >= 0; i--) allBits.push((b >>> i) & 1); });

  // --- 3. matriks fungsi ---
  const mod = [], fn = [];
  for (let y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
  const setFn = function (x, y, dark) { mod[y][x] = !!dark; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  const finder = function (cx, cy) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy)); setFn(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = QR_ALIGN[ver];
  al.forEach(function (ay, i) { al.forEach(function (ax, j) {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }); });
  const drawFormat = function (mask) {
    const data = (0 << 3) | mask; // ECC M = 00
    let rem = data; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = ((data << 10) | rem) ^ 0x5412, bit = function (i) { return ((b >>> i) & 1) === 1; };
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const b = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) { const c = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), bb = Math.floor(i / 3); setFn(a, bb, c); setFn(bb, a, c); }
  }

  // --- 4. tempatkan data (zig-zag) ---
  let idx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
      if (!fn[y][x] && idx < allBits.length) { mod[y][x] = allBits[idx] === 1; idx++; }
    }
  }

  // --- 5. pilih mask terbaik ---
  const maskFn = [
    function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x, y) { return x % 3 === 0; },
    function (x, y) { return (x + y) % 3 === 0; }, function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
    function (x, y) { return x * y % 2 + x * y % 3 === 0; }, function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; },
    function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }
  ];
  const applyMask = function (m) {
    const out = mod.map(function (r) { return r.slice(); });
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) out[y][x] = !out[y][x];
    return out;
  };
  let best = null, bestPen = 1e12, bestMask = 0;
  for (let m = 0; m < 8; m++) {
    const cand = applyMask(m), pen = qrPenalty_(cand, size);
    if (pen < bestPen) { bestPen = pen; best = cand; bestMask = m; }
  }
  // gambar ulang format dengan mask terpilih
  const savedMod = mod;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) savedMod[y][x] = best[y][x];
  drawFormat(bestMask);
  return savedMod;
}
function qrPenalty_(m, size) {
  let pen = 0, dark = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < size; a++) {
      let run = 1, hist = [];
      for (let b = 1; b <= size; b++) {
        const cur = b < size ? (pass ? m[b][a] : m[a][b]) : null, prev = pass ? m[b - 1][a] : m[a][b - 1];
        if (cur === prev) { run++; } else { if (run >= 5) pen += run - 2; run = 1; }
      }
      // pola mirip finder 1:1:3:1:1 + 4 putih
      const line = []; for (let b = 0; b < size; b++) line.push((pass ? m[b][a] : m[a][b]) ? 1 : 0);
      const s = line.join('');
      let p = -1; while ((p = s.indexOf('10111010000', p + 1)) >= 0) pen += 40;
      p = -1; while ((p = s.indexOf('00001011101', p + 1)) >= 0) pen += 40;
    }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (m[y][x]) dark++;
    if (x < size - 1 && y < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) pen += 3;
  }
  const k = Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1;
  return pen + Math.max(0, k) * 10;
}

// ============================================================================
// PNG 1-bit (blok deflate "stored" — tanpa kompresi, ukuran kecil untuk QR)
// ============================================================================
let _CRC_T = null;
function crc32_(bytes, start, end) {
  if (!_CRC_T) { _CRC_T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); _CRC_T[n] = c >>> 0; } }
  let c = 0xFFFFFFFF;
  for (let i = start; i < end; i++) c = _CRC_T[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function u32be_(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
function pngChunk_(type, data) {
  const t = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)], body = t.concat(data);
  return u32be_(data.length).concat(body, u32be_(crc32_(body, 0, body.length)));
}
/** Piksel 1-bit: matriks (true = hitam) + zona tenang 4 modul, skala `scale` piksel/modul. Mengembalikan array byte (0–255). */
function qrPngBytes_(text, scale) {
  const m = qrMatrix_(text), n = m.length, quiet = 4, sc = scale || 6, px = (n + quiet * 2) * sc, rowBytes = Math.ceil(px / 8);
  const raw = [];
  for (let y = 0; y < px; y++) {
    raw.push(0);
    const my = Math.floor(y / sc) - quiet, row = new Array(rowBytes).fill(0xFF);
    if (my >= 0 && my < n) for (let x = 0; x < px; x++) {
      const mx = Math.floor(x / sc) - quiet;
      if (mx >= 0 && mx < n && m[my][mx]) row[x >> 3] &= ~(0x80 >> (x & 7));
    }
    for (let i = 0; i < rowBytes; i++) raw.push(row[i]);
  }
  // zlib stored
  const z = [0x78, 0x01];
  for (let p = 0; p < raw.length; p += 65535) {
    const len = Math.min(65535, raw.length - p), last = p + len >= raw.length ? 1 : 0;
    z.push(last, len & 255, len >> 8, (~len) & 255, ((~len) >> 8) & 255);
    for (let i = 0; i < len; i++) z.push(raw[p + i]);
  }
  let a = 1, b = 0;
  for (let i = 0; i < raw.length; i++) { a = (a + raw[i]) % 65521; b = (b + a) % 65521; }
  z.push((b >> 8) & 255, b & 255, (a >> 8) & 255, a & 255);
  const ihdr = u32be_(px).concat(u32be_(px), [1, 0, 0, 0, 0]);
  return [137, 80, 78, 71, 13, 10, 26, 10].concat(pngChunk_('IHDR', ihdr), pngChunk_('IDAT', z), pngChunk_('IEND', []));
}

function svg(text,px){const m=qrMatrix_(text),n=m.length,q=4;let d='';for(let y=0;y<n;y++){let x=0;while(x<n){if(m[y][x]){let e=x;while(e<n&&m[y][e])e++;d+='M'+(x+q)+' '+(y+q)+'h'+(e-x)+'v1h-'+(e-x)+'z';x=e;}else x++;}}
return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(n+2*q)+' '+(n+2*q)+'" width="'+(px||160)+'" height="'+(px||160)+'" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="'+d+'" fill="#0B192C"/></svg>';}
return {matrix:qrMatrix_,pngBytes:qrPngBytes_,svg:svg};
})();
