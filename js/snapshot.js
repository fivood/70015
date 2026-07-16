(function () {
  'use strict';

  const startBtn = document.getElementById('startBtn');
  const startWrap = document.getElementById('startWrap');
  const stage = document.getElementById('stage');
  const video = document.getElementById('video');
  const pdfCanvas = document.getElementById('pdfCanvas');
  const sel = document.getElementById('sel');
  const selLabel = document.getElementById('selLabel');
  const stageControls = document.getElementById('stageControls');
  const fullBtn = document.getElementById('fullBtn');
  const stopBtn = document.getElementById('stopBtn');
  const hint = document.getElementById('hint');
  const modeSelector = document.getElementById('modeSelector');
  const modeNote = document.getElementById('modeNote');
  const screenMode = document.getElementById('screenMode');
  const pdfMode = document.getElementById('pdfMode');
  const pdfDrop = document.getElementById('pdfDrop');
  const pdfInput = document.getElementById('pdfInput');
  const pdfNav = document.getElementById('pdfNav');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageInfo = document.getElementById('pageInfo');
  const pdfHint = document.getElementById('pdfHint');
  const pdfControls = document.getElementById('pdfControls');
  const pdfFullBtn = document.getElementById('pdfFullBtn');
  const stitchBtn = document.getElementById('stitchBtn');
  const pdfClearBtn = document.getElementById('pdfClearBtn');
  const resultPanel = document.getElementById('resultPanel');
  const resultImg = document.getElementById('resultImg');
  const resultSize = document.getElementById('resultSize');
  const resultNote = document.getElementById('resultNote');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');
  const toast = document.getElementById('toast');
  const workCanvas = document.getElementById('workCanvas');

  const PDF_WORKER_SRC = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const pdfReady = typeof window.pdfjsLib === 'object' && window.pdfjsLib;

  let activeMode = 'screen';
  let stream = null;
  let dragStart = null;
  let dragRect = null;
  let lastBlob = null;
  let lastBlobUrl = null;
  let pdfDoc = null;
  let totalPages = 0;
  let currentPage = 1;
  let currentRender = null;

  if (pdfReady) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  }
  function t(key, fallback) {
    return (typeof window.t === 'function') ? window.t(key) : fallback;
  }
  function tpl(key, fallback, vars) {
    let text = t(key, fallback);
    Object.keys(vars || {}).forEach((name) => {
      text = text.replace(new RegExp('\\{' + name + '\\}', 'g'), vars[name]);
    });
    return text;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function supportsCapture() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  if (!supportsCapture()) {
    startBtn.disabled = true;
    startBtn.classList.add('is-disabled');
    hint.textContent = t('snp_no_screen_capture', 'This browser does not support screen capture. Try desktop Chrome or Edge, or switch to PDF mode.');
  }

  if (!pdfReady) {
    pdfHint.textContent = t('snp_pdf_lib_failed', 'PDF library failed to load. Reload the page or check your network.');
  }

  // ---------- Stage visibility ----------

  function showScreenStage() {
    stage.hidden = false;
    video.hidden = false;
    pdfCanvas.hidden = true;
    stageControls.hidden = false;
    pdfControls.hidden = true;
    pdfNav.hidden = true;
  }

  function showPdfStage() {
    stage.hidden = false;
    video.hidden = true;
    pdfCanvas.hidden = false;
    stageControls.hidden = true;
    pdfControls.hidden = false;
    pdfNav.hidden = false;
  }

  function hideStage() {
    stage.hidden = true;
    stageControls.hidden = true;
    pdfControls.hidden = true;
    pdfNav.hidden = true;
    sel.hidden = true;
  }

  // ---------- Mode switching ----------

  function setMode(mode) {
    if (mode === activeMode) return;
    const prev = activeMode;
    activeMode = mode;
    if (prev === 'screen') stopCapture();

    screenMode.hidden = mode !== 'screen';
    pdfMode.hidden = mode !== 'pdf';
    sel.hidden = true;
    dragStart = null;

    if (mode === 'screen') {
      modeNote.textContent = t('snp_screen_note', 'Share a tab or screen for live capture.');
      hideStage();
      startWrap.hidden = false;
    } else {
      modeNote.textContent = t('snp_pdf_note', 'Open a local PDF (or print-to-PDF a long page) to capture or stitch pages.');
      if (pdfDoc && pdfCanvas.width) showPdfStage();
      else hideStage();
    }

    [...modeSelector.querySelectorAll('.segmented__btn')].forEach(b => {
      b.classList.toggle('is-active', b.dataset.mode === mode);
    });
  }

  modeSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (btn) setMode(btn.dataset.mode);
  });

  // ---------- Screen capture ----------

  async function startCapture() {
    if (!supportsCapture()) return;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false
      });
    } catch (err) {
      if (err && err.name === 'NotAllowedError') showToast(t('snp_capture_cancelled', 'Capture cancelled'));
      else showToast(t('snp_capture_start_fail', 'Could not start capture'));
      return;
    }

    stream.getVideoTracks()[0].addEventListener('ended', stopCapture);

    video.srcObject = stream;
    try {
      await video.play();
    } catch (e) {
      showToast(t('snp_playback_failed', 'Playback failed'));
      stopCapture();
      return;
    }

    await new Promise(resolve => {
      if (video.videoWidth) return resolve();
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });

    startWrap.hidden = true;
    showScreenStage();
    hint.textContent = t('snp_drag_hint', 'Drag on the preview to select a region. Release to capture.');
    resultNote.textContent = t('snp_result_note', 'Drag on the preview above to capture a different region.');
    resultPanel.hidden = true;
    sel.hidden = true;
  }

  function stopCapture() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
    video.hidden = true;
    if (activeMode === 'screen') {
      hideStage();
      startWrap.hidden = false;
      hint.textContent = t('snp_hint', 'Click "Start capture" and pick a tab or window to share.');
    }
    dragStart = null;
  }

  // ---------- PDF ----------

  async function loadPdf(file) {
    if (!pdfReady) { showToast(t('snp_pdf_not_loaded', 'PDF library not loaded')); return; }
    if (!file) return;
    const name = file.name.toLowerCase();
    if (file.type !== 'application/pdf' && !name.endsWith('.pdf')) {
      showToast(t('snp_choose_pdf', 'Please choose a PDF file'));
      return;
    }
    pdfHint.textContent = t('snp_pdf_loading', 'Loading PDF...');
    try {
      const buf = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: buf });
      pdfDoc = await loadingTask.promise;
      totalPages = pdfDoc.numPages;
      currentPage = 1;
      await renderPage(currentPage);
      pdfHint.textContent = t('snp_pdf_select_hint', 'Drag on the page to select a region, or stitch all pages into one image.');
    } catch (err) {
      console.error(err);
      pdfHint.textContent = t('snp_pdf_open_fail', 'Could not open this PDF. Try another file.');
      showToast(t('snp_pdf_open_toast', 'Could not open PDF'));
    }
  }

  function computeScale(baseViewport) {
    const base = baseViewport.width || 612;
    return Math.min(3, Math.max(1.5, 1800 / base));
  }

  async function renderPage(num) {
    if (!pdfDoc) return;
    if (currentRender) { try { currentRender.cancel(); } catch (e) {} }
    const page = await pdfDoc.getPage(num);
    const scale = computeScale(page.getViewport({ scale: 1 }));
    const viewport = page.getViewport({ scale });
    pdfCanvas.width = Math.floor(viewport.width);
    pdfCanvas.height = Math.floor(viewport.height);
    const ctx = pdfCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pdfCanvas.width, pdfCanvas.height);
    currentRender = page.render({ canvasContext: ctx, viewport });
    try {
      await currentRender.promise;
    } catch (err) {
      if (err && err.name !== 'RenderingCancelledException') throw err;
      return;
    } finally {
      currentRender = null;
    }
    showPdfStage();
    updatePageInfo();
  }

  function updatePageInfo() {
    pageInfo.textContent = tpl('snp_page_info', 'Page {page} / {total}', { page: currentPage, total: totalPages });
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  async function gotoPage(delta) {
    if (!pdfDoc) return;
    const n = currentPage + delta;
    if (n < 1 || n > totalPages) return;
    currentPage = n;
    await renderPage(n);
  }

  function clearPdf() {
    if (currentRender) { try { currentRender.cancel(); } catch (e) {} }
    pdfDoc = null;
    totalPages = 0;
    currentPage = 1;
    pdfCanvas.hidden = true;
    hideStage();
    pdfHint.textContent = pdfReady
      ? t('snp_pdf_tip', "Tip: for long web pages, use your browser's Print → Save as PDF, then open it here to capture or stitch all pages.")
      : t('snp_pdf_lib_failed', 'PDF library failed to load. Reload the page or check your network.');
  }

  async function stitchAll() {
    if (!pdfDoc) return;
    stitchBtn.disabled = true;
    pdfHint.textContent = t('snp_stitching', 'Stitching pages... this can take a moment.');
    try {
      const first = await pdfDoc.getPage(1);
      const scale = computeScale(first.getViewport({ scale: 1 }));
      const pages = [];
      let maxWidth = 0;
      let totalHeight = 0;
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdfDoc.getPage(i);
        const vp = page.getViewport({ scale });
        const c = document.createElement('canvas');
        c.width = Math.floor(vp.width);
        c.height = Math.floor(vp.height);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        pages.push(c);
        if (c.width > maxWidth) maxWidth = c.width;
        totalHeight += c.height;
      }
      workCanvas.width = maxWidth;
      workCanvas.height = totalHeight;
      const wctx = workCanvas.getContext('2d');
      wctx.fillStyle = '#ffffff';
      wctx.fillRect(0, 0, maxWidth, totalHeight);
      let y = 0;
      for (const c of pages) {
        wctx.drawImage(c, Math.floor((maxWidth - c.width) / 2), y);
        y += c.height;
      }
      finalizeCapture(maxWidth, totalHeight);
      pdfHint.textContent = tpl('snp_stitched_pages', 'Stitched {total} pages into one image.', { total: totalPages });
    } catch (err) {
      console.error(err);
      showToast(t('snp_stitching_failed', 'Stitching failed'));
      pdfHint.textContent = t('snp_stitching_failed_note', 'Stitching failed - the document may be too large.');
    } finally {
      stitchBtn.disabled = false;
    }
  }

  // ---------- Selection + capture (shared) ----------

  function activeSourceReady() {
    if (activeMode === 'screen') return !!(stream && video.videoWidth);
    return !!(pdfDoc && pdfCanvas.width && !pdfCanvas.hidden);
  }

  function getScale() {
    const w = stage.clientWidth || 1;
    const h = stage.clientHeight || 1;
    const natW = activeMode === 'pdf' ? pdfCanvas.width : video.videoWidth;
    const natH = activeMode === 'pdf' ? pdfCanvas.height : video.videoHeight;
    return { sx: (natW || 1) / w, sy: (natH || 1) / h };
  }

  function pointerPos(e) {
    const rect = stage.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return {
      x: clamp(point.clientX - rect.left, 0, rect.width),
      y: clamp(point.clientY - rect.top, 0, rect.height)
    };
  }

  function onDown(e) {
    if (!activeSourceReady() || dragStart) return;
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

  function onUp() {
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
    selLabel.textContent = Math.round(dragRect.w) + ' \u00d7 ' + Math.round(dragRect.h);
    selLabel.hidden = dragRect.w < 30;
  }

  function captureRegion(rect) {
    const src = activeMode === 'pdf' ? pdfCanvas : video;
    const scale = getScale();
    const sx = Math.round(rect.x * scale.sx);
    const sy = Math.round(rect.y * scale.sy);
    const sw = Math.max(1, Math.round(rect.w * scale.sx));
    const sh = Math.max(1, Math.round(rect.h * scale.sy));
    workCanvas.width = sw;
    workCanvas.height = sh;
    const ctx = workCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    sel.hidden = true;
    finalizeCapture(sw, sh);
  }

  function captureFull() {
    if (activeMode === 'screen') {
      if (!stream) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) { showToast(t('snp_stream_not_ready', 'Stream not ready')); return; }
      workCanvas.width = w;
      workCanvas.height = h;
      const ctx = workCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(video, 0, 0, w, h);
      finalizeCapture(w, h);
    } else {
      if (!pdfDoc || !pdfCanvas.width) return;
      const w = pdfCanvas.width;
      const h = pdfCanvas.height;
      workCanvas.width = w;
      workCanvas.height = h;
      const ctx = workCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pdfCanvas, 0, 0, w, h);
      finalizeCapture(w, h);
    }
  }

  function finalizeCapture(w, h) {
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    workCanvas.toBlob((blob) => {
      if (!blob) { showToast(t('snp_capture_failed', 'Capture failed')); return; }
      lastBlob = blob;
      lastBlobUrl = URL.createObjectURL(blob);
      resultImg.src = lastBlobUrl;
      resultSize.textContent = w + ' \u00d7 ' + h + ' px';
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

  // ---------- Multi-capture stitch ----------

  var stitchCanvas = null;
  var stitchCount = 0;
  var stitchPanel = document.getElementById('stitchPanel');
  var stitchCountEl = document.getElementById('stitchCount');

  function addToStitch() {
    if (!lastBlob) { showToast(t('snp_capture_first', 'Capture a region first')); return; }
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, h = img.naturalHeight;
      if (!stitchCanvas) {
        stitchCanvas = document.createElement('canvas');
        stitchCanvas.width = w;
        stitchCanvas.height = h;
        var sctx = stitchCanvas.getContext('2d');
        sctx.drawImage(img, 0, 0);
      } else {
        var oldH = stitchCanvas.height;
        var newW = Math.max(stitchCanvas.width, w);
        var newH = oldH + h;
        var tmp = document.createElement('canvas');
        tmp.width = newW;
        tmp.height = newH;
        var tctx = tmp.getContext('2d');
        tctx.drawImage(stitchCanvas, 0, 0);
        tctx.drawImage(img, 0, oldH);
        stitchCanvas.width = newW;
        stitchCanvas.height = newH;
        stitchCanvas.getContext('2d').drawImage(tmp, 0, 0);
      }
      stitchCount++;
      stitchCountEl.textContent = stitchCount;
      stitchPanel.hidden = false;
      stitchPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showToast(tpl('snp_added_segment', 'Added segment {count}', { count: stitchCount }));
    };
    img.src = lastBlobUrl;
  }

  function downloadStitch() {
    if (!stitchCanvas || stitchCount === 0) { showToast(t('snp_nothing_stitched', 'Nothing stitched yet')); return; }
    stitchCanvas.toBlob(function (blob) {
      if (!blob) { showToast(t('ann_export_fail', 'Export failed')); return; }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'stitched-' + Date.now() + '.png';
      a.click();
      URL.revokeObjectURL(a.href);
      showToast(tpl('snp_downloaded_segments', 'Downloaded {count} segments', { count: stitchCount }));
    }, 'image/png');
  }

  function clearStitch() {
    stitchCanvas = null;
    stitchCount = 0;
    stitchCountEl.textContent = '0';
    stitchPanel.hidden = true;
    showToast(t('snp_stitch_cleared', 'Stitch cleared'));
  }

  async function copyToClipboard() {
    if (!lastBlob) return;
    try {
      if (navigator.clipboard && window.ClipboardItem && ClipboardItem.supports('image/png')) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': lastBlob })]);
        showToast(t('b64_copied_clipboard', 'Copied to clipboard'));
      } else {
        showToast(t('snp_clipboard_unsupported', 'Clipboard images not supported here'));
      }
    } catch (e) {
      showToast(t('toast_copy_fail', 'Copy failed'));
    }
  }

  // ---------- Events ----------

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
      } else if (stream && activeMode === 'screen') {
        stopCapture();
      }
    }
  });

  startBtn.addEventListener('click', startCapture);
  stopBtn.addEventListener('click', stopCapture);
  fullBtn.addEventListener('click', captureFull);
  pdfFullBtn.addEventListener('click', captureFull);
  stitchBtn.addEventListener('click', stitchAll);
  pdfClearBtn.addEventListener('click', clearPdf);
  prevPageBtn.addEventListener('click', () => gotoPage(-1));
  nextPageBtn.addEventListener('click', () => gotoPage(1));
  downloadBtn.addEventListener('click', download);
  copyBtn.addEventListener('click', copyToClipboard);
  document.getElementById('addToStitchBtn').addEventListener('click', addToStitch);
  document.getElementById('stitchDownloadBtn').addEventListener('click', downloadStitch);
  document.getElementById('stitchClearBtn').addEventListener('click', clearStitch);

  pdfInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) loadPdf(f);
    pdfInput.value = '';
  });

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    pdfDrop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); });
  });
  ['dragenter', 'dragover'].forEach(evt => {
    pdfDrop.addEventListener(evt, () => pdfDrop.classList.add('is-dragover'));
  });
  ['dragleave', 'drop'].forEach(evt => {
    pdfDrop.addEventListener(evt, () => pdfDrop.classList.remove('is-dragover'));
  });
  pdfDrop.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadPdf(f);
  });

  window.addEventListener('beforeunload', () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
  });
})();
