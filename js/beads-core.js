/**
 * 70015 — Bead pattern core: grid recovery, palette matching, color limits, fills.
 * No DOM here, so Node can load it for checks (module.exports) and pages get window.BeadsCore.
 * Pixel data is RGBA bytes (ImageData.data layout). A pattern is an Int16Array of
 * palette indexes, -1 meaning "no bead".
 */
(function (root) {
  'use strict';

  // ---------- Color ----------

  function lin(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  // sRGB (D65) -> CIE Lab
  function rgbToLab(r, g, b) {
    r = lin(r); g = lin(g); b = lin(b);
    var x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
    var y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
    var z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
    function f(t) { return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116; }
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }

  var RAD = Math.PI / 180;
  var POW25_7 = 6103515625; // 25^7

  // CIEDE2000 color difference (Sharma, Wu & Dalal 2005).
  function deltaE(lab1, lab2) {
    var L1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
    var L2 = lab2[0], a2 = lab2[1], b2 = lab2[2];
    var Cm7 = Math.pow((Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, 7);
    var G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + POW25_7)));
    var a1p = a1 * (1 + G), a2p = a2 * (1 + G);
    var C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
    var h1 = C1 ? (Math.atan2(b1, a1p) / RAD + 360) % 360 : 0;
    var h2 = C2 ? (Math.atan2(b2, a2p) / RAD + 360) % 360 : 0;
    var chroma = C1 * C2 !== 0;

    var dh = 0;
    if (chroma) {
      dh = h2 - h1;
      if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    }
    var dL = L2 - L1, dC = C2 - C1;
    var dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh * RAD / 2);

    var Lm = (L1 + L2) / 2, Cm = (C1 + C2) / 2;
    var hm = h1 + h2;
    if (chroma) {
      if (Math.abs(h1 - h2) > 180) hm += hm < 360 ? 360 : -360;
      hm /= 2;
    }
    var T = 1 - 0.17 * Math.cos((hm - 30) * RAD) + 0.24 * Math.cos(2 * hm * RAD) +
      0.32 * Math.cos((3 * hm + 6) * RAD) - 0.20 * Math.cos((4 * hm - 63) * RAD);
    var dTheta = 30 * Math.exp(-Math.pow((hm - 275) / 25, 2));
    var Cm7p = Math.pow(Cm, 7);
    var Rc = 2 * Math.sqrt(Cm7p / (Cm7p + POW25_7));
    var Lm50 = (Lm - 50) * (Lm - 50);
    var Sl = 1 + 0.015 * Lm50 / Math.sqrt(20 + Lm50);
    var Sc = 1 + 0.045 * Cm;
    var Sh = 1 + 0.015 * Cm * T;
    var Rt = -Math.sin(2 * dTheta * RAD) * Rc;
    var x = dL / Sl, y = dC / Sc, z = dH / Sh;
    return Math.sqrt(x * x + y * y + z * z + Rt * y * z);
  }

  // ---------- Palettes ----------

  function makeColor(code, rgb) {
    var hex = '#' + rgb.map(function (v) { return v.toString(16).padStart(2, '0'); }).join('').toUpperCase();
    return { code: code, hex: hex, rgb: rgb, lab: rgbToLab(rgb[0], rgb[1], rgb[2]) };
  }

  // Built-in form: "CODE RRGGBB CODE RRGGBB ..."
  function parsePalette(str) {
    var t = str.trim().split(/\s+/), out = [];
    for (var i = 0; i + 1 < t.length; i += 2) {
      var n = parseInt(t[i + 1], 16);
      out.push(makeColor(t[i], [n >> 16 & 255, n >> 8 & 255, n & 255]));
    }
    return out;
  }

  // Imported files: GIMP .gpl (Aseprite, Lospec), .hex (one color per line),
  // or lines like "A1,#FAF4C8" / "#FAF4C8 A1". Lines without a color are skipped.
  function parsePaletteText(text) {
    var out = [], seen = {};
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || /^(GIMP Palette|Name:|Columns:|;|#(\s|$))/i.test(line)) return;
      var rgb, rest;
      var m = line.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s+(.*))?$/);
      if (m) {
        rgb = [+m[1], +m[2], +m[3]];
        rest = m[4] || '';
      } else {
        m = line.match(/(?:^|[\s,;:#])([0-9a-f]{6})(?=$|[\s,;:])/i);
        if (!m) return;
        var n = parseInt(m[1], 16);
        rgb = [n >> 16 & 255, n >> 8 & 255, n & 255];
        rest = line.replace(m[0], ' ');
      }
      if (rgb.some(function (v) { return v > 255; })) return;
      var code = rest.replace(/^[\s,;:\t#]+|[\s,;:\t]+$/g, '').slice(0, 12);
      if (!code || /^untitled$/i.test(code) || seen[code]) code = String(out.length + 1);
      seen[code] = true;
      out.push(makeColor(code, rgb));
    });
    return out;
  }

  // allowed: palette indexes to choose from (e.g. the colors the user owns); null = all.
  function nearest(lab, palette, allowed) {
    var best = allowed ? allowed[0] : 0, bd = Infinity;
    for (var k = 0, n = allowed ? allowed.length : palette.length; k < n; k++) {
      var i = allowed ? allowed[k] : k;
      var d = deltaE(lab, palette[i].lab);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // Each distinct source color is matched once, so equal pixels always get the same bead.
  function mapColors(data, palette, allowed) {
    if (allowed && !allowed.length) allowed = null;
    var n = data.length / 4, out = new Int16Array(n), cache = new Map();
    for (var i = 0; i < n; i++) {
      var p = i * 4;
      if (data[p + 3] < 128) { out[i] = -1; continue; }
      var key = data[p] << 16 | data[p + 1] << 8 | data[p + 2];
      var idx = cache.get(key);
      if (idx === undefined) {
        idx = nearest(rgbToLab(data[p], data[p + 1], data[p + 2]), palette, allowed);
        cache.set(key, idx);
      }
      out[i] = idx;
    }
    return out;
  }

  // Fold near-identical cell colors (CIEDE2000 <= maxDE) into the most common of them, in place,
  // so AI noise does not split one intended color across neighbouring bead shades.
  // ponytail: greedy O(unique x clusters); fine for <= 200x200 cells.
  function mergeSimilar(data, maxDE) {
    var counts = new Map(), i, key;
    for (i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      key = data[i] << 16 | data[i + 1] << 8 | data[i + 2];
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    var keys = Array.from(counts.keys()).sort(function (a, b) { return counts.get(b) - counts.get(a); });
    var centers = [], to = new Map();
    keys.forEach(function (k) {
      var lab = rgbToLab(k >> 16 & 255, k >> 8 & 255, k & 255), hit = null;
      for (var c = 0; c < centers.length && !hit; c++) if (deltaE(lab, centers[c].lab) <= maxDE) hit = centers[c];
      if (!hit) { hit = { key: k, lab: lab }; centers.push(hit); }
      to.set(k, hit.key);
    });
    for (i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      key = to.get(data[i] << 16 | data[i + 1] << 8 | data[i + 2]);
      data[i] = key >> 16 & 255; data[i + 1] = key >> 8 & 255; data[i + 2] = key & 255;
    }
    return data;
  }

  function countColors(pattern, size) {
    var counts = new Array(size).fill(0);
    for (var i = 0; i < pattern.length; i++) if (pattern[i] >= 0) counts[pattern[i]]++;
    return counts;
  }

  // Merge the least-used color into its nearest remaining color until at most `max` are left.
  // Buyers care about how many bead colors to stock, which this minimizes directly.
  function limitColors(pattern, palette, max) {
    var counts = countColors(pattern, palette.length);
    var used = [];
    counts.forEach(function (c, i) { if (c) used.push(i); });
    if (!max || used.length <= max) return pattern;
    var remap = palette.map(function (_, i) { return i; });
    while (used.length > max) {
      used.sort(function (a, b) { return counts[a] - counts[b]; });
      var u = used.shift(), best = used[0], bd = Infinity;
      used.forEach(function (v) {
        var d = deltaE(palette[u].lab, palette[v].lab);
        if (d < bd) { bd = d; best = v; }
      });
      remap[u] = best;
      counts[best] += counts[u];
    }
    function rootOf(i) { while (remap[i] !== i) i = remap[i]; return i; }
    var out = new Int16Array(pattern.length);
    for (var i = 0; i < pattern.length; i++) out[i] = pattern[i] < 0 ? -1 : rootOf(pattern[i]);
    return out;
  }

  // ---------- Grid recovery ----------

  function samePixel(d, i, j) {
    if (d[i + 3] < 128 && d[j + 3] < 128) return true;
    return d[i] === d[j] && d[i + 1] === d[j + 1] && d[i + 2] === d[j + 2] && d[i + 3] === d[j + 3];
  }

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

  // Clean pixel art exported at N× (Aseprite and the like): every run of identical
  // pixels, across rows and columns, is a multiple of N. Returns N (1 for a 1× image).
  function detectScale(d, w, h) {
    var g = 0, x, y, run;
    for (y = 0; y < h; y++) {
      run = 1;
      for (x = 1; x < w; x++) {
        if (samePixel(d, (y * w + x) * 4, (y * w + x - 1) * 4)) { run++; continue; }
        g = gcd(g, run);
        if (g === 1) return 1;
        run = 1;
      }
      g = gcd(g, run);
    }
    for (x = 0; x < w; x++) {
      run = 1;
      for (y = 1; y < h; y++) {
        if (samePixel(d, (y * w + x) * 4, ((y - 1) * w + x) * 4)) { run++; continue; }
        g = gcd(g, run);
        if (g === 1) return 1;
        run = 1;
      }
      g = gcd(g, run);
    }
    return g || 1;
  }

  // Edge strength at each boundary between pixel i and i+1 along one axis.
  function edgeProfile(d, w, h, vertical) {
    var len = vertical ? h : w, other = vertical ? w : h, P = new Float64Array(len - 1);
    for (var o = 0; o < other; o++) {
      for (var i = 0; i < len - 1; i++) {
        var a = vertical ? (i * w + o) * 4 : (o * w + i) * 4;
        var b = vertical ? a + w * 4 : a + 4;
        P[i] += Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]) + Math.abs(d[a + 3] - d[b + 3]);
      }
    }
    return P;
  }

  // Mean edge strength on the grid lines of cells starting at phase + k*period, at the best
  // phase. A cell starting at s begins at pixel ceil(s), so its boundary is P[ceil(s) - 1].
  function lineScore(P, p) {
    var best = { s: -1, phase: 0 };
    for (var phase = 0; phase < p; phase += 0.2) {
      var sum = 0, n = 0;
      for (var x = phase; Math.ceil(x) - 1 < P.length; x += p) {
        var i = Math.ceil(x) - 1;
        if (i >= 0) { sum += P[i]; n++; }
      }
      if (n && sum / n > best.s) best = { s: sum / n, phase: phase };
    }
    return best;
  }

  // AI "pixel art" has soft, slightly uneven cells. Find the cell size whose grid lines sit
  // on the strongest edges. Multiples of the true size score just as high, so take the
  // smallest size near the top score, then settle on the local peak next to it.
  // ponytail: one uniform period per axis; warped grids need per-line fitting (proper-pixel-art's Hough approach).
  // Cell size from the spacing of edge peaks: local maxima above 20 % of the strongest edge,
  // then the median gap, refined to the mean of the gaps within ±30 % of it (so 12 and 13 px
  // gaps give 12.5). A drifting grid still has a typical gap, where scoring one uniform grid
  // over the whole image would settle on a multiple of it. After the step estimate in
  // Sprite Fusion Pixel Snapper (MIT, see walkCuts). Returns null with too few peaks.
  function peakStep(P) {
    var max = 0, i;
    for (i = 0; i < P.length; i++) if (P[i] > max) max = P[i];
    if (!max) return null;
    var peaks = [];
    for (i = 1; i < P.length - 1; i++) {
      if (P[i] > max * 0.2 && P[i] > P[i - 1] && P[i] >= P[i + 1] && (!peaks.length || i - peaks[peaks.length - 1] >= 2)) peaks.push(i);
    }
    if (peaks.length < 4) return null;
    var gaps = [];
    for (i = 1; i < peaks.length; i++) gaps.push(peaks[i] - peaks[i - 1]);
    var med = gaps.slice().sort(function (a, b) { return a - b; })[gaps.length >> 1];
    var near = gaps.filter(function (g) { return g >= med * 0.7 && g <= med * 1.3; });
    var step = near.reduce(function (s, g) { return s + g; }, 0) / near.length;
    return step >= 2 && step <= 64 ? step : null;
  }

  function detectPeriod(P, forceP) {
    var mean = 0;
    for (var i = 0; i < P.length; i++) mean += P[i];
    mean /= P.length || 1;
    if (forceP) {
      var f = lineScore(P, forceP);
      return { p: forceP, o: f.phase, strength: mean ? f.s / mean : 0 };
    }
    var step = peakStep(P);
    if (step) {
      var at = lineScore(P, step);
      return { p: Math.round(step * 10) / 10, o: at.phase, strength: mean ? at.s / mean : 0 };
    }
    // Too few clear edges for the peak spacing: score each candidate size instead.
    var maxP = Math.min(64, (P.length + 1) / 4), scores = [], top = 0;
    for (var k = 20; k / 10 <= maxP; k++) {
      var r = lineScore(P, k / 10);
      r.p = k / 10;
      scores.push(r);
      if (r.s > top) top = r.s;
    }
    if (!scores.length || !mean) return null;
    var j = 0;
    while (scores[j].s < 0.8 * top) j++;
    var pick = scores[j];
    for (var m = j; m < scores.length && scores[m].p <= scores[j].p * 1.15; m++) if (scores[m].s > pick.s) pick = scores[m];
    return { p: pick.p, o: pick.phase, strength: pick.s / mean };
  }

  // forceP: use this cell size (px) and only fit where the grid starts.
  function detectGrid(d, w, h, forceP) {
    var px = edgeProfile(d, w, h, false), py = edgeProfile(d, w, h, true);
    var gx = detectPeriod(px, forceP), gy = detectPeriod(py, forceP);
    if (!gx || !gy) return null;
    // strength stays the uniform-grid score: the walker always lands on local maxima, so
    // edge strength along walked lines would look high even for photos.
    gx.cuts = walkCuts(px, w, gx);
    gy.cuts = walkCuts(py, h, gy);
    return { x: gx, y: gy };
  }

  // Cell boundaries that follow the image's own edges, so a grid whose cells drift in size
  // across the image still lines up. Each next boundary is the strongest edge within ±35 %
  // of a cell (at least 2 px) of where the cell size puts it, or that spot when no edge stands
  // out. Adapted from the walker in Sprite Fusion Pixel Snapper
  // (github.com/Hugo-Dz/spritefusion-pixel-snapper, MIT License, Copyright (c) Hugo Duprez).
  // P[i] is the edge between pixels i and i+1, so a cell starting at pixel c sits on P[c - 1].
  // Returns pixel positions [0, ..., len]; slivers under half a cell join their neighbour.
  function walkCuts(P, len, g) {
    var mean = 0;
    for (var i = 0; i < P.length; i++) mean += P[i];
    mean /= P.length || 1;
    var win = Math.max(2, g.p * 0.35), cuts = [0];
    // The first boundary: exactly one real one lies 0.5-1.5 cells in, cropped mid-cell or not.
    var pos = g.p, first = true;
    while (pos < len - g.p / 2) {
      var prev = cuts[cuts.length - 1];
      var lo = Math.max(prev + 1, Math.round(first ? g.p * 0.5 : pos - win));
      var hi = Math.min(len - 1, Math.round(first ? g.p * 1.5 : pos + win));
      first = false;
      var best = -1, bestVal = -1;
      for (var c = lo; c <= hi; c++) if (P[c - 1] > bestVal) { bestVal = P[c - 1]; best = c; }
      var cut = best >= 0 && bestVal > mean * 0.5 ? best : Math.max(prev + 1, Math.round(pos));
      if (len - cut < g.p / 2) break;
      cuts.push(cut);
      pos = cut + g.p;
    }
    cuts.push(len);
    return cuts;
  }

  // [start, end) of each cell along one axis: walked cuts when present, else the uniform grid.
  function cellSpans(len, g) {
    if (g.cuts) return g.cuts.slice(1).map(function (b, k) { return [g.cuts[k], b]; });
    return cellStarts(len, g).map(function (s) { return [s, s + g.p]; });
  }

  // Start offsets of the cells along one axis (a cell counts when its center is inside).
  // Positions come from the index, not a running sum, so a size like 64 / 40 gives exactly 40.
  function cellStarts(len, g) {
    var starts = [];
    for (var i = -Math.ceil(g.o / g.p); ; i++) {
      var s = g.o + i * g.p;
      if (s + g.p / 2 >= len) break;
      if (s + g.p / 2 >= 0) starts.push(s);
    }
    return starts;
  }

  function median(a, n) {
    var s = a.subarray(0, n).sort();
    return s[n >> 1];
  }

  // One color per cell: the per-channel median of the cell's middle half, which skips
  // anti-aliased borders and evens out AI/JPEG noise. Mostly transparent cells stay empty.
  // exact: take the most common exact color instead, for resizing art that is already one
  // color per cell (a median of two different pixels can mix channels into a new color).
  function sampleGrid(d, w, h, gx, gy, exact) {
    var xs = cellSpans(w, gx), ys = cellSpans(h, gy);
    var out = new Uint8ClampedArray(xs.length * ys.length * 4);
    function widest(spans) { return spans.reduce(function (m, s) { return Math.max(m, s[1] - s[0]); }, 1); }
    var size = (Math.ceil(widest(xs) / 2) + 2) * (Math.ceil(widest(ys) / 2) + 2);
    var R = new Uint8Array(size), G = new Uint8Array(size), B = new Uint8Array(size);
    ys.forEach(function (sy, cy) {
      var ph = sy[1] - sy[0];
      var ya = Math.max(0, Math.floor(sy[0] + ph * 0.25)), yb = Math.min(h, Math.max(ya + 1, Math.ceil(sy[0] + ph * 0.75)));
      xs.forEach(function (sx, cx) {
        var pw = sx[1] - sx[0];
        var xa = Math.max(0, Math.floor(sx[0] + pw * 0.25)), xb = Math.min(w, Math.max(xa + 1, Math.ceil(sx[0] + pw * 0.75)));
        var n = 0, total = 0;
        for (var y = ya; y < yb; y++) {
          for (var x = xa; x < xb; x++) {
            var p = (y * w + x) * 4;
            total++;
            if (d[p + 3] < 128) continue;
            R[n] = d[p]; G[n] = d[p + 1]; B[n] = d[p + 2];
            n++;
          }
        }
        if (n * 2 <= total) return; // stays 0,0,0,0
        var q = (cy * xs.length + cx) * 4;
        if (exact) {
          var counts = new Map(), best = 0, most = 0;
          for (var k = 0; k < n; k++) {
            var key = R[k] << 16 | G[k] << 8 | B[k], c = (counts.get(key) || 0) + 1;
            counts.set(key, c);
            if (c > most) { most = c; best = key; }
          }
          out[q] = best >> 16 & 255; out[q + 1] = best >> 8 & 255; out[q + 2] = best & 255;
        } else {
          out[q] = median(R, n);
          out[q + 1] = median(G, n);
          out[q + 2] = median(B, n);
        }
        out[q + 3] = 255;
      });
    });
    return { w: xs.length, h: ys.length, data: out };
  }

  // ---------- Editing ----------

  // 4-connected fill of the region holding (x, y). Returns how many cells changed.
  function floodFill(pattern, w, h, x, y, value) {
    var target = pattern[y * w + x];
    if (target === value) return 0;
    var stack = [y * w + x], changed = 0;
    while (stack.length) {
      var i = stack.pop();
      if (pattern[i] !== target) continue;
      pattern[i] = value;
      changed++;
      var cx = i % w, cy = (i - cx) / w;
      if (cx > 0) stack.push(i - 1);
      if (cx < w - 1) stack.push(i + 1);
      if (cy > 0) stack.push(i - w);
      if (cy < h - 1) stack.push(i + w);
    }
    return changed;
  }

  // Single beads with no same-color neighbor (up/down/left/right) take the color most of their
  // 8 neighbors share, when at least 5 do. Pixel-art details like a 1-px eye match this too,
  // so it is a button the user presses, not an automatic step. Returns how many changed.
  function removeStrays(pattern, w, h) {
    var src = pattern.slice(), changed = 0, counts = new Map();
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = y * w + x, v = src[i];
        if (v < 0) continue;
        if ((x > 0 && src[i - 1] === v) || (x < w - 1 && src[i + 1] === v) ||
            (y > 0 && src[i - w] === v) || (y < h - 1 && src[i + w] === v)) continue;
        counts.clear();
        var best = -1, most = 0;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            var nx = x + dx, ny = y + dy;
            if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            var nv = src[ny * w + nx];
            if (nv < 0) continue;
            var c = (counts.get(nv) || 0) + 1;
            counts.set(nv, c);
            if (c > most) { most = c; best = nv; }
          }
        }
        if (most >= 5) { pattern[i] = best; changed++; }
      }
    }
    // Then specks floating in empty space: groups of at most 3 beads that touch only empty
    // cells, e.g. what a JPG's background leaves behind after the background is removed.
    var seen = new Uint8Array(w * h);
    for (var start = 0; start < pattern.length; start++) {
      if (pattern[start] < 0 || seen[start]) continue;
      var group = [], stack = [start];
      seen[start] = 1;
      while (stack.length) {
        var j = stack.pop();
        group.push(j);
        var jx = j % w, jy = (j - jx) / w;
        [jx > 0 ? j - 1 : -1, jx < w - 1 ? j + 1 : -1, jy > 0 ? j - w : -1, jy < h - 1 ? j + w : -1].forEach(function (k) {
          if (k >= 0 && !seen[k] && pattern[k] >= 0) { seen[k] = 1; stack.push(k); }
        });
      }
      if (group.length <= 3 && group.length < pattern.length) {
        group.forEach(function (k) { pattern[k] = -1; });
        changed += group.length;
      }
    }
    return changed;
  }

  // One-bead outline in `value` around everything: each empty cell touching a bead, diagonals
  // included, gets the outline color. When a bead sits on the canvas edge, the canvas first grows
  // by one cell on every side so the outline fits. Returns { pattern, w, h, added }.
  function addOutline(pattern, w, h, value) {
    var touchesEdge = false;
    for (var x = 0; x < w && !touchesEdge; x++) touchesEdge = pattern[x] >= 0 || pattern[(h - 1) * w + x] >= 0;
    for (var y = 0; y < h && !touchesEdge; y++) touchesEdge = pattern[y * w] >= 0 || pattern[y * w + w - 1] >= 0;
    if (touchesEdge) {
      var grown = new Int16Array((w + 2) * (h + 2)).fill(-1);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) grown[(y + 1) * (w + 2) + x + 1] = pattern[y * w + x];
      pattern = grown;
      w += 2;
      h += 2;
    }
    var src = pattern.slice(), added = 0;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (src[y * w + x] >= 0) continue;
        var near = false;
        for (var dy = -1; dy <= 1 && !near; dy++) {
          for (var dx = -1; dx <= 1 && !near; dx++) {
            var nx = x + dx, ny = y + dy;
            near = nx >= 0 && ny >= 0 && nx < w && ny < h && src[ny * w + nx] >= 0;
          }
        }
        if (near) { pattern[y * w + x] = value; added++; }
      }
    }
    return { pattern: pattern, w: w, h: h, added: added };
  }

  // Clear the most common color along the edges, filling inward from every edge cell that has it.
  // With palette and tol, the fill also crosses colors within tol (CIEDE2000) of that color,
  // e.g. the several near-whites a JPG's white background turns into.
  function removeBackground(pattern, w, h, palette, tol) {
    var counts = new Map(), edge = [];
    for (var x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
    for (var y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1);
    edge.forEach(function (i) { if (pattern[i] >= 0) counts.set(pattern[i], (counts.get(pattern[i]) || 0) + 1); });
    var bg = -1, most = 0;
    counts.forEach(function (c, v) { if (c > most) { most = c; bg = v; } });
    if (bg < 0) return pattern;
    var near = {};
    near[bg] = true;
    if (palette && tol) palette.forEach(function (c, i) { if (deltaE(c.lab, palette[bg].lab) <= tol) near[i] = true; });
    var stack = edge.filter(function (i) { return pattern[i] >= 0 && near[pattern[i]]; });
    while (stack.length) {
      var i = stack.pop();
      if (pattern[i] < 0 || !near[pattern[i]]) continue;
      pattern[i] = -1;
      var cx = i % w, cy = (i - cx) / w;
      if (cx > 0) stack.push(i - 1);
      if (cx < w - 1) stack.push(i + 1);
      if (cy > 0) stack.push(i - w);
      if (cy < h - 1) stack.push(i + w);
    }
    return pattern;
  }

  var api = {
    rgbToLab: rgbToLab,
    deltaE: deltaE,
    parsePalette: parsePalette,
    parsePaletteText: parsePaletteText,
    nearest: nearest,
    mapColors: mapColors,
    mergeSimilar: mergeSimilar,
    countColors: countColors,
    limitColors: limitColors,
    detectScale: detectScale,
    detectGrid: detectGrid,
    sampleGrid: sampleGrid,
    floodFill: floodFill,
    removeStrays: removeStrays,
    addOutline: addOutline,
    removeBackground: removeBackground
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BeadsCore = api;
})(this);
