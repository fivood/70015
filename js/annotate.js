(function () {
  'use strict';

  const imgDrop = document.getElementById('imgDrop');
  const imgInput = document.getElementById('imgInput');
  const loadPanel = document.getElementById('loadPanel');
  const editorPanel = document.getElementById('editorPanel');
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const tools = document.getElementById('tools');
  const toolColor = document.getElementById('toolColor');
  const toolWidth = document.getElementById('toolWidth');
  const widthValue = document.getElementById('widthValue');
  const toolFont = document.getElementById('toolFont');
  const fontValue = document.getElementById('fontValue');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const replaceBtn = document.getElementById('replaceBtn');
  const textInput = document.getElementById('textInput');
  const annotateHint = document.getElementById('annotateHint');
  const toast = document.getElementById('toast');

  const MAX_SIDE = 4096;
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const MAX_EXPORT_PIXELS = 64 * 1024 * 1024;

  let img = null;
  let naturalW = 0, naturalH = 0, cScale = 1;
  let tool = 'rect';
  let color = '#ef4444';
  let strokeWidth = 4;
  let fontSize = 28;
  let shapes = [];
  let redoStack = [];
  let current = null;
  let drawing = false;
  let textOpen = false;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // ---------- Image loading ----------

  function loadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) { showToast((typeof window.t === 'function') ? window.t('ann_need_image') : 'Please choose an image'); return; }
    if (file.size > MAX_FILE_SIZE) {
      const message = (typeof window.t === 'function') ? window.t('conv_too_large', 'File is too large (max 50 MB)') : 'File is too large (max 50 MB)';
      showToast(message.replace('{name}', file.name));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      setupImage(image);
    };
    image.onerror = () => { showToast((typeof window.t === 'function') ? window.t('ann_load_fail') : 'Could not load image'); URL.revokeObjectURL(url); };
    image.src = url;
  }

  function setupImage(image) {
    img = image;
    naturalW = image.naturalWidth;
    naturalH = image.naturalHeight;
    cScale = Math.min(1, MAX_SIDE / Math.max(naturalW, naturalH));
    canvas.width = Math.round(naturalW * cScale);
    canvas.height = Math.round(naturalH * cScale);
    shapes = [];
    redoStack = [];
    current = null;
    loadPanel.hidden = true;
    editorPanel.hidden = false;
    updateUndoRedo();
    render();
    editorPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  imgInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) loadImageFile(f); imgInput.value = ''; });
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => imgDrop.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); }));
  ['dragenter', 'dragover'].forEach(evt => imgDrop.addEventListener(evt, () => imgDrop.classList.add('is-dragover')));
  ['dragleave', 'drop'].forEach(evt => imgDrop.addEventListener(evt, () => imgDrop.classList.remove('is-dragover')));
  imgDrop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) loadImageFile(f); });
  window.addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const it of items) {
      if (it.type && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) { loadImageFile(f); e.preventDefault(); return; } }
    }
  });

  // Opened via "Annotate" from another tool or the extension (js/export.js).
  ImageExport.receiveAnnotateHandoff(blob => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); setupImage(image); };
    image.src = url; // skips the upload size cap: long screenshots are big by design
  });

  // ---------- Tools & props ----------

  tools.addEventListener('click', e => {
    const btn = e.target.closest('[data-tool]');
    if (!btn) return;
    tool = btn.dataset.tool;
    [...tools.querySelectorAll('.tool')].forEach(b => b.classList.toggle('is-active', b === btn));
    closeTextInput();
    canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
    var hintKeys = {
      rect: 'ann_hint_rect',
      arrow: 'ann_hint_arrow',
      line: 'ann_hint_line',
      pen: 'ann_hint_pen',
      highlight: 'ann_hint_highlight',
      text: 'ann_hint_text',
      mosaic: 'ann_hint_mosaic'
    };
    var hintKey = hintKeys[tool];
    if (typeof window.t === 'function' && hintKey) {
      annotateHint.textContent = window.t(hintKey);
      annotateHint.setAttribute('data-i18n', hintKey);
    }
  });

  toolColor.addEventListener('input', e => color = e.target.value);
  toolWidth.addEventListener('input', e => { strokeWidth = +e.target.value; widthValue.textContent = strokeWidth; });
  toolFont.addEventListener('input', e => { fontSize = +e.target.value; fontValue.textContent = fontSize; });

  // ---------- Pointer / drawing ----------

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (point.clientX - rect.left) * sx,
      y: (point.clientY - rect.top) * sy,
      cssX: point.clientX - rect.left,
      cssY: point.clientY - rect.top,
      rect
    };
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('touchstart', onDown, { passive: false });

  // Canvas px per on-screen CSS px: width/size sliders mean what the user sees,
  // not raw pixels of a (possibly 4000px) image shown at 800px.
  function uiScale() {
    const w = canvas.getBoundingClientRect().width;
    return w ? canvas.width / w : 1;
  }

  function onDown(e) {
    if (!img || textOpen) return;
    if (tool === 'text') { openTextInput(e); return; }
    e.preventDefault();
    const p = pos(e);
    const width = strokeWidth * uiScale();
    drawing = true;
    if (tool === 'pen' || tool === 'highlight') {
      current = { type: tool, points: [{ x: p.x, y: p.y }], color, width };
    } else {
      current = { type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color, width };
    }
    render();
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });

  function onMove(e) {
    if (!drawing || !current) return;
    e.preventDefault();
    const p = pos(e);
    if (current.points) {
      current.points.push({ x: p.x, y: p.y });
    } else {
      current.x2 = p.x; current.y2 = p.y;
    }
    render();
  }

  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchend', onUp);

  function onUp() {
    if (!drawing || !current) return;
    drawing = false;
    const s = current;
    current = null;
    if (s.type === 'pen' || s.type === 'highlight') {
      if (s.points.length > 1) commit(s);
    } else {
      if (Math.abs(s.x2 - s.x1) > 2 || Math.abs(s.y2 - s.y1) > 2) {
        if (s.type === 'mosaic') s.tile = buildMosaicTile(s);
        commit(s);
      } else {
        render();
      }
    }
  }

  function commit(s) {
    shapes.push(s);
    redoStack = [];
    updateUndoRedo();
    render();
  }

  // ---------- Text input overlay ----------

  function openTextInput(e) {
    const p = pos(e);
    const stageRect = stage.getBoundingClientRect();
    textInput.style.left = (p.cssX + (canvas.getBoundingClientRect().left - stageRect.left)) + 'px';
    textInput.style.top = (p.cssY + (canvas.getBoundingClientRect().top - stageRect.top)) + 'px';
    textInput.style.color = color;
    textInput.style.fontSize = fontSize + 'px';
    textInput.hidden = false;
    textInput.value = '';
    textOpen = true;
    textInput._pos = { x: p.x, y: p.y };
    setTimeout(() => textInput.focus(), 0);
  }

  function closeTextInput(commit) {
    if (!textOpen) return;
    textOpen = false;
    if (commit && textInput.value.trim()) {
      shapes.push({ type: 'text', x: textInput._pos.x, y: textInput._pos.y, text: textInput.value, color, size: fontSize * uiScale() });
      redoStack = [];
      updateUndoRedo();
      render();
    }
    textInput.hidden = true;
    textInput.value = '';
  }

  textInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); closeTextInput(true); }
    else if (e.key === 'Escape') { e.preventDefault(); closeTextInput(false); }
  });
  // Clicking away (e.g. straight to Export) keeps the typed text; Escape discards.
  textInput.addEventListener('blur', () => closeTextInput(true));

  // ---------- Mosaic ----------

  function buildMosaicTile(s) {
    const x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2);
    const w = Math.abs(s.x2 - s.x1), h = Math.abs(s.y2 - s.y1);
    const block = clamp(Math.round(Math.min(w, h) / 12), 4, 24);
    const tw = Math.max(1, Math.round(w / block));
    const th = Math.max(1, Math.round(h / block));
    const tile = document.createElement('canvas');
    tile.width = tw; tile.height = th;
    const t = tile.getContext('2d');
    t.imageSmoothingEnabled = true;
    t.imageSmoothingQuality = 'high';
    t.drawImage(img, x / cScale, y / cScale, w / cScale, h / cScale, 0, 0, tw, th);
    s._x = x; s._y = y; s._w = w; s._h = h; s._tw = tw; s._th = th;
    return tile;
  }

  // ---------- Rendering ----------

  function render() {
    if (!img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const s of shapes) drawShape(s, ctx, 1);
    if (current) drawShape(current, ctx, 1);
  }

  function drawShape(s, targetCtx, scale) {
    targetCtx = targetCtx || ctx;
    scale = scale || 1;
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    if (s.type === 'rect') {
      const x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2), w = Math.abs(s.x2 - s.x1), h = Math.abs(s.y2 - s.y1);
      targetCtx.strokeStyle = s.color; targetCtx.lineWidth = s.width * scale;
      targetCtx.strokeRect(x * scale, y * scale, w * scale, h * scale);
    } else if (s.type === 'line') {
      targetCtx.strokeStyle = s.color; targetCtx.lineWidth = s.width * scale;
      targetCtx.beginPath(); targetCtx.moveTo(s.x1 * scale, s.y1 * scale); targetCtx.lineTo(s.x2 * scale, s.y2 * scale); targetCtx.stroke();
    } else if (s.type === 'arrow') {
      targetCtx.strokeStyle = s.color; targetCtx.lineWidth = s.width * scale;
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      const ang = Math.atan2(dy, dx);
      const head = Math.max(12, s.width * 3.5) * scale;
      targetCtx.beginPath(); targetCtx.moveTo(s.x1 * scale, s.y1 * scale); targetCtx.lineTo(s.x2 * scale, s.y2 * scale); targetCtx.stroke();
      targetCtx.beginPath();
      targetCtx.moveTo(s.x2 * scale, s.y2 * scale);
      targetCtx.lineTo((s.x2 - head / scale * Math.cos(ang - Math.PI / 6)) * scale, (s.y2 - head / scale * Math.sin(ang - Math.PI / 6)) * scale);
      targetCtx.moveTo(s.x2 * scale, s.y2 * scale);
      targetCtx.lineTo((s.x2 - head / scale * Math.cos(ang + Math.PI / 6)) * scale, (s.y2 - head / scale * Math.sin(ang + Math.PI / 6)) * scale);
      targetCtx.stroke();
    } else if (s.type === 'pen' || s.type === 'highlight') {
      targetCtx.strokeStyle = s.color; targetCtx.lineWidth = s.width * scale;
      targetCtx.globalAlpha = s.type === 'highlight' ? 0.35 : 1;
      targetCtx.beginPath();
      const pts = s.points;
      if (pts.length) { targetCtx.moveTo(pts[0].x * scale, pts[0].y * scale); for (let i = 1; i < pts.length; i++) targetCtx.lineTo(pts[i].x * scale, pts[i].y * scale); }
      targetCtx.stroke();
      targetCtx.globalAlpha = 1;
    } else if (s.type === 'text') {
      targetCtx.fillStyle = s.color;
      targetCtx.textBaseline = 'top';
      targetCtx.font = (s.size * scale) + 'px Inter, system-ui, sans-serif';
      targetCtx.fillText(s.text, s.x * scale, s.y * scale);
    } else if (s.type === 'mosaic') {
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.drawImage(s.tile, 0, 0, s._tw, s._th, s._x * scale, s._y * scale, s._w * scale, s._h * scale);
      targetCtx.imageSmoothingEnabled = true;
    }
  }

  // ---------- Undo / redo / clear ----------

  function updateUndoRedo() {
    undoBtn.disabled = shapes.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  function undo() {
    if (!shapes.length) return;
    redoStack.push(shapes.pop());
    updateUndoRedo();
    render();
  }

  function redo() {
    if (!redoStack.length) return;
    shapes.push(redoStack.pop());
    updateUndoRedo();
    render();
  }

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  clearBtn.addEventListener('click', () => { redoStack = shapes.slice(); shapes = []; updateUndoRedo(); render(); });
  replaceBtn.addEventListener('click', () => { editorPanel.hidden = true; loadPanel.hidden = false; img = null; });

  document.addEventListener('keydown', e => {
    if (textOpen || !img) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault(); redo();
    }
  });

  // ---------- Export ----------

  // Full-resolution image with annotations, for the shared export buttons.
  function buildExportCanvas() {
    if (!img) return null;
    if (naturalW * naturalH > MAX_EXPORT_PIXELS) {
      showToast((typeof window.t === 'function') ? window.t('ann_export_fail') : 'Image is too large to export at full resolution');
      return null;
    }
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = naturalW;
    exportCanvas.height = naturalH;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.drawImage(img, 0, 0, naturalW, naturalH);
    const exportScale = 1 / cScale;
    for (const s of shapes) drawShape(s, exportCtx, exportScale);
    return exportCanvas;
  }

  ImageExport.mountActions(document.getElementById('exportActions'), buildExportCanvas, { name: 'annotated', skip: ['annotate'] });
})();
