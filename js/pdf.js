// Minimal PDF writer: each page is one embedded JPEG. No library needed; PDF viewers decode
// DCT (JPEG) streams natively.

// pages: [{ canvas, pageW, pageH, x, y, w, h }] in PDF points (1/72 in). The image is drawn
// at (x, y) from the page's bottom-left, w x h in size; without x/y/w/h it fills the page.
window.pagesToPdf = async function (pages, quality) {
  'use strict';
  var imgs = [];
  for (var i = 0; i < pages.length; i++) {
    var src = pages[i].canvas;
    var flat = document.createElement('canvas');
    flat.width = src.width;
    flat.height = src.height;
    var ctx = flat.getContext('2d');
    ctx.fillStyle = '#ffffff'; // JPEG has no alpha
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(src, 0, 0);
    var blob = await new Promise(function (r) { flat.toBlob(r, 'image/jpeg', quality || 0.92); });
    imgs.push(new Uint8Array(await blob.arrayBuffer()));
  }

  var enc = new TextEncoder();
  var parts = [], offsets = [], len = 0;
  function push(x) {
    var b = typeof x === 'string' ? enc.encode(x) : x;
    parts.push(b);
    len += b.length;
  }
  function obj(n, body) { offsets[n] = len; push(n + ' 0 obj\n' + body + '\nendobj\n'); }
  function num(v) { return v.toFixed(2); }

  // 1 catalog, 2 page tree, then per page i: page 3+3i, content 4+3i, image 5+3i
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map(function (_, i) { return (3 + 3 * i) + ' 0 R'; }).join(' ') + '] >>');
  pages.forEach(function (p, i) {
    var n = 3 + 3 * i;
    var w = p.w == null ? p.pageW : p.w, h = p.h == null ? p.pageH : p.h;
    obj(n, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(p.pageW) + ' ' + num(p.pageH) + '] /Resources << /XObject << /Im0 ' + (n + 2) + ' 0 R >> >> /Contents ' + (n + 1) + ' 0 R >>');
    var draw = 'q ' + num(w) + ' 0 0 ' + num(h) + ' ' + num(p.x || 0) + ' ' + num(p.y || 0) + ' cm /Im0 Do Q';
    obj(n + 1, '<< /Length ' + draw.length + ' >>\nstream\n' + draw + '\nendstream');
    offsets[n + 2] = len;
    push((n + 2) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + p.canvas.width + ' /Height ' + p.canvas.height +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + imgs[i].length + ' >>\nstream\n');
    push(imgs[i]);
    push('\nendstream\nendobj\n');
  });

  var count = 3 + 3 * pages.length;
  var xref = len;
  var table = 'xref\n0 ' + count + '\n0000000000 65535 f \n';
  for (var k = 1; k < count; k++) table += String(offsets[k]).padStart(10, '0') + ' 00000 n \n';
  push(table + 'trailer\n<< /Size ' + count + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(parts, { type: 'application/pdf' });
};

// The canvas sliced into A4-proportioned pages at 96 dpi.
window.canvasToPdf = function (canvas, quality) {
  'use strict';
  var W = canvas.width, H = canvas.height;
  var sliceH = Math.round(W * 297 / 210);
  var PT = 0.75; // CSS px -> PDF points (96 dpi -> 72 dpi)
  var pages = [];
  for (var y = 0; y < H; y += sliceH) {
    var h = Math.min(sliceH, H - y);
    var slice = document.createElement('canvas');
    slice.width = W;
    slice.height = h;
    slice.getContext('2d').drawImage(canvas, 0, y, W, h, 0, 0, W, h);
    pages.push({ canvas: slice, pageW: W * PT, pageH: h * PT });
  }
  return window.pagesToPdf(pages, quality);
};
