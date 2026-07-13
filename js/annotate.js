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
  const exportBtn = document.getElementById('exportBtn');
  const textInput = document.getElementById('textInput');
  const annotateHint = document.getElementById('annotateHint');
  const toast = document.getElementById('toast');

  const MAX_SIDE = 4096;

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
    if (!file || !file.type.startsWith('image/')) { showToast('Please choose an image'); return; }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      setupImage(image);
    };
    image.onerror = () => { showToast('Could not load image'); URL.revokeObjectURL(url); };
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

  // ---------- Tools & props ----------

  tools.addEventListener('click', e => {
    const btn = e.target.closest('[data-tool]');
    if (!btn) return;
    tool = btn.dataset.tool;
    [...tools.querySelectorAll('.tool')].forEach(b => b.classList.toggle('is-active', b === btn));
    closeTextInput();
    canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
    annotateHint.textContent = ({
      rect: 'Drag to draw a rectangle outline.',
      arrow: 'Drag from tail to head of the arrow.',
      line: 'Drag to draw a straight line.',
      pen: 'Draw freehand strokes.',
      highlight: 'Semi-transparent strokes. Pick a bright color.',
      text: 'Click where you want text, then type and press Enter.',
      mosaic: 'Drag a box to pixelate the area underneath.'
    })[tool];
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

  function onDown(e) {
    if (!img || textOpen) return;
    if (tool === 'text') { openTextInput(e); return; }
    e.preventDefault();
    const p = pos(e);
    drawing = true;
    if (tool === 'pen' || tool === 'highlight') {
      current = { type: tool, points: [{ x: p.x, y: p.y }], color, width: strokeWidth };
    } else {
      current = { type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color, width: strokeWidth };
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
    textInput.style.fontSize = (fontSize * (canvas.getBoundingClientRect().width / canvas.width)) + 'px';
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
      shapes.push({ type: 'text', x: textInput._pos.x, y: textInput._pos.y, text: textInput.value, color, size: fontSize });
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
  textInput.addEventListener('blur', () => closeTextInput(false));

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
    for (const s of shapes) drawShape(s);
    if (current) drawShape(current);
  }

  function drawShape(s) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (s.type === 'rect') {
      const x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2), w = Math.abs(s.x2 - s.x1), h = Math.abs(s.y2 - s.y1);
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width;
      ctx.strokeRect(x, y, w, h);
    } else if (s.type === 'line') {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    } else if (s.type === 'arrow') {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width;
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      const ang = Math.atan2(dy, dx);
      const head = Math.max(12, s.width * 3.5);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - head * Math.cos(ang - Math.PI / 6), s.y2 - head * Math.sin(ang - Math.PI / 6));
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - head * Math.cos(ang + Math.PI / 6), s.y2 - head * Math.sin(ang + Math.PI / 6));
      ctx.stroke();
    } else if (s.type === 'pen' || s.type === 'highlight') {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width;
      ctx.globalAlpha = s.type === 'highlight' ? 0.35 : 1;
      ctx.beginPath();
      const pts = s.points;
      if (pts.length) { ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (s.type === 'text') {
      ctx.fillStyle = s.color;
      ctx.textBaseline = 'top';
      ctx.font = s.size + 'px Inter, system-ui, sans-serif';
      ctx.fillText(s.text, s.x, s.y);
    } else if (s.type === 'mosaic') {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(s.tile, 0, 0, s._tw, s._th, s._x, s._y, s._w, s._h);
      ctx.imageSmoothingEnabled = true;
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

  exportBtn.addEventListener('click', () => {
    if (!img) return;
    try {
      canvas.toBlob(blob => {
        if (!blob) { showToast('Export failed'); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'annotated-' + Date.now() + '.png';
        a.click();
        URL.revokeObjectURL(a.href);
      }, 'image/png');
    } catch (e) {
      showToast('Image is protected \u2014 export blocked');
    }
  });
})();
