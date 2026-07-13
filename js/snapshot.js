(function () {
  'use strict';

  const startBtn = document.getElementById('startBtn');
  const startWrap = document.getElementById('startWrap');
  const stage = document.getElementById('stage');
  const video = document.getElementById('video');
  const sel = document.getElementById('sel');
  const selLabel = document.getElementById('selLabel');
  const stageControls = document.getElementById('stageControls');
  const fullBtn = document.getElementById('fullBtn');
  const stopBtn = document.getElementById('stopBtn');
  const hint = document.getElementById('hint');
  const resultPanel = document.getElementById('resultPanel');
  const resultImg = document.getElementById('resultImg');
  const resultSize = document.getElementById('resultSize');
  const resultNote = document.getElementById('resultNote');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');
  const toast = document.getElementById('toast');
  const workCanvas = document.getElementById('workCanvas');

  let stream = null;
  let dragStart = null;
  let dragRect = null;
  let lastBlob = null;
  let lastBlobUrl = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function supportsCapture() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  if (!supportsCapture()) {
    startBtn.disabled = true;
    startBtn.classList.add('is-disabled');
    hint.textContent = 'This browser does not support screen capture. Try desktop Chrome or Edge.';
  }

  async function startCapture() {
    if (!supportsCapture()) return;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false
      });
    } catch (err) {
      if (err && err.name === 'NotAllowedError') {
        showToast('Capture cancelled');
      } else {
        showToast('Could not start capture');
      }
      return;
    }

    const track = stream.getVideoTracks()[0];
    track.addEventListener('ended', stopCapture);

    video.srcObject = stream;
    try {
      await video.play();
    } catch (e) {
      showToast('Playback failed');
      stopCapture();
      return;
    }

    await new Promise(resolve => {
      if (video.videoWidth) return resolve();
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });

    startWrap.hidden = true;
    stage.hidden = false;
    stageControls.hidden = false;
    hint.textContent = 'Drag on the preview to select a region. Release to capture.';
    resultNote.textContent = 'Drag on the preview above to capture a different region.';
    resultPanel.hidden = true;
    sel.hidden = true;
  }

  function stopCapture() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
    stage.hidden = true;
    stageControls.hidden = true;
    startWrap.hidden = false;
    hint.textContent = 'Click "Start capture" and pick a tab or window to share.';
    sel.hidden = true;
    dragStart = null;
    dragRect = null;
  }

  function pointerPos(e) {
    const rect = stage.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return {
      x: clamp(point.clientX - rect.left, 0, rect.width),
      y: clamp(point.clientY - rect.top, 0, rect.height),
      rect
    };
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function onDown(e) {
    if (!stream || dragStart) return;
    e.preventDefault();
    const p = pointerPos(e);
    dragStart = { x: p.x, y: p.y };
    dragRect = { x: p.x, y: p.y, w: 0, h: 0 };
    sel.hidden = false;
    updateSelection();
  }

  function onMove(e) {
    if (!dragStart) return;
    e.preventDefault();
    const p = pointerPos(e);
    dragRect.x = Math.min(dragStart.x, p.x);
    dragRect.y = Math.min(dragStart.y, p.y);
    dragRect.w = Math.abs(p.x - dragStart.x);
    dragRect.h = Math.abs(p.y - dragStart.y);
    updateSelection();
  }

  function onUp(e) {
    if (!dragStart) return;
    const rect = dragRect;
    dragStart = null;

    if (!rect || rect.w < 4 || rect.h < 4) {
      sel.hidden = true;
      return;
    }

    captureRegion(rect);
  }

  function updateSelection() {
    if (!dragRect) return;
    sel.style.left = dragRect.x + 'px';
    sel.style.top = dragRect.y + 'px';
    sel.style.width = dragRect.w + 'px';
    sel.style.height = dragRect.h + 'px';
    selLabel.textContent = Math.round(dragRect.w) + ' × ' + Math.round(dragRect.h);
    selLabel.hidden = dragRect.w < 30;
  }

  function getScale() {
    const w = stage.clientWidth || video.clientWidth || 1;
    const h = stage.clientHeight || video.clientHeight || 1;
    return {
      sx: (video.videoWidth || 1) / w,
      sy: (video.videoHeight || 1) / h,
      w,
      h
    };
  }

  function captureRegion(rect) {
    const scale = getScale();
    const sourceX = Math.round(rect.x * scale.sx);
    const sourceY = Math.round(rect.y * scale.sy);
    const sourceW = Math.max(1, Math.round(rect.w * scale.sx));
    const sourceH = Math.max(1, Math.round(rect.h * scale.sy));

    workCanvas.width = sourceW;
    workCanvas.height = sourceH;
    const ctx = workCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);

    finalizeCapture(sourceW, sourceH);
  }

  function captureFull() {
    if (!stream) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      showToast('Stream not ready');
      return;
    }
    workCanvas.width = w;
    workCanvas.height = h;
    const ctx = workCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(video, 0, 0, w, h);
    sel.hidden = true;
    finalizeCapture(w, h);
  }

  function finalizeCapture(w, h) {
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    workCanvas.toBlob((blob) => {
      if (!blob) {
        showToast('Capture failed');
        return;
      }
      lastBlob = blob;
      lastBlobUrl = URL.createObjectURL(blob);
      resultImg.src = lastBlobUrl;
      resultSize.textContent = w + ' × ' + h + ' px';
      resultPanel.hidden = false;
      resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 'image/png');
  }

  function download() {
    if (!lastBlobUrl) return;
    const a = document.createElement('a');
    a.href = lastBlobUrl;
    a.download = 'snapshot-' + Date.now() + '.png';
    a.click();
  }

  async function copyToClipboard() {
    if (!lastBlob) return;
    try {
      if (navigator.clipboard && window.ClipboardItem && ClipboardItem.supports('image/png')) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': lastBlob })]);
        showToast('Copied to clipboard');
      } else {
        showToast('Clipboard images not supported here');
      }
    } catch (e) {
      showToast('Copy failed');
    }
  }

  // Pointer events
  stage.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);

  stage.addEventListener('touchstart', onDown, { passive: false });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onUp);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dragStart) {
        dragStart = null;
        sel.hidden = true;
      } else if (stream) {
        stopCapture();
      }
    }
  });

  startBtn.addEventListener('click', startCapture);
  stopBtn.addEventListener('click', stopCapture);
  fullBtn.addEventListener('click', captureFull);
  downloadBtn.addEventListener('click', download);
  copyBtn.addEventListener('click', copyToClipboard);

  window.addEventListener('beforeunload', () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
  });
})();
