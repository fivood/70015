(function () {
  'use strict';

  const drop = document.getElementById('editorDrop');
  const input = document.getElementById('editorInput');
  const workspace = document.getElementById('editorWorkspace');
  const stage = document.getElementById('editorStage');
  const canvas = document.getElementById('editorCanvas');
  const cropBox = document.getElementById('editorCropBox');
  const info = document.getElementById('editorInfo');
  const cornerRadius = document.getElementById('cornerRadius');
  const cornerRadiusValue = document.getElementById('cornerRadiusValue');
  const backgroundColor = document.getElementById('backgroundColor');
  const transparentBackground = document.getElementById('transparentBackground');
  const effectSelector = document.getElementById('effectSelector');
  const effectAmountRow = document.getElementById('effectAmountRow');
  const effectAmount = document.getElementById('effectAmount');
  const effectAmountValue = document.getElementById('effectAmountValue');
  const watermarkText = document.getElementById('watermarkText');
  const watermarkColor = document.getElementById('watermarkColor');
  const watermarkOpacity = document.getElementById('watermarkOpacity');
  const watermarkOpacityValue = document.getElementById('watermarkOpacityValue');
  const exportFormatSelector = document.getElementById('exportFormatSelector');
  const downloadEditedBtn = document.getElementById('downloadEditedBtn');
  const toast = document.getElementById('toast');

  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  const MAX_OUTPUT_PIXELS = 64 * 1024 * 1024;
  const state = {
    file: null,
    originalImage: null,
    source: null,
    objectUrl: null,
    angle: 0,
    flipX: false,
    flipY: false,
    crop: null,
    cropDrag: null,
    radius: 0,
    background: '#ffffff',
    transparent: true,
    effect: 'none',
    effectAmount: 12,
    watermark: '',
    watermarkColor: '#ffffff',
    watermarkOpacity: 0.7,
    format: 'png'
  };

  function t(key, fallback) {
    return typeof window.t === 'function' ? window.t(key) : fallback;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2500);
  }

  function sourceSize(source) {
    return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
  }

  function clearObjectUrl() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  function resetOptions() {
    state.angle = 0;
    state.flipX = false;
    state.flipY = false;
    state.crop = null;
    state.radius = 0;
    state.background = '#ffffff';
    state.transparent = true;
    state.effect = 'none';
    state.effectAmount = 12;
    state.watermark = '';
    state.watermarkColor = '#ffffff';
    state.watermarkOpacity = 0.7;
    state.format = 'png';
    cornerRadius.value = '0';
    cornerRadiusValue.textContent = '0';
    backgroundColor.value = '#ffffff';
    transparentBackground.checked = true;
    effectAmount.value = '12';
    effectAmountValue.textContent = '12';
    watermarkText.value = '';
    watermarkColor.value = '#ffffff';
    watermarkOpacity.value = '70';
    watermarkOpacityValue.textContent = '70';
    effectSelector.querySelectorAll('[data-value]').forEach((button) => button.classList.toggle('is-active', button.dataset.value === 'none'));
    exportFormatSelector.querySelectorAll('[data-value]').forEach((button) => button.classList.toggle('is-active', button.dataset.value === 'png'));
    effectAmountRow.hidden = true;
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast(t('image_editor_image_only', 'Please choose an image file.'));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast(t('image_editor_too_large', 'Image is too large (max 100 MB).'));
      return;
    }
    clearObjectUrl();
    resetOptions();
    state.file = file;
    state.objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      state.originalImage = image;
      state.source = image;
      workspace.hidden = false;
      render();
    };
    image.onerror = () => showToast(t('image_editor_load_failed', 'Could not load this image.'));
    image.src = state.objectUrl;
  }

  function renderBase() {
    const size = sourceSize(state.source);
    const swap = Math.abs(state.angle) % 180 === 90;
    const width = swap ? size.height : size.width;
    const height = swap ? size.width : size.height;
    const base = document.createElement('canvas');
    base.width = width;
    base.height = height;
    const ctx = base.getContext('2d');
    ctx.translate(width / 2, height / 2);
    ctx.rotate(state.angle * Math.PI / 180);
    ctx.scale(state.flipX ? -1 : 1, state.flipY ? -1 : 1);
    ctx.drawImage(state.source, -size.width / 2, -size.height / 2, size.width, size.height);
    return base;
  }

  function roundedPath(ctx, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(width - r, 0);
    ctx.quadraticCurveTo(width, 0, width, r);
    ctx.lineTo(width, height - r);
    ctx.quadraticCurveTo(width, height, width - r, height);
    ctx.lineTo(r, height);
    ctx.quadraticCurveTo(0, height, 0, height - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
  }

  function drawEffect(ctx, base) {
    if (state.effect === 'blur') {
      ctx.filter = `blur(${state.effectAmount}px)`;
      ctx.drawImage(base, 0, 0);
      ctx.filter = 'none';
      return;
    }
    if (state.effect === 'mosaic') {
      const block = Math.max(2, state.effectAmount);
      const small = document.createElement('canvas');
      small.width = Math.max(1, Math.ceil(base.width / block));
      small.height = Math.max(1, Math.ceil(base.height / block));
      const smallCtx = small.getContext('2d');
      smallCtx.imageSmoothingEnabled = true;
      smallCtx.drawImage(base, 0, 0, small.width, small.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, base.width, base.height);
      ctx.imageSmoothingEnabled = true;
      return;
    }
    ctx.drawImage(base, 0, 0);
  }

  function drawWatermark(ctx, width, height) {
    if (!state.watermark.trim()) return;
    const size = Math.max(12, Math.round(Math.min(width, height) * 0.045));
    ctx.save();
    ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = state.watermarkColor;
    ctx.globalAlpha = state.watermarkOpacity;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = Math.max(2, Math.round(size * 0.18));
    ctx.fillText(state.watermark.trim(), width - size, height - size);
    ctx.restore();
  }

  function renderStyled(base, forceOpaque) {
    const output = document.createElement('canvas');
    output.width = base.width;
    output.height = base.height;
    const ctx = output.getContext('2d');
    const opaque = forceOpaque || !state.transparent;
    if (opaque) {
      ctx.fillStyle = forceOpaque ? '#ffffff' : state.background;
      ctx.fillRect(0, 0, output.width, output.height);
    }
    if (state.radius > 0) {
      ctx.save();
      roundedPath(ctx, output.width, output.height, state.radius);
      ctx.clip();
    }
    drawEffect(ctx, base);
    if (state.radius > 0) ctx.restore();
    drawWatermark(ctx, output.width, output.height);
    return output;
  }

  function updateCropBox() {
    if (!state.crop || !canvas.width || !canvas.height) {
      cropBox.hidden = true;
      return;
    }
    const canvasRect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const scaleX = canvasRect.width / canvas.width;
    const scaleY = canvasRect.height / canvas.height;
    cropBox.hidden = false;
    cropBox.style.left = `${canvasRect.left - stageRect.left + state.crop.x * scaleX}px`;
    cropBox.style.top = `${canvasRect.top - stageRect.top + state.crop.y * scaleY}px`;
    cropBox.style.width = `${state.crop.w * scaleX}px`;
    cropBox.style.height = `${state.crop.h * scaleY}px`;
  }

  function render() {
    if (!state.source) return;
    const base = renderBase();
    if (base.width * base.height > MAX_OUTPUT_PIXELS) {
      showToast(t('image_editor_output_large', 'The image is too large to edit safely.'));
      return;
    }
    const output = renderStyled(base, false);
    canvas.width = output.width;
    canvas.height = output.height;
    canvas.getContext('2d').drawImage(output, 0, 0);
    info.textContent = `${output.width} × ${output.height} px`;
    requestAnimationFrame(updateCropBox);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)),
      y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height))
    };
  }

  function applyCrop() {
    if (!state.crop || state.crop.w < 2 || state.crop.h < 2) return;
    const base = renderBase();
    const crop = state.crop;
    const source = document.createElement('canvas');
    source.width = Math.round(crop.w);
    source.height = Math.round(crop.h);
    source.getContext('2d').drawImage(base, crop.x, crop.y, crop.w, crop.h, 0, 0, source.width, source.height);
    state.source = source;
    state.angle = 0;
    state.flipX = false;
    state.flipY = false;
    state.crop = null;
    render();
  }

  function resetEditor() {
    if (!state.originalImage) return;
    state.source = state.originalImage;
    resetOptions();
    render();
  }

  document.getElementById('rotateLeftBtn').addEventListener('click', () => { state.angle = (state.angle - 90) % 360; state.crop = null; render(); });
  document.getElementById('rotateRightBtn').addEventListener('click', () => { state.angle = (state.angle + 90) % 360; state.crop = null; render(); });
  document.getElementById('flipHBtn').addEventListener('click', () => { state.flipX = !state.flipX; state.crop = null; render(); });
  document.getElementById('flipVBtn').addEventListener('click', () => { state.flipY = !state.flipY; state.crop = null; render(); });
  document.getElementById('applyCropBtn').addEventListener('click', applyCrop);
  document.getElementById('clearCropBtn').addEventListener('click', () => { state.crop = null; render(); });
  document.getElementById('resetEditorBtn').addEventListener('click', resetEditor);

  canvas.addEventListener('pointerdown', (event) => {
    if (!state.source) return;
    const point = canvasPoint(event);
    state.cropDrag = { x: point.x, y: point.y };
    state.crop = { x: point.x, y: point.y, w: 0, h: 0 };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!state.cropDrag) return;
    const point = canvasPoint(event);
    const start = state.cropDrag;
    state.crop = { x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), w: Math.abs(point.x - start.x), h: Math.abs(point.y - start.y) };
    updateCropBox();
  });
  function endCrop(event) {
    if (!state.cropDrag) return;
    state.cropDrag = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    if (!state.crop || state.crop.w < 4 || state.crop.h < 4) state.crop = null;
    updateCropBox();
  }
  canvas.addEventListener('pointerup', endCrop);
  canvas.addEventListener('pointercancel', endCrop);

  cornerRadius.addEventListener('input', () => { state.radius = Number(cornerRadius.value); cornerRadiusValue.textContent = cornerRadius.value; render(); });
  backgroundColor.addEventListener('input', () => { state.background = backgroundColor.value; render(); });
  transparentBackground.addEventListener('change', () => { state.transparent = transparentBackground.checked; render(); });
  effectSelector.addEventListener('click', (event) => {
    const button = event.target.closest('[data-value]');
    if (!button) return;
    state.effect = button.dataset.value;
    effectSelector.querySelectorAll('[data-value]').forEach((item) => item.classList.toggle('is-active', item === button));
    effectAmountRow.hidden = state.effect === 'none';
    render();
  });
  effectAmount.addEventListener('input', () => { state.effectAmount = Number(effectAmount.value); effectAmountValue.textContent = effectAmount.value; render(); });
  watermarkText.addEventListener('input', () => { state.watermark = watermarkText.value; render(); });
  watermarkColor.addEventListener('input', () => { state.watermarkColor = watermarkColor.value; render(); });
  watermarkOpacity.addEventListener('input', () => { state.watermarkOpacity = Number(watermarkOpacity.value) / 100; watermarkOpacityValue.textContent = watermarkOpacity.value; render(); });
  exportFormatSelector.addEventListener('click', (event) => {
    const button = event.target.closest('[data-value]');
    if (!button) return;
    state.format = button.dataset.value;
    exportFormatSelector.querySelectorAll('[data-value]').forEach((item) => item.classList.toggle('is-active', item === button));
  });

  downloadEditedBtn.addEventListener('click', () => {
    if (!state.source) return;
    const base = renderBase();
    let output = renderStyled(base, state.format === 'jpeg');
    if (state.crop && state.crop.w >= 2 && state.crop.h >= 2) {
      const cropped = document.createElement('canvas');
      cropped.width = Math.round(state.crop.w);
      cropped.height = Math.round(state.crop.h);
      cropped.getContext('2d').drawImage(output, state.crop.x, state.crop.y, state.crop.w, state.crop.h, 0, 0, cropped.width, cropped.height);
      output = cropped;
    }
    if (output.width * output.height > MAX_OUTPUT_PIXELS) {
      showToast(t('image_editor_output_large', 'The image is too large to export safely.'));
      return;
    }
    const mime = state.format === 'jpeg' ? 'image/jpeg' : state.format === 'webp' ? 'image/webp' : 'image/png';
    output.toBlob((blob) => {
      if (!blob) { showToast(t('image_editor_export_failed', 'Could not export edited image.')); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = state.file.name.replace(/\.[^/.]+$/, '') + '-edited.' + (state.format === 'jpeg' ? 'jpg' : state.format);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, mime, state.format === 'png' ? undefined : 0.9);
  });

  input.addEventListener('change', (event) => { loadFile(event.target.files[0]); input.value = ''; });
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => drop.addEventListener(eventName, (event) => { event.preventDefault(); event.stopPropagation(); }));
  ['dragenter', 'dragover'].forEach((eventName) => drop.addEventListener(eventName, () => drop.classList.add('is-dragover')));
  ['dragleave', 'drop'].forEach((eventName) => drop.addEventListener(eventName, () => drop.classList.remove('is-dragover')));
  drop.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0]));
  window.addEventListener('paste', (event) => {
    const items = event.clipboardData && event.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { event.preventDefault(); loadFile(file); break; }
      }
    }
  });
})();
