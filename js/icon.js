/**
 * Web Toolbox — icon rendering shared by the Image Converter (ICO) and the Favicon Generator.
 * Exposes window.IconKit.
 */
(function () {
  'use strict';

  function t(key, fallback) {
    return (typeof window.t === 'function') ? window.t(key) : fallback;
  }

  function blobToArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  // SVGs without width/height get them from the viewBox so they rasterize at their intended size.
  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      var isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

      if (isSvg) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var svgText = e.target.result;
          try {
            var doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
            var svgEl = doc.documentElement;
            if (svgEl && svgEl.nodeName.toLowerCase() === 'svg') {
              var hasW = svgEl.getAttribute('width');
              var hasH = svgEl.getAttribute('height');
              var vb = svgEl.getAttribute('viewBox');
              if (vb && (!hasW || !hasH)) {
                var parts = vb.trim().split(/[\s,]+/);
                if (parts.length === 4) {
                  var w = parseFloat(parts[2]);
                  var h = parseFloat(parts[3]);
                  if (w > 0 && h > 0) {
                    if (!hasW) svgEl.setAttribute('width', w);
                    if (!hasH) svgEl.setAttribute('height', h);
                    svgText = new XMLSerializer().serializeToString(doc);
                  }
                }
              }
            }
          } catch (err) {
            // If parsing fails, use original text
          }
          var svgUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
          var img = new Image();
          img.onload = function () { URL.revokeObjectURL(svgUrl); resolve(img); };
          img.onerror = function () { URL.revokeObjectURL(svgUrl); reject(new Error(t('conv_read_image_fail', 'Could not read image'))); };
          img.src = svgUrl;
        };
        reader.onerror = function () { reject(new Error(t('conv_file_read_failed', 'File read failed'))); };
        reader.readAsText(file);
      } else {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(t('conv_read_image_fail', 'Could not read image'))); };
        img.src = url;
      }
    });
  }

  // ICO generation: multi-size PNG-encoded icon
  async function convertToIco(img, settings) {
    const sizes = [...settings.icoSizes].sort((a, b) => a - b);
    if (sizes.length === 0) sizes.push(32);

    const pngBuffers = [];
    const visibleBounds = getVisibleImageBounds(img);
    for (const size of sizes) {
      const blob = await renderSquarePng(img, size, settings.icoCropMode, visibleBounds, settings.focus);
      const buf = await blobToArrayBuffer(blob);
      pngBuffers.push({ size, buffer: new Uint8Array(buf) });
    }

    const count = pngBuffers.length;
    const headerSize = 6;
    const dirSize = count * 16;
    let dataOffset = headerSize + dirSize;

    const header = new DataView(new ArrayBuffer(headerSize));
    header.setUint16(0, 0, true); // Reserved
    header.setUint16(2, 1, true); // Type: icon
    header.setUint16(4, count, true); // Count

    const dir = new DataView(new ArrayBuffer(dirSize));
    const parts = [new Uint8Array(header.buffer)];

    let dirOffset = 0;
    for (let i = 0; i < count; i++) {
      const { size, buffer } = pngBuffers[i];
      const w = size >= 256 ? 0 : size;
      const h = size >= 256 ? 0 : size;

      dir.setUint8(dirOffset, w);
      dir.setUint8(dirOffset + 1, h);
      dir.setUint8(dirOffset + 2, 0); // ColorCount
      dir.setUint8(dirOffset + 3, 0); // Reserved
      dir.setUint16(dirOffset + 4, 1, true); // Planes
      dir.setUint16(dirOffset + 6, 32, true); // BitCount
      dir.setUint32(dirOffset + 8, buffer.length, true); // BytesInRes
      dir.setUint32(dirOffset + 12, dataOffset, true); // ImageOffset

      parts.push(buffer);
      dataOffset += buffer.length;
      dirOffset += 16;
    }

    parts.splice(1, 0, new Uint8Array(dir.buffer));
    const icoBlob = new Blob(parts, { type: 'image/x-icon' });

    return {
      blob: icoBlob,
      width: sizes[sizes.length - 1],
      height: sizes[sizes.length - 1],
      icoSizes: sizes,
      originalWidth: img.naturalWidth,
      originalHeight: img.naturalHeight,
      format: 'ico',
    };
  }

  async function renderSquarePng(img, size, mode, visibleBounds, focus) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(t('conv_output_unsupported', 'Browser does not support canvas output'));
    ctx.clearRect(0, 0, size, size);
    drawSquareImage(ctx, img, size, mode, visibleBounds, focus);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error(t('ann_export_fail', 'Export failed'));
    return blob;
  }

  // favicon.ico + common PNG sizes + web manifest. Returns [{ name, blob }].
  async function buildFaviconFiles(img, mode, focus, icoSizes) {
    const visibleBounds = getVisibleImageBounds(img);
    const png = {};
    for (const size of [16, 32, 48, 180, 192, 512]) {
      png[size] = await renderSquarePng(img, size, mode, visibleBounds, focus);
    }
    const ico = await convertToIco(img, { icoSizes: icoSizes || [16, 32, 48, 64, 128, 256], icoCropMode: mode, focus });

    const manifest = {
      name: 'Web App',
      short_name: 'Web App',
      icons: [
        { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
      ],
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone'
    };

    return [
      { name: 'favicon.ico', blob: ico.blob },
      { name: 'favicon-16x16.png', blob: png[16] },
      { name: 'favicon-32x32.png', blob: png[32] },
      { name: 'favicon-48x48.png', blob: png[48] },
      { name: 'apple-touch-icon.png', blob: png[180] },
      { name: 'android-chrome-192x192.png', blob: png[192] },
      { name: 'android-chrome-512x512.png', blob: png[512] },
      { name: 'site.webmanifest', blob: new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/manifest+json' }) }
    ];
  }

  // Draw image as square: cover crop (positioned by focus) or contain scale with transparent padding
  function drawSquareImage(c, img, size, mode, visibleBounds, focus) {
    const source = visibleBounds || getVisibleImageBounds(img);
    const ratio = source.width / source.height;

    if (mode === 'contain') {
      let dw, dh;
      if (ratio > 1) {
        dw = size;
        dh = size / ratio;
      } else {
        dh = size;
        dw = size * ratio;
      }
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;
      c.clearRect(0, 0, size, size);
      c.drawImage(img, source.x, source.y, source.width, source.height, dx, dy, dw, dh);
      return;
    }

    const win = coverWindow(source, 1, focus);
    c.drawImage(img, win.x, win.y, win.w, win.h, 0, 0, size, size);
  }

  // The part of `source` ({x, y, width, height}) a cover crop to aspect `ratio` keeps.
  // focus {x, y} in 0..1 slides it along the axis that has room; default is centred.
  function coverWindow(source, ratio, focus) {
    const f = focus || { x: 0.5, y: 0.5 };
    let w = source.width, h = source.height;
    if (w / h > ratio) w = h * ratio; else h = w / ratio;
    return { x: source.x + (source.width - w) * f.x, y: source.y + (source.height - h) * f.y, w, h };
  }

  function getVisibleImageBounds(img) {
    const fallback = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
    if (!img.naturalWidth || !img.naturalHeight) return fallback;

    const scanMax = 512;
    const scale = Math.min(1, scanMax / Math.max(img.naturalWidth, img.naturalHeight));
    const sw = Math.max(1, Math.round(img.naturalWidth * scale));
    const sh = Math.max(1, Math.round(img.naturalHeight * scale));
    const scan = document.createElement('canvas');
    scan.width = sw;
    scan.height = sh;
    const sc = scan.getContext('2d', { willReadFrequently: true });
    if (!sc) return fallback;
    try {
      sc.clearRect(0, 0, sw, sh);
      sc.drawImage(img, 0, 0, sw, sh);
    } catch (_) {
      return fallback;
    }

    let minX = sw, minY = sh, maxX = -1, maxY = -1;
    let data;
    try {
      data = sc.getImageData(0, 0, sw, sh).data;
    } catch (_) {
      return fallback;
    }
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (data[(y * sw + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return fallback;

    const pad = 1;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(sw - 1, maxX + pad);
    maxY = Math.min(sh - 1, maxY + pad);

    return {
      x: Math.floor(minX / scale),
      y: Math.floor(minY / scale),
      width: Math.min(img.naturalWidth, Math.ceil((maxX - minX + 1) / scale)),
      height: Math.min(img.naturalHeight, Math.ceil((maxY - minY + 1) / scale))
    };
  }

  // Draggable picker for where a cover crop sits: shows the source with the kept window
  // highlighted; dragging slides the window and onCommit(focus) fires on release.
  function createCoverPicker(canvas, onCommit) {
    const MAX_SIDE = 900;
    const center = { x: 0.5, y: 0.5 };
    let src = null; // { img, bounds, ratio, scale }
    let focus = center;
    let drag = null;

    function draw() {
      const { img, bounds, ratio, scale } = src;
      const W = canvas.width, H = canvas.height;
      const win = coverWindow(bounds, ratio, focus);
      const r = { x: win.x * scale, y: win.y * scale, w: win.w * scale, h: win.h * scale };
      const cx = canvas.getContext('2d');
      cx.clearRect(0, 0, W, H);
      cx.drawImage(img, 0, 0, W, H);
      cx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      cx.fillRect(0, 0, W, r.y);
      cx.fillRect(0, r.y, r.x, r.h);
      cx.fillRect(r.x + r.w, r.y, W - r.x - r.w, r.h);
      cx.fillRect(0, r.y + r.h, W, H - r.y - r.h);
      cx.strokeStyle = '#ffffff';
      cx.lineWidth = Math.max(2, W / 300);
      cx.strokeRect(r.x, r.y, r.w, r.h);
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!src) return;
      canvas.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, focus };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const { bounds, ratio, scale } = src;
      const win = coverWindow(bounds, ratio);
      const toSource = canvas.width / canvas.getBoundingClientRect().width / scale;
      const roomX = bounds.width - win.w, roomY = bounds.height - win.h;
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      focus = {
        x: roomX > 0.5 ? clamp01(drag.focus.x + (e.clientX - drag.x) * toSource / roomX) : 0.5,
        y: roomY > 0.5 ? clamp01(drag.focus.y + (e.clientY - drag.y) * toSource / roomY) : 0.5,
      };
      draw();
    });
    canvas.addEventListener('pointerup', () => {
      if (!drag) return;
      drag = null;
      onCommit(focus);
    });

    return {
      // Returns false (and shows nothing) when the crop cuts nothing off.
      show(img, bounds, ratio, f) {
        const win = coverWindow(bounds, ratio);
        if (win.w >= bounds.width - 0.5 && win.h >= bounds.height - 0.5) { src = null; return false; }
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        src = { img, bounds, ratio, scale };
        focus = f || center;
        draw();
        return true;
      },
      setFocus(f) {
        focus = f || center;
        if (src) draw();
      },
    };
  }

  window.IconKit = { loadImageFromFile, convertToIco, buildFaviconFiles, renderSquarePng, coverWindow, getVisibleImageBounds, createCoverPicker };
})();
