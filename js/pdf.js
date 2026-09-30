// Minimal PDF writer: the canvas sliced into A4-proportioned pages, each an embedded JPEG.
// No library needed; PDF viewers decode DCT (JPEG) streams natively.
window.canvasToPdf = async function (canvas, quality) {
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
    var ctx = slice.getContext('2d');
    ctx.fillStyle = '#ffffff'; // JPEG has no alpha
    ctx.fillRect(0, 0, W, h);
    ctx.drawImage(canvas, 0, y, W, h, 0, 0, W, h);
    var blob = await new Promise(function (r) { slice.toBlob(r, 'image/jpeg', quality || 0.92); });
    pages.push({ h: h, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }

  var enc = new TextEncoder();
  var parts = [], offsets = [], len = 0;
  function push(x) {
    var b = typeof x === 'string' ? enc.encode(x) : x;
    parts.push(b);
    len += b.length;
  }
  function obj(n, body) { offsets[n] = len; push(n + ' 0 obj\n' + body + '\nendobj\n'); }

  // 1 catalog, 2 page tree, then per page i: page 3+3i, content 4+3i, image 5+3i
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map(function (_, i) { return (3 + 3 * i) + ' 0 R'; }).join(' ') + '] >>');
  pages.forEach(function (p, i) {
    var n = 3 + 3 * i;
    var pw = (W * PT).toFixed(2), ph = (p.h * PT).toFixed(2);
    obj(n, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 ' + (n + 2) + ' 0 R >> >> /Contents ' + (n + 1) + ' 0 R >>');
    var draw = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
    obj(n + 1, '<< /Length ' + draw.length + ' >>\nstream\n' + draw + '\nendstream');
    offsets[n + 2] = len;
    push((n + 2) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + W + ' /Height ' + p.h +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.bytes.length + ' >>\nstream\n');
    push(p.bytes);
    push('\nendstream\nendobj\n');
  });

  var count = 3 + 3 * pages.length;
  var xref = len;
  var table = 'xref\n0 ' + count + '\n0000000000 65535 f \n';
  for (var k = 1; k < count; k++) table += String(offsets[k]).padStart(10, '0') + ' 00000 n \n';
  push(table + 'trailer\n<< /Size ' + count + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(parts, { type: 'application/pdf' });
};
