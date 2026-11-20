// Worker: find QR codes in a screenshot (ImageBitmap) with jsQR, off the main thread.
// Pass 1 scans the whole image scaled to <= 1600 px (big codes); pass 2 scans full-size
// overlapping tiles (small codes on long pages). After each hit the code is painted over
// and the area scanned again, so several codes in one place are found too.
// Posts { type: 'found', data, box: { x, y, w, h } in image px } per new code, then { type: 'done' }.
importScripts('../vendor/jsQR.js');

var MAX_EDGE = 1600, TILE = 1200, STEP = 800, MAX_CODES = 12, PER_AREA = 4;

function starts(len) {
  if (len <= TILE) return [0];
  var list = [];
  for (var p = 0; p + TILE < len; p += STEP) list.push(p);
  list.push(len - TILE);
  return list;
}

self.onmessage = function (e) {
  var bmp = e.data.bitmap, W = bmp.width, H = bmp.height, seen = {}, count = 0;

  function scan(sx, sy, sw, sh, scale) {
    var w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
    var ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
    for (var k = 0; k < PER_AREA && count < MAX_CODES; k++) {
      var r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
      if (!r) return;
      var L = r.location, pts = [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner];
      var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      if (r.data && !seen[r.data]) {
        seen[r.data] = true;
        count++;
        self.postMessage({ type: 'found', data: r.data, box: { x: sx + x0 / scale, y: sy + y0 / scale, w: (x1 - x0) / scale, h: (y1 - y0) / scale } });
      }
      // Cover this code (with its quiet zone) and look again.
      var pad = (x1 - x0) * 0.15;
      ctx.fillStyle = '#808080';
      ctx.fillRect(x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad);
    }
  }

  try {
    var s = Math.min(1, MAX_EDGE / Math.max(W, H));
    scan(0, 0, W, H, s);
    if (s < 1) {
      starts(H).forEach(function (y) {
        starts(W).forEach(function (x) { if (count < MAX_CODES) scan(x, y, Math.min(TILE, W - x), Math.min(TILE, H - y), 1); });
      });
    }
  } finally {
    bmp.close();
    self.postMessage({ type: 'done' });
  }
};
