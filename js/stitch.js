/**
 * Web Toolbox — Image Stitch
 * Stitch multiple images horizontally, vertically, or in a grid.
 */
(function () {
  'use strict';

  function t(key) { return (typeof window.t === 'function') ? window.t(key) : key; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function showToast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    setTimeout(function () { el.classList.remove('is-visible'); }, 2200);
  }

  var MAX_FILE_SIZE = 50 * 1024 * 1024;
  var MAX_OUTPUT_PIXELS = 64 * 1024 * 1024;

  // ============================================================
  // STITCH
  // ============================================================
  var stitchDrop = document.getElementById('stitchDrop');
  var stitchInput = document.getElementById('stitchInput');
  var stitchSettings = document.getElementById('stitchSettings');
  var stitchList = document.getElementById('stitchList');
  var stitchActions = document.getElementById('stitchActions');
  var stitchInfo = document.getElementById('stitchInfo');
  var stitchDirSelector = document.getElementById('stitchDirSelector');
  var stitchColsField = document.getElementById('stitchColsField');
  var stitchCols = document.getElementById('stitchCols');
  var stitchGap = document.getElementById('stitchGap');
  var stitchAlignSelector = document.getElementById('stitchAlignSelector');
  var stitchBgSelector = document.getElementById('stitchBgSelector');
  var stitchBgColor = document.getElementById('stitchBgColor');
  var stitchFormatSelector = document.getElementById('stitchFormatSelector');
  var stitchClearBtn = document.getElementById('stitchClearBtn');
  var stitchExportBtn = document.getElementById('stitchExportBtn');

  var stitchFiles = []; // { id, file, img, w, h }
  var stitchLoadVersion = 0;
  var stitchDir = 'h';
  var stitchMatch = 'min'; // h/v: scale every image to the smallest or the largest one
  var stitchAlign = 'start';
  var stitchBg = '#ffffff';
  var stitchFormat = 'png';

  function addStitchFiles(files) {
    var imgs = [].filter.call(files, function (f) {
      if (!f.type.startsWith('image/')) return false;
      if (f.size > MAX_FILE_SIZE) { showToast(t('conv_too_large').replace('{name}', f.name)); return false; }
      return true;
    });
    if (!imgs.length) { showToast(t('sz_need_image')); return; }
    var version = stitchLoadVersion;
    var pending = imgs.length;
    // Fill slots by selection index so load-completion order can't reshuffle images.
    var slots = new Array(imgs.length);
    function done() {
      if (--pending > 0) return;
      if (version !== stitchLoadVersion) return;
      slots.forEach(function (item) { if (item) stitchFiles.push(item); });
      renderStitchList(); updateStitchUI();
    }
    imgs.forEach(function (f, i) {
      var url = URL.createObjectURL(f);
      var image = new Image();
      image.onload = function () {
        if (version !== stitchLoadVersion) URL.revokeObjectURL(url);
        else slots[i] = { id: Math.random().toString(36).slice(2, 10), file: f, img: image, url: url, w: image.naturalWidth, h: image.naturalHeight };
        done();
      };
      image.onerror = function () { URL.revokeObjectURL(url); done(); };
      image.src = url;
    });
  }

  function updateStitchUI() {
    var has = stitchFiles.length > 0;
    stitchSettings.hidden = !has;
    stitchActions.hidden = !has;
    renderStitchInfo();
  }

  stitchInput.addEventListener('change', function (e) {
    if (e.target.files.length) addStitchFiles(e.target.files);
    stitchInput.value = '';
  });
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (evt) {
    stitchDrop.addEventListener(evt, function (e) { e.preventDefault(); e.stopPropagation(); });
  });
  ['dragenter', 'dragover'].forEach(function (evt) {
    stitchDrop.addEventListener(evt, function () { stitchDrop.classList.add('is-dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    stitchDrop.addEventListener(evt, function () { stitchDrop.classList.remove('is-dragover'); });
  });
  stitchDrop.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) addStitchFiles(e.dataTransfer.files); });

  function renderStitchList() {
    if (!stitchFiles.length) {
      stitchList.innerHTML = '<div class="sz-empty">' + escapeHtml(t('sz_stitch_empty')) + '</div>';
      return;
    }
    stitchList.innerHTML = stitchFiles.map(function (it, i) {
      return '<div class="sz-stitch-item" data-id="' + it.id + '">' +
        '<img src="' + it.url + '" alt="">' +
        '<div class="sz-stitch-item__info">' +
        '<p class="sz-stitch-item__name">' + escapeHtml(it.file.name) + '</p>' +
        '<p class="sz-stitch-item__meta">' + it.w + ' × ' + it.h +
        (it.crop ? ' · ' + t('st_region').replace('{w}', it.crop.w).replace('{h}', it.crop.h) : '') + '</p>' +
        '</div>' +
        '<div class="sz-stitch-item__btns">' +
        '<button data-act="crop" title="' + t('st_crop') + '"' + (it.crop ? ' class="is-active"' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg></button>' +
        moveBtn('up', i === 0) + moveBtn('down', i === stitchFiles.length - 1) +
        '<button class="sz-del" data-act="del" title="' + t('conv_remove') + '" ' + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>' +
        '</div></div>';
    }).join('');
  }

  function moveBtn(dir, disabled) {
    var path = dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6';
    return '<button data-act="' + dir + '" ' + (disabled ? 'disabled' : '') + ' title="' + (dir === 'up' ? t('snp_prev') : t('snp_next')) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg></button>';
  }

  stitchList.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var item = e.target.closest('[data-id]');
    if (!item) return;
    var id = item.dataset.id;
    var idx = stitchFiles.findIndex(function (f) { return f.id === id; });
    if (idx < 0) return;
    var act = btn.dataset.act;
    if (act === 'crop') openCrop(stitchFiles[idx]);
    else if (act === 'up' && idx > 0) { var a = stitchFiles[idx]; stitchFiles[idx] = stitchFiles[idx - 1]; stitchFiles[idx - 1] = a; renderStitchList(); renderStitchInfo(); }
    else if (act === 'down' && idx < stitchFiles.length - 1) { var b = stitchFiles[idx]; stitchFiles[idx] = stitchFiles[idx + 1]; stitchFiles[idx + 1] = b; renderStitchList(); renderStitchInfo(); }
    else if (act === 'del') {
      if (stitchFiles[idx].url) URL.revokeObjectURL(stitchFiles[idx].url);
      if (cropItem === stitchFiles[idx]) closeCrop();
      stitchFiles.splice(idx, 1); renderStitchList(); updateStitchUI();
    }
  });

  stitchDirSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-value]');
    if (!btn) return;
    [].forEach.call(stitchDirSelector.querySelectorAll('.segmented__btn'), function (b) { b.classList.remove('is-active'); });
    btn.classList.add('is-active');
    stitchDir = btn.dataset.value;
    syncDirFields();
    renderStitchInfo();
  });

  // Columns and alignment only matter in grid mode: rows/columns share one height/width otherwise,
  // which is what "match size" picks.
  function syncDirFields() {
    stitchColsField.hidden = stitchDir !== 'grid';
    document.getElementById('stitchAlignGroup').hidden = stitchDir !== 'grid';
    document.getElementById('stitchMatchGroup').hidden = stitchDir === 'grid';
  }

  var stitchMatchSelector = document.getElementById('stitchMatchSelector');
  stitchMatchSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-value]');
    if (!btn) return;
    [].forEach.call(stitchMatchSelector.querySelectorAll('.segmented__btn'), function (b) { b.classList.toggle('is-active', b === btn); });
    stitchMatch = btn.dataset.value;
    renderStitchInfo();
  });
  stitchAlignSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-value]');
    if (!btn) return;
    [].forEach.call(stitchAlignSelector.querySelectorAll('.segmented__btn'), function (b) { b.classList.remove('is-active'); });
    btn.classList.add('is-active');
    stitchAlign = btn.dataset.value;
    renderStitchInfo();
  });
  stitchBgSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-value]');
    if (btn) {
      [].forEach.call(stitchBgSelector.querySelectorAll('.chip--btn'), function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      stitchBg = btn.dataset.value;
      renderStitchInfo();
    }
  });
  stitchBgColor.addEventListener('input', function (e) {
    [].forEach.call(stitchBgSelector.querySelectorAll('.chip--btn'), function (b) { b.classList.remove('is-active'); });
    stitchBg = e.target.value;
    renderStitchInfo();
  });
  [stitchCols, stitchGap].forEach(function (el) { el.addEventListener('input', renderStitchInfo); });
  stitchFormatSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-value]');
    if (!btn) return;
    [].forEach.call(stitchFormatSelector.querySelectorAll('.segmented__btn'), function (b) { b.classList.remove('is-active'); });
    btn.classList.add('is-active');
    stitchFormat = btn.dataset.value;
  });
  stitchClearBtn.addEventListener('click', function () {
    stitchLoadVersion++;
    stitchFiles.forEach(function (f) { if (f.url) URL.revokeObjectURL(f.url); });
    closeCrop();
    stitchFiles = []; renderStitchList(); updateStitchUI();
  });

  function renderStitchInfo() {
    var layout = stitchFiles.length && computeStitchLayout();
    stitchInfo.textContent = layout ? layout.w + ' × ' + layout.h + ' px' : '—';
    schedulePreview();
  }

  // The part of an image that goes into the stitch: the user's region, or all of it.
  function region(f) { return f.crop || { x: 0, y: 0, w: f.w, h: f.h }; }

  // Returns the output size and one placement { f, x, y, w, h } per image, in output px.
  function computeStitchLayout() {
    var n = stitchFiles.length;
    var gap = Math.max(0, parseInt(stitchGap.value, 10) || 0);
    var regs = stitchFiles.map(region);
    var items = [];
    var pick = stitchMatch === 'max' ? Math.max : Math.min;
    if (stitchDir === 'h') {
      var commonH = pick.apply(null, regs.map(function (r) { return r.h; }));
      var x = 0;
      stitchFiles.forEach(function (f, i) {
        var w = Math.round(regs[i].w * commonH / regs[i].h);
        items.push({ f: f, x: x, y: 0, w: w, h: commonH });
        x += w + gap;
      });
      return { w: x - gap, h: commonH, items: items };
    }
    if (stitchDir === 'v') {
      var commonW = pick.apply(null, regs.map(function (r) { return r.w; }));
      var y = 0;
      stitchFiles.forEach(function (f, i) {
        var h = Math.round(regs[i].h * commonW / regs[i].w);
        items.push({ f: f, x: 0, y: y, w: commonW, h: h });
        y += h + gap;
      });
      return { w: commonW, h: y - gap, items: items };
    }
    var cols = clamp(parseInt(stitchCols.value, 10) || 2, 1, 12);
    var rows = Math.ceil(n / cols);
    var cellW = Math.max.apply(null, regs.map(function (r) { return r.w; }));
    var cellH = Math.max.apply(null, regs.map(function (r) { return r.h; }));
    stitchFiles.forEach(function (f, k) {
      // contain-fit within the cell, aligned
      var scale = Math.min(cellW / regs[k].w, cellH / regs[k].h);
      var dw = Math.round(regs[k].w * scale), dh = Math.round(regs[k].h * scale);
      items.push({
        f: f,
        x: (k % cols) * (cellW + gap) + alignOffset(stitchAlign, cellW, dw),
        y: Math.floor(k / cols) * (cellH + gap) + alignOffset(stitchAlign, cellH, dh),
        w: dw, h: dh
      });
    });
    return { w: cols * cellW + gap * (cols - 1), h: rows * cellH + gap * (rows - 1), items: items };
  }

  // Draws the stitch at scale s (1 = full resolution export; < 1 = preview).
  function paintStitch(cx, layout, s) {
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    if (stitchBg !== 'transparent') { cx.fillStyle = stitchBg; cx.fillRect(0, 0, layout.w * s, layout.h * s); }
    layout.items.forEach(function (p) {
      var r = region(p.f);
      cx.drawImage(p.f.img, r.x, r.y, r.w, r.h, p.x * s, p.y * s, p.w * s, p.h * s);
    });
  }

  function buildStitchCanvas() {
    if (stitchFiles.length < 2) { showToast(t('sz_stitch_need_two')); return null; }
    var layout = computeStitchLayout();
    if (!layout.w || !layout.h || layout.w * layout.h > MAX_OUTPUT_PIXELS) { showToast(t('sz_export_fail')); return null; }
    var c = document.createElement('canvas');
    try {
      c.width = layout.w; c.height = layout.h;
      paintStitch(c.getContext('2d'), layout, 1);
    } catch (err) { showToast(t('sz_export_fail')); return null; }
    return c;
  }

  // ---------- Live preview ----------
  var PREVIEW_MAX_SIDE = 1600;
  var previewWrap = document.getElementById('stitchPreviewWrap');
  var preview = document.getElementById('stitchPreview');
  var previewQueued = false;
  var previewLayout = null, previewScale = 1;

  function schedulePreview() {
    if (previewQueued) return;
    previewQueued = true;
    requestAnimationFrame(function () { previewQueued = false; drawPreview(); });
  }

  function drawPreview() {
    previewWrap.hidden = !stitchFiles.length;
    if (!stitchFiles.length) { previewLayout = null; return; }
    previewLayout = computeStitchLayout();
    previewScale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(previewLayout.w, previewLayout.h));
    preview.width = Math.max(1, Math.round(previewLayout.w * previewScale));
    preview.height = Math.max(1, Math.round(previewLayout.h * previewScale));
    var cx = preview.getContext('2d');
    cx.clearRect(0, 0, preview.width, preview.height);
    paintStitch(cx, previewLayout, previewScale);
  }

  // Clicking an image in the preview opens its region picker.
  preview.addEventListener('click', function (e) {
    if (!previewLayout) return;
    var b = preview.getBoundingClientRect();
    var x = (e.clientX - b.left) * preview.width / b.width / previewScale;
    var y = (e.clientY - b.top) * preview.height / b.height / previewScale;
    var hit = previewLayout.items.find(function (p) { return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h; });
    if (hit) openCrop(hit.f);
  });

  // ---------- Per-image region ----------
  var CROP_MAX_SIDE = 1200;
  var cropPanel = document.getElementById('stitchCropPanel');
  var cropTitle = document.getElementById('stitchCropTitle');
  var cropCanvas = document.getElementById('stitchCropCanvas');
  var cropItem = null, cropScale = 1, cropRect = null, cropDrag = null;

  function openCrop(f) {
    cropItem = f;
    cropScale = Math.min(1, CROP_MAX_SIDE / Math.max(f.w, f.h));
    cropCanvas.width = Math.round(f.w * cropScale);
    cropCanvas.height = Math.round(f.h * cropScale);
    var r = region(f);
    cropRect = { x: r.x * cropScale, y: r.y * cropScale, w: r.w * cropScale, h: r.h * cropScale };
    cropTitle.textContent = f.file.name;
    cropPanel.hidden = false;
    drawCrop();
    cropPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeCrop() { cropItem = null; cropDrag = null; cropPanel.hidden = true; }

  function fullRect() { return { x: 0, y: 0, w: cropCanvas.width, h: cropCanvas.height }; }

  function drawCrop() {
    var W = cropCanvas.width, H = cropCanvas.height, r = cropRect;
    var cx = cropCanvas.getContext('2d');
    var u = W / (cropCanvas.getBoundingClientRect().width || W); // canvas px per CSS px
    cx.clearRect(0, 0, W, H);
    cx.drawImage(cropItem.img, 0, 0, W, H);
    cx.fillStyle = 'rgba(0,0,0,0.5)';
    cx.fillRect(0, 0, W, r.y);
    cx.fillRect(0, r.y, r.x, r.h);
    cx.fillRect(r.x + r.w, r.y, W - r.x - r.w, r.h);
    cx.fillRect(0, r.y + r.h, W, H - r.y - r.h);
    cx.strokeStyle = '#ffffff';
    cx.lineWidth = 2 * u;
    cx.strokeRect(r.x, r.y, r.w, r.h);
  }

  function cropPoint(e) {
    var b = cropCanvas.getBoundingClientRect();
    return {
      x: clamp((e.clientX - b.left) * cropCanvas.width / b.width, 0, cropCanvas.width),
      y: clamp((e.clientY - b.top) * cropCanvas.height / b.height, 0, cropCanvas.height)
    };
  }

  cropCanvas.addEventListener('pointerdown', function (e) {
    if (!cropItem) return;
    cropCanvas.setPointerCapture(e.pointerId);
    var p = cropPoint(e), r = cropRect;
    var inside = p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
    var isFull = r.w >= cropCanvas.width && r.h >= cropCanvas.height;
    cropDrag = inside && !isFull
      ? { mode: 'move', start: p, rect: { x: r.x, y: r.y, w: r.w, h: r.h } }
      : { mode: 'draw', start: p };
  });
  cropCanvas.addEventListener('pointermove', function (e) {
    if (!cropDrag) return;
    var p = cropPoint(e), s = cropDrag.start;
    if (cropDrag.mode === 'move') {
      var o = cropDrag.rect;
      cropRect = { x: clamp(o.x + p.x - s.x, 0, cropCanvas.width - o.w), y: clamp(o.y + p.y - s.y, 0, cropCanvas.height - o.h), w: o.w, h: o.h };
    } else {
      cropRect = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) };
    }
    drawCrop();
  });
  cropCanvas.addEventListener('pointerup', function () {
    if (!cropDrag) return;
    cropDrag = null;
    if (cropRect.w < 4 || cropRect.h < 4) cropRect = fullRect(); // a click, not a drag
    drawCrop();
  });

  function setCrop(f, rect) {
    var c = rect && {
      x: Math.round(rect.x / cropScale), y: Math.round(rect.y / cropScale),
      w: Math.round(rect.w / cropScale), h: Math.round(rect.h / cropScale)
    };
    if (c) { c.w = clamp(c.w, 1, f.w - c.x); c.h = clamp(c.h, 1, f.h - c.y); }
    f.crop = c && (c.w < f.w || c.h < f.h) ? c : null;
    closeCrop();
    renderStitchList();
    renderStitchInfo();
  }

  document.getElementById('stitchCropApply').addEventListener('click', function () { if (cropItem) setCrop(cropItem, cropRect); });
  document.getElementById('stitchCropFull').addEventListener('click', function () { if (cropItem) setCrop(cropItem, null); });
  document.getElementById('stitchCropCancel').addEventListener('click', closeCrop);

  stitchExportBtn.addEventListener('click', function () {
    exportCanvas(buildStitchCanvas(), stitchFormat, 0.92, 'stitch');
  });
  document.getElementById('stitchAnnotateBtn').addEventListener('click', function () {
    var c = buildStitchCanvas();
    if (c) ImageExport.sendToAnnotate(c);
  });

  function alignOffset(align, container, item) {
    if (align === 'center') return Math.round((container - item) / 2);
    if (align === 'end') return Math.round(container - item);
    return 0;
  }

  // ---------- Helpers ----------
  // format: 'png' | 'jpeg' | 'pdf'. Encoding and naming live in js/export.js.
  function exportCanvas(c, format, quality, name) {
    if (!c) return;
    var done = format === 'pdf'
      ? window.canvasToPdf(c).then(function (b) { ImageExport.download(b, ImageExport.fileName(name, 'pdf')); })
      : ImageExport.toBlob(c, format === 'jpeg' ? 'image/jpeg' : 'image/png', format === 'jpeg' ? quality : undefined)
        .then(function (b) { ImageExport.download(b, ImageExport.fileName(name, format === 'jpeg' ? 'jpg' : 'png')); });
    done.then(function () { showToast(t('toast_exported')); }, function () { showToast(t('sz_export_fail')); });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- Init ----------
  syncDirFields();
  renderStitchList();
  updateStitchUI();

  window.onLangChange = function () {
    renderStitchList();
    renderStitchInfo();
  };
})();
