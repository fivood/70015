/**
 * Web Toolbox — Image Size
 * Crop, stitch, and resize images in the browser.
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

  var MAX_SIDE = 4096;

  // ---------- Mode switching ----------
  var modeSelector = document.getElementById('modeSelector');
  var modeNote = document.getElementById('modeNote');
  var cropPanel = document.getElementById('cropPanel');
  var stitchPanel = document.getElementById('stitchPanel');
  var scalePanel = document.getElementById('scalePanel');
  var mode = 'crop';

  var MODE_NOTES = {
    crop: 'sz_crop_note',
    stitch: 'sz_stitch_note',
    scale: 'sz_scale_note'
  };

  function setMode(m) {
    mode = m;
    [].forEach.call(modeSelector.querySelectorAll('.segmented__btn'), function (b) {
      b.classList.toggle('is-active', b.dataset.mode === m);
    });
    cropPanel.hidden = m !== 'crop';
    stitchPanel.hidden = m !== 'stitch';
    scalePanel.hidden = m !== 'scale';
    modeNote.textContent = t(MODE_NOTES[m]);
  }
  modeSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mode]');
    if (btn) setMode(btn.dataset.mode);
  });

  // ============================================================
  // CROP
  // ============================================================
  var cropDrop = document.getElementById('cropDrop');
  var cropInput = document.getElementById('cropInput');
  var cropSettings = document.getElementById('cropSettings');
  var cropStageWrap = document.getElementById('cropStageWrap');
  var cropStage = document.getElementById('cropStage');
  var cropCanvas = document.getElementById('cropCanvas');
  var cctx = cropCanvas.getContext('2d');
  var cropHint = document.getElementById('cropHint');
  var cropActions = document.getElementById('cropActions');
  var cropInfo = document.getElementById('cropInfo');
  var ratioSelector = document.getElementById('ratioSelector');
  var cropWInput = document.getElementById('cropW');
  var cropHInput = document.getElementById('cropH');
  var cropFormatSelector = document.getElementById('cropFormatSelector');
  var cropQualityPanel = document.getElementById('cropQualityPanel');
  var cropQuality = document.getElementById('cropQuality');
  var cropQualityValue = document.getElementById('cropQualityValue');
  var cropResetBtn = document.getElementById('cropResetBtn');
  var cropReplaceBtn = document.getElementById('cropReplaceBtn');
  var cropExportBtn = document.getElementById('cropExportBtn');

  var cImg = null;
  var cNatW = 0, cNatH = 0, cScale = 1;
  var crop = { x: 0, y: 0, w: 0, h: 0 }; // in canvas (display) px
  var ratio = null; // {w,h} or null=free
  var cropFormat = 'png';
  var drag = null; // { mode: 'draw'|'move'|'resize', handle, startRect, startX, startY }

  function loadCropImage(file) {
    if (!file || !file.type.startsWith('image/')) { showToast(t('sz_need_image')); return; }
    var url = URL.createObjectURL(file);
    var image = new Image();
    image.onload = function () {
      URL.revokeObjectURL(url);
      setupCropImage(image);
    };
    image.onerror = function () { showToast(t('sz_load_fail')); URL.revokeObjectURL(url); };
    image.src = url;
  }

  function setupCropImage(image) {
    cImg = image;
    cNatW = image.naturalWidth;
    cNatH = image.naturalHeight;
    cScale = Math.min(1, MAX_SIDE / Math.max(cNatW, cNatH));
    cropCanvas.width = Math.round(cNatW * cScale);
    cropCanvas.height = Math.round(cNatH * cScale);
    crop = { x: 0, y: 0, w: cropCanvas.width, h: cropCanvas.height };
    cropSettings.hidden = false;
    cropStageWrap.hidden = false;
    cropActions.hidden = false;
    applyRatioToCrop();
    renderCrop();
    cropStage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  cropInput.addEventListener('change', function (e) {
    var f = e.target.files[0]; if (f) loadCropImage(f); cropInput.value = '';
  });
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (evt) {
    cropDrop.addEventListener(evt, function (e) { e.preventDefault(); e.stopPropagation(); });
  });
  ['dragenter', 'dragover'].forEach(function (evt) {
    cropDrop.addEventListener(evt, function () { cropDrop.classList.add('is-dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    cropDrop.addEventListener(evt, function () { cropDrop.classList.remove('is-dragover'); });
  });
  cropDrop.addEventListener('drop', function (e) {
    var f = e.dataTransfer.files[0]; if (f) loadCropImage(f);
  });

  // Ratio
  ratioSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-ratio]');
    if (!btn) return;
    [].forEach.call(ratioSelector.querySelectorAll('.chip--btn'), function (b) { b.classList.remove('is-active'); });
    btn.classList.add('is-active');
    var r = btn.dataset.ratio;
    if (r === 'free') ratio = null;
    else { var parts = r.split(':'); ratio = { w: +parts[0], h: +parts[1] }; }
    applyRatioToCrop();
    renderCrop();
  });

  function applyRatioToCrop() {
    if (!ratio || !crop.w || !crop.h) return;
    var target = ratio.w / ratio.h;
    var cur = crop.w / crop.h;
    if (Math.abs(target - cur) < 0.001) return;
    // keep center, adjust height to match ratio (constrained by bounds)
    var cx = crop.x + crop.w / 2, cy = crop.y + crop.h / 2;
    var newW = crop.w;
    var newH = Math.round(crop.w / target);
    if (newH > cropCanvas.height) {
      newH = cropCanvas.height;
      newW = Math.round(newH * target);
    }
    crop.w = newW; crop.h = newH;
    crop.x = clamp(Math.round(cx - crop.w / 2), 0, cropCanvas.width - crop.w);
    crop.y = clamp(Math.round(cy - crop.h / 2), 0, cropCanvas.height - crop.h);
  }

  // Format
  cropFormatSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-value]');
    if (!btn) return;
    [].forEach.call(cropFormatSelector.querySelectorAll('.segmented__btn'), function (b) { b.classList.remove('is-active'); });
    btn.classList.add('is-active');
    cropFormat = btn.dataset.value;
    cropQualityPanel.hidden = cropFormat !== 'jpeg';
  });
  cropQuality.addEventListener('input', function (e) { cropQualityValue.textContent = e.target.value; });

  // ---------- Crop pointer interaction ----------
  function pos(e) {
    var rect = cropCanvas.getBoundingClientRect();
    var point = e.touches ? e.touches[0] : e;
    var sx = cropCanvas.width / rect.width;
    var sy = cropCanvas.height / rect.height;
    return {
      x: (point.clientX - rect.left) * sx,
      y: (point.clientY - rect.top) * sy,
      rect: rect
    };
  }

  var HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  var HANDLE_SIZE = 16; // px hit area in canvas coords (scaled)

  function handleRects(r) {
    var hs = Math.max(10, HANDLE_SIZE);
    var map = {};
    var x = r.x, y = r.y, w = r.w, h = r.h;
    map.nw = { x: x - hs / 2, y: y - hs / 2, w: hs, h: hs };
    map.n = { x: x + w / 2 - hs / 2, y: y - hs / 2, w: hs, h: hs };
    map.ne = { x: x + w - hs / 2, y: y - hs / 2, w: hs, h: hs };
    map.e = { x: x + w - hs / 2, y: y + h / 2 - hs / 2, w: hs, h: hs };
    map.se = { x: x + w - hs / 2, y: y + h - hs / 2, w: hs, h: hs };
    map.s = { x: x + w / 2 - hs / 2, y: y + h - hs / 2, w: hs, h: hs };
    map.sw = { x: x - hs / 2, y: y + h - hs / 2, w: hs, h: hs };
    map.w = { x: x - hs / 2, y: y + h / 2 - hs / 2, w: hs, h: hs };
    return map;
  }

  function hitTest(a, p) {
    return p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h;
  }

  function getHandleAt(p) {
    var hr = handleRects(crop);
    for (var i = 0; i < HANDLES.length; i++) {
      if (hitTest(hr[HANDLES[i]], p)) return HANDLES[i];
    }
    return null;
  }

  function insideCrop(p) {
    return p.x >= crop.x && p.x <= crop.x + crop.w && p.y >= crop.y && p.y <= crop.y + crop.h;
  }

  cropCanvas.addEventListener('mousedown', onCropDown);
  cropCanvas.addEventListener('touchstart', onCropDown, { passive: false });

  function onCropDown(e) {
    if (!cImg) return;
    e.preventDefault();
    var p = pos(e);
    var h = getHandleAt(p);
    if (h) {
      drag = { mode: 'resize', handle: h, startRect: { x: crop.x, y: crop.y, w: crop.w, h: crop.h }, startX: p.x, startY: p.y };
    } else if (insideCrop(p)) {
      drag = { mode: 'move', startRect: { x: crop.x, y: crop.y, w: crop.w, h: crop.h }, startX: p.x, startY: p.y };
    } else {
      // draw new
      drag = { mode: 'draw', startX: p.x, startY: p.y };
      crop = { x: p.x, y: p.y, w: 0, h: 0 };
    }
    renderCrop();
  }

  document.addEventListener('mousemove', onCropMove);
  document.addEventListener('touchmove', onCropMove, { passive: false });

  function onCropMove(e) {
    if (!drag || !cImg) return;
    e.preventDefault();
    var p = pos(e);
    if (drag.mode === 'draw') {
      var x0 = Math.min(drag.startX, p.x);
      var y0 = Math.min(drag.startY, p.y);
      var w = Math.abs(p.x - drag.startX);
      var h = Math.abs(p.y - drag.startY);
      if (ratio) {
        var target = ratio.w / ratio.h;
        if (w / target <= h) h = Math.round(w / target);
        else w = Math.round(h * target);
      }
      crop.x = clamp(x0, 0, cropCanvas.width);
      crop.y = clamp(y0, 0, cropCanvas.height);
      crop.w = clamp(w, 1, cropCanvas.width - crop.x);
      crop.h = clamp(h, 1, cropCanvas.height - crop.y);
    } else if (drag.mode === 'move') {
      var dx = p.x - drag.startX;
      var dy = p.y - drag.startY;
      crop.x = clamp(drag.startRect.x + dx, 0, cropCanvas.width - drag.startRect.w);
      crop.y = clamp(drag.startRect.y + dy, 0, cropCanvas.height - drag.startRect.h);
      crop.w = drag.startRect.w;
      crop.h = drag.startRect.h;
    } else if (drag.mode === 'resize') {
      resizeCrop(drag.handle, p, drag.startRect);
    }
    renderCrop();
  }

  document.addEventListener('mouseup', onCropUp);
  document.addEventListener('touchend', onCropUp);

  function onCropUp() {
    if (!drag) return;
    drag = null;
    if (crop.w < 2 || crop.h < 2) {
      crop = { x: 0, y: 0, w: cropCanvas.width, h: cropCanvas.height };
    }
    applyRatioToCrop();
    renderCrop();
  }

  function resizeCrop(handle, p, s) {
    var min = 8;
    var left = s.x, top = s.y, right = s.x + s.w, bottom = s.y + s.h;
    if (handle.indexOf('w') >= 0) left = clamp(p.x, 0, right - min);
    if (handle.indexOf('n') >= 0) top = clamp(p.y, 0, bottom - min);
    if (handle.indexOf('e') >= 0) right = clamp(p.x, left + min, cropCanvas.width);
    if (handle.indexOf('s') >= 0) bottom = clamp(p.y, top + min, cropCanvas.height);
    var nx = left, ny = top, nw = right - left, nh = bottom - top;
    if (ratio) {
      var target = ratio.w / ratio.h;
      // Adjust the non-anchored dimension based on handle
      if (handle === 'e' || handle === 'w') {
        nh = Math.round(nw / target);
        if (handle === 'e') { ny = s.y; }
        else { ny = s.y + s.h - nh; }
        if (ny < 0) { ny = 0; }
        if (ny + nh > cropCanvas.height) { nh = cropCanvas.height - ny; nw = Math.round(nh * target); }
      } else if (handle === 'n' || handle === 's') {
        nw = Math.round(nh * target);
        if (handle === 's') { nx = s.x; }
        else { nx = s.x + s.w - nw; }
        if (nx < 0) nx = 0;
        if (nx + nw > cropCanvas.width) { nw = cropCanvas.width - nx; nh = Math.round(nw / target); }
      } else {
        // corner — fit to ratio by expanding the smaller-derived
        var byW = nw / target;
        var byH = nh * target;
        if (byW <= nh) { nh = byW; } else { nw = byH; }
        if (handle === 'nw') { nx = right - nw; ny = bottom - nh; }
        else if (handle === 'ne') { ny = bottom - nh; }
        else if (handle === 'sw') { nx = right - nw; }
        // se: keep top/left
        nx = clamp(nx, 0, cropCanvas.width - nw);
        ny = clamp(ny, 0, cropCanvas.height - nh);
      }
    }
    crop.x = Math.round(nx); crop.y = Math.round(ny); crop.w = Math.round(nw); crop.h = Math.round(nh);
  }

  // ---------- Crop render ----------
  function renderCrop() {
    if (!cImg) return;
    var W = cropCanvas.width, H = cropCanvas.height;
    cctx.clearRect(0, 0, W, H);
    cctx.drawImage(cImg, 0, 0, W, H);
    // dim outside crop
    cctx.fillStyle = 'rgba(0,0,0,0.5)';
    cctx.fillRect(0, 0, W, crop.y);
    cctx.fillRect(0, crop.y, crop.x, crop.h);
    cctx.fillRect(crop.x + crop.w, crop.y, W - (crop.x + crop.w), crop.h);
    cctx.fillRect(0, crop.y + crop.h, W, H - (crop.y + crop.h));
    // crop border
    cctx.strokeStyle = '#ffffff';
    cctx.lineWidth = 1.5;
    cctx.strokeRect(crop.x + 0.5, crop.y + 0.5, crop.w - 1, crop.h - 1);
    cctx.strokeStyle = 'rgba(0,0,0,0.4)';
    cctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
    // rule-of-thirds guide
    cctx.strokeStyle = 'rgba(255,255,255,0.35)';
    cctx.lineWidth = 1;
    cctx.beginPath();
    for (var i = 1; i < 3; i++) {
      cctx.moveTo(crop.x + crop.w * i / 3, crop.y);
      cctx.lineTo(crop.x + crop.w * i / 3, crop.y + crop.h);
      cctx.moveTo(crop.x, crop.y + crop.h * i / 3);
      cctx.lineTo(crop.x + crop.w, crop.y + crop.h * i / 3);
    }
    cctx.stroke();
    // handles
    var hr = handleRects(crop);
    HANDLES.forEach(function (id) {
      var r = hr[id];
      cctx.fillStyle = '#ffffff';
      cctx.strokeStyle = 'rgba(0,0,0,0.6)';
      cctx.lineWidth = 1;
      cctx.fillRect(r.x, r.y, r.w, r.h);
      cctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    });
    // info
    var natW = Math.round(crop.w / cScale), natH = Math.round(crop.h / cScale);
    cropInfo.textContent = t('sz_crop_info').replace('{w}', natW).replace('{h}', natH);
  }

  cropResetBtn.addEventListener('click', function () {
    if (!cImg) return;
    crop = { x: 0, y: 0, w: cropCanvas.width, h: cropCanvas.height };
    applyRatioToCrop();
    renderCrop();
  });
  cropReplaceBtn.addEventListener('click', function () {
    cImg = null; cropSettings.hidden = true; cropStageWrap.hidden = true; cropActions.hidden = true;
  });

  cropExportBtn.addEventListener('click', function () {
    if (!cImg) return;
    var sx = crop.x / cScale, sy = crop.y / cScale, sw = crop.w / cScale, sh = crop.h / cScale;
    var tw = parseInt(cropWInput.value, 10) || Math.round(sw);
    var th = parseInt(cropHInput.value, 10) || Math.round(sh);
    tw = clamp(tw, 1, 16384); th = clamp(th, 1, 16384);
    var c = document.createElement('canvas');
    c.width = tw; c.height = th;
    var cx = c.getContext('2d');
    if (cropFormat === 'jpeg') { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, tw, th); }
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    try {
      cx.drawImage(cImg, sx, sy, sw, sh, 0, 0, tw, th);
    } catch (err) { showToast(t('sz_export_fail')); return; }
    var mime = cropFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    var q = cropFormat === 'jpeg' ? (parseInt(cropQuality.value, 10) / 100) : 1;
    c.toBlob(function (blob) {
      if (!blob) { showToast(t('sz_export_fail')); return; }
      downloadBlob(blob, 'crop-' + Date.now() + (cropFormat === 'jpeg' ? '.jpg' : '.png'));
      showToast(t('toast_exported'));
    }, mime, q);
  });

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
  var stitchDir = 'h';
  var stitchAlign = 'start';
  var stitchBg = '#ffffff';
  var stitchFormat = 'png';

  function addStitchFiles(files) {
    var imgs = [].filter.call(files, function (f) { return f.type.startsWith('image/'); });
    if (!imgs.length) { showToast(t('sz_need_image')); return; }
    var pending = imgs.length;
    imgs.forEach(function (f) {
      var url = URL.createObjectURL(f);
      var image = new Image();
      image.onload = function () {
        URL.revokeObjectURL(url);
        stitchFiles.push({ id: Math.random().toString(36).slice(2, 10), file: f, img: image, w: image.naturalWidth, h: image.naturalHeight });
        pending--;
        if (pending === 0) { renderStitchList(); updateStitchUI(); }
      };
      image.onerror = function () { URL.revokeObjectURL(url); pending--; if (pending === 0) { renderStitchList(); updateStitchUI(); } };
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
        '<img src="' + it.img.src + '" alt="">' +
        '<div class="sz-stitch-item__info">' +
        '<p class="sz-stitch-item__name">' + escapeHtml(it.file.name) + '</p>' +
        '<p class="sz-stitch-item__meta">' + it.w + ' × ' + it.h + '</p>' +
        '</div>' +
        '<div class="sz-stitch-item__btns">' +
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
    if (act === 'up' && idx > 0) { var a = stitchFiles[idx]; stitchFiles[idx] = stitchFiles[idx - 1]; stitchFiles[idx - 1] = a; renderStitchList(); renderStitchInfo(); }
    else if (act === 'down' && idx < stitchFiles.length - 1) { var b = stitchFiles[idx]; stitchFiles[idx] = stitchFiles[idx + 1]; stitchFiles[idx + 1] = b; renderStitchList(); renderStitchInfo(); }
    else if (act === 'del') {
      stitchFiles.splice(idx, 1); renderStitchList(); updateStitchUI();
    }
  });

  stitchDirSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-value]');
    if (!btn) return;
    [].forEach.call(stitchDirSelector.querySelectorAll('.segmented__btn'), function (b) { b.classList.remove('is-active'); });
    btn.classList.add('is-active');
    stitchDir = btn.dataset.value;
    stitchColsField.style.display = stitchDir === 'grid' ? '' : 'none';
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
  stitchClearBtn.addEventListener('click', function () { stitchFiles = []; renderStitchList(); updateStitchUI(); });

  function renderStitchInfo() {
    if (!stitchFiles.length) { stitchInfo.textContent = '—'; return; }
    var layout = computeStitchLayout();
    stitchInfo.textContent = layout.w + ' × ' + layout.h + ' px';
  }

  function computeStitchLayout() {
    var n = stitchFiles.length;
    var gap = Math.max(0, parseInt(stitchGap.value, 10) || 0);
    if (stitchDir === 'h') {
      var commonH = Math.min.apply(null, stitchFiles.map(function (f) { return f.h; }));
      var scaled = stitchFiles.map(function (f) { return { img: f.img, w: Math.round(f.w * commonH / f.h), h: commonH }; });
      var totalW = scaled.reduce(function (s, f) { return s + f.w; }, 0) + gap * (n - 1);
      return { w: totalW, h: commonH, scaled: scaled, dir: 'h', gap: gap };
    } else if (stitchDir === 'v') {
      var commonW = Math.min.apply(null, stitchFiles.map(function (f) { return f.w; }));
      var scaledV = stitchFiles.map(function (f) { return { img: f.img, w: commonW, h: Math.round(f.h * commonW / f.w) }; });
      var totalH = scaledV.reduce(function (s, f) { return s + f.h; }, 0) + gap * (n - 1);
      return { w: commonW, h: totalH, scaled: scaledV, dir: 'v', gap: gap };
    } else {
      var cols = clamp(parseInt(stitchCols.value, 10) || 2, 1, 12);
      var rows = Math.ceil(n / cols);
      var cellW = Math.max.apply(null, stitchFiles.map(function (f) { return f.w; }));
      var cellH = Math.max.apply(null, stitchFiles.map(function (f) { return f.h; }));
      var totalW = cols * cellW + gap * (cols - 1);
      var totalH = rows * cellH + gap * (rows - 1);
      return { w: totalW, h: totalH, cols: cols, rows: rows, cellW: cellW, cellH: cellH, dir: 'grid', gap: gap };
    }
  }

  stitchExportBtn.addEventListener('click', function () {
    if (stitchFiles.length < 2) { showToast(t('sz_stitch_need_two')); return; }
    var layout = computeStitchLayout();
    var c = document.createElement('canvas');
    c.width = layout.w; c.height = layout.h;
    var cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    if (stitchBg !== 'transparent') { cx.fillStyle = stitchBg; cx.fillRect(0, 0, layout.w, layout.h); }
    var gap = layout.gap;
    if (layout.dir === 'h') {
      var x = 0;
      for (var i = 0; i < layout.scaled.length; i++) {
        var s = layout.scaled[i];
        var y = alignOffset(stitchAlign, layout.h, s.h);
        cx.drawImage(s.img, x, y, s.w, s.h);
        x += s.w + gap;
      }
    } else if (layout.dir === 'v') {
      var yy = 0;
      for (var j = 0; j < layout.scaled.length; j++) {
        var sv = layout.scaled[j];
        var xx = alignOffset(stitchAlign, layout.w, sv.w);
        cx.drawImage(sv.img, xx, yy, sv.w, sv.h);
        yy += sv.h + gap;
      }
    } else {
      var cellW = layout.cellW, cellH = layout.cellH;
      for (var k = 0; k < stitchFiles.length; k++) {
        var f = stitchFiles[k];
        var col = k % layout.cols;
        var row = Math.floor(k / layout.cols);
        var cellX = col * (cellW + gap);
        var cellY = row * (cellH + gap);
        // contain-fit within cell, aligned
        var scale = Math.min(cellW / f.w, cellH / f.h);
        var dw = Math.round(f.w * scale), dh = Math.round(f.h * scale);
        var ox = alignOffset(stitchAlign, cellW, dw);
        var oy = alignOffset(stitchAlign, cellH, dh);
        cx.drawImage(f.img, cellX + ox, cellY + oy, dw, dh);
      }
    }
    var mime = stitchFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    if (stitchFormat === 'jpeg' && stitchBg === 'transparent') {
      // jpeg has no alpha — fill white
      var tmp = document.createElement('canvas'); tmp.width = layout.w; tmp.height = layout.h;
      var tx = tmp.getContext('2d'); tx.fillStyle = '#ffffff'; tx.fillRect(0, 0, layout.w, layout.h);
      tx.drawImage(c, 0, 0);
      c = tmp;
    }
    c.toBlob(function (blob) {
      if (!blob) { showToast(t('sz_export_fail')); return; }
      downloadBlob(blob, 'stitch-' + Date.now() + (stitchFormat === 'jpeg' ? '.jpg' : '.png'));
      showToast(t('toast_exported'));
    }, mime, stitchFormat === 'jpeg' ? 0.92 : 1);
  });

  function alignOffset(align, container, item) {
    if (align === 'center') return Math.round((container - item) / 2);
    if (align === 'end') return Math.round(container - item);
    return 0;
  }

  // ============================================================
  // SCALE
  // ============================================================
  var scaleDrop = document.getElementById('scaleDrop');
  var scaleInput = document.getElementById('scaleInput');
  var scaleSettings = document.getElementById('scaleSettings');
  var scaleActions = document.getElementById('scaleActions');
  var scaleInfo = document.getElementById('scaleInfo');
  var scaleOrigInfo = document.getElementById('scaleOrigInfo');
  var scalePresetSelector = document.getElementById('scalePresetSelector');
  var scaleWInput = document.getElementById('scaleW');
  var scaleHInput = document.getElementById('scaleH');
  var scaleLock = document.getElementById('scaleLock');
  var scaleFormatSelector = document.getElementById('scaleFormatSelector');
  var scaleQualityPanel = document.getElementById('scaleQualityPanel');
  var scaleQuality = document.getElementById('scaleQuality');
  var scaleQualityValue = document.getElementById('scaleQualityValue');
  var scaleReplaceBtn = document.getElementById('scaleReplaceBtn');
  var scaleExportBtn = document.getElementById('scaleExportBtn');

  var sImg = null, sNatW = 0, sNatH = 0, scaleFormat = 'png';

  function loadScaleImage(file) {
    if (!file || !file.type.startsWith('image/')) { showToast(t('sz_need_image')); return; }
    var url = URL.createObjectURL(file);
    var image = new Image();
    image.onload = function () { URL.revokeObjectURL(url); setupScaleImage(image); };
    image.onerror = function () { showToast(t('sz_load_fail')); URL.revokeObjectURL(url); };
    image.src = url;
  }

  function setupScaleImage(image) {
    sImg = image;
    sNatW = image.naturalWidth;
    sNatH = image.naturalHeight;
    scaleWInput.value = sNatW;
    scaleHInput.value = sNatH;
    scaleSettings.hidden = false;
    scaleActions.hidden = false;
    updateScaleInfo();
  }

  scaleInput.addEventListener('change', function (e) { var f = e.target.files[0]; if (f) loadScaleImage(f); scaleInput.value = ''; });
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (evt) {
    scaleDrop.addEventListener(evt, function (e) { e.preventDefault(); e.stopPropagation(); });
  });
  ['dragenter', 'dragover'].forEach(function (evt) {
    scaleDrop.addEventListener(evt, function () { scaleDrop.classList.add('is-dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    scaleDrop.addEventListener(evt, function () { scaleDrop.classList.remove('is-dragover'); });
  });
  scaleDrop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) loadScaleImage(f); });

  scalePresetSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-scale]');
    if (!btn || !sImg) return;
    var pct = +btn.dataset.scale;
    scaleWInput.value = Math.max(1, Math.round(sNatW * pct / 100));
    scaleHInput.value = Math.max(1, Math.round(sNatH * pct / 100));
    updateScaleInfo();
  });

  scaleWInput.addEventListener('input', function () {
    if (scaleLock.checked && sNatW && sNatH && scaleWInput.value) {
      scaleHInput.value = Math.max(1, Math.round(+scaleWInput.value * sNatH / sNatW));
    }
    updateScaleInfo();
  });
  scaleHInput.addEventListener('input', function () {
    if (scaleLock.checked && sNatW && sNatH && scaleHInput.value) {
      scaleWInput.value = Math.max(1, Math.round(+scaleHInput.value * sNatW / sNatH));
    }
    updateScaleInfo();
  });

  scaleFormatSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-value]');
    if (!btn) return;
    [].forEach.call(scaleFormatSelector.querySelectorAll('.segmented__btn'), function (b) { b.classList.remove('is-active'); });
    btn.classList.add('is-active');
    scaleFormat = btn.dataset.value;
    scaleQualityPanel.hidden = scaleFormat !== 'jpeg';
  });
  scaleQuality.addEventListener('input', function (e) { scaleQualityValue.textContent = e.target.value; });
  scaleReplaceBtn.addEventListener('click', function () { sImg = null; scaleSettings.hidden = true; scaleActions.hidden = true; });

  function updateScaleInfo() {
    if (!sImg) { scaleInfo.textContent = '—'; scaleOrigInfo.textContent = '—'; return; }
    scaleOrigInfo.textContent = t('sz_orig_info').replace('{w}', sNatW).replace('{h}', sNatH);
    var tw = parseInt(scaleWInput.value, 10) || 0;
    var th = parseInt(scaleHInput.value, 10) || 0;
    scaleInfo.textContent = t('sz_target_info').replace('{w}', tw).replace('{h}', th);
  }

  scaleExportBtn.addEventListener('click', function () {
    if (!sImg) return;
    var tw = clamp(parseInt(scaleWInput.value, 10) || sNatW, 1, 16384);
    var th = clamp(parseInt(scaleHInput.value, 10) || sNatH, 1, 16384);
    var c = document.createElement('canvas');
    c.width = tw; c.height = th;
    var cx = c.getContext('2d');
    if (scaleFormat === 'jpeg') { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, tw, th); }
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    try { cx.drawImage(sImg, 0, 0, tw, th); }
    catch (err) { showToast(t('sz_export_fail')); return; }
    var mime = scaleFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    var q = scaleFormat === 'jpeg' ? (parseInt(scaleQuality.value, 10) / 100) : 1;
    c.toBlob(function (blob) {
      if (!blob) { showToast(t('sz_export_fail')); return; }
      downloadBlob(blob, 'resize-' + Date.now() + (scaleFormat === 'jpeg' ? '.jpg' : '.png'));
      showToast(t('toast_exported'));
    }, mime, q);
  });

  // ---------- Shared helpers ----------
  function downloadBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Paste support for crop & scale
  window.addEventListener('paste', function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.startsWith('image/')) {
        var f = items[i].getAsFile();
        if (f) {
          if (mode === 'crop') loadCropImage(f);
          else if (mode === 'scale') loadScaleImage(f);
          e.preventDefault();
          return;
        }
      }
    }
  });

  // ---------- Init ----------
  setMode('crop');
  renderStitchList();
  updateStitchUI();

  // Re-apply dynamic text on language change
  window.onLangChange = function () {
    modeNote.textContent = t(MODE_NOTES[mode]);
    if (cImg) renderCrop();
    renderStitchList();
    renderStitchInfo();
    if (sImg) updateScaleInfo();
  };
})();
