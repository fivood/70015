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
  const captureActions = document.getElementById('captureActions');
  const resultImg = document.getElementById('resultImg');
  const resultSize = document.getElementById('resultSize');
  const resultNote = document.getElementById('resultNote');
  const toast = document.getElementById('toast');
  const workCanvas = document.getElementById('workCanvas');

  const PDF_WORKER_SRC = 'vendor/pdf.worker.min.js';
  const pdfReady = typeof window.pdfjsLib === 'object' && window.pdfjsLib;
  const MAX_PDF_FILE_SIZE = 100 * 1024 * 1024;
  const MAX_OUTPUT_PIXELS = 64 * 1024 * 1024;
  const MAX_CANVAS_SIDE = 32767; // Chrome canvas limit per side
  function tooBig(w, h) { return w * h > MAX_OUTPUT_PIXELS || w > MAX_CANVAS_SIDE || h > MAX_CANVAS_SIDE; }

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

  // Scroll recording state (Method A)
  let lockedRegion = null;
  let isRecording = false;
  let recState = 'IDLE';
  let sampleTimer = null;
  let debounceTimer = null;
  let prevStripData = null;
  let lastCaptureData = null;
  let autoStitchCanvas = null;
  let autoSegmentCount = 0;
  let scrollingStartTime = 0;

  const SAMPLE_MS = 200;
  const CHANGE_THRESH = 25.0;
  const STABLE_THRESH = 2.0;
  const DEBOUNCE_MS = 300;
  const MAX_SCROLL_WAIT = 5000;
  const MATCH_ROWS = 16;
  const SAMPLE_STEP = 4;
  const NCC_THRESH = 0.92;

  const scrollControls = document.getElementById('scrollControls');
  const recordScrollBtn = document.getElementById('recordScrollBtn');
  const stopRecordBtn = document.getElementById('stopRecordBtn');
  const unlockRegionBtn = document.getElementById('unlockRegionBtn');
  const recStatus = document.getElementById('recStatus');
  const recStatusText = document.getElementById('recStatusText');
  const recCount = document.getElementById('recCount');
  const lockBadge = document.getElementById('lockBadge');

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
    resultNote.textContent = t('snp_result_note', 'Drag on the source preview to capture another region.');
    resultPanel.hidden = true;
    captureActions.hidden = true;
    sel.hidden = true;
  }

  function stopCapture() {
    if (isRecording) stopRecording();
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
    video.hidden = true;
    lockedRegion = null;
    lockBadge.hidden = true;
    scrollControls.hidden = true;
    sel.classList.remove('is-locked');
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
    if (file.size > MAX_PDF_FILE_SIZE) { showToast(t('snp_pdf_open_fail', 'PDF is too large to open in the browser')); return; }
    const name = file.name.toLowerCase();
    if (file.type !== 'application/pdf' && !name.endsWith('.pdf')) {
      showToast(t('snp_choose_pdf', 'Please choose a PDF file'));
      return;
    }
    pdfHint.textContent = t('snp_pdf_loading', 'Loading PDF...');
    try {
      if (currentRender) { try { currentRender.cancel(); } catch (e) {} }
      if (pdfDoc && typeof pdfDoc.destroy === 'function') {
        const oldPdf = pdfDoc;
        pdfDoc = null;
        try { await oldPdf.destroy(); } catch (e) {}
      }
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
    if (tooBig(viewport.width, viewport.height)) {
      pdfHint.textContent = t('snp_pdf_open_fail', 'This PDF page is too large to render safely.');
      return;
    }
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
    const oldPdf = pdfDoc;
    pdfDoc = null;
    totalPages = 0;
    currentPage = 1;
    pdfCanvas.hidden = true;
    pdfCanvas.width = 1;
    pdfCanvas.height = 1;
    if (oldPdf && typeof oldPdf.destroy === 'function') Promise.resolve(oldPdf.destroy()).catch(() => {});
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
      const pageSizes = [];
      let maxWidth = 0;
      let totalHeight = 0;
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdfDoc.getPage(i);
        const vp = page.getViewport({ scale });
        const width = Math.floor(vp.width), height = Math.floor(vp.height);
        pageSizes.push({ width, height });
        if (width > maxWidth) maxWidth = width;
        totalHeight += height;
      }
      if (!maxWidth || !totalHeight || tooBig(maxWidth, totalHeight)) {
        throw new Error('PDF output is too large');
      }
      workCanvas.width = maxWidth;
      workCanvas.height = totalHeight;
      const wctx = workCanvas.getContext('2d');
      wctx.fillStyle = '#ffffff';
      wctx.fillRect(0, 0, maxWidth, totalHeight);
      let y = 0;
      for (let i = 0; i < pageSizes.length; i++) {
        const page = await pdfDoc.getPage(i + 1);
        const vp = page.getViewport({ scale });
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = pageSizes[i].width;
        pageCanvas.height = pageSizes[i].height;
        const pageCtx = pageCanvas.getContext('2d');
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        await page.render({ canvasContext: pageCtx, viewport: vp }).promise;
        wctx.drawImage(pageCanvas, Math.floor((maxWidth - pageCanvas.width) / 2), y);
        y += pageCanvas.height;
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
    if (isRecording) return;
    e.preventDefault();
    const p = pointerPos(e);
    if (lockedRegion && activeMode === 'screen') {
      dragStart = { x: lockedRegion.x, y: p.y };
      dragRect = { x: lockedRegion.x, y: p.y, w: lockedRegion.w, h: 0 };
    } else {
      dragStart = { x: p.x, y: p.y };
      dragRect = { x: p.x, y: p.y, w: 0, h: 0 };
    }
    sel.hidden = false;
    if (!lockedRegion) sel.classList.remove('is-locked');
    updateSelection();
  }

  function onMove(e) {
    if (!dragStart) return;
    e.preventDefault();
    const p = pointerPos(e);
    if (lockedRegion && activeMode === 'screen') {
      dragRect.x = lockedRegion.x;
      dragRect.w = lockedRegion.w;
      dragRect.y = Math.min(dragStart.y, p.y);
      dragRect.h = Math.abs(p.y - dragStart.y);
    } else {
      dragRect.x = Math.min(dragStart.x, p.x);
      dragRect.y = Math.min(dragStart.y, p.y);
      dragRect.w = Math.abs(p.x - dragStart.x);
      dragRect.h = Math.abs(p.y - dragStart.y);
    }
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
    if (!lockedRegion && activeMode === 'screen' && stream) {
      lockRegion(rect);
    } else if (lockedRegion) {
      lockedRegion.y = rect.y;
      lockedRegion.h = rect.h;
    }
  }

  function updateSelection() {
    if (!dragRect) return;
    sel.style.left = dragRect.x + 'px';
    sel.style.top = dragRect.y + 'px';
    sel.style.width = dragRect.w + 'px';
    sel.style.height = dragRect.h + 'px';
    const scale = getScale();
    selLabel.textContent = Math.round(dragRect.w * scale.sx) + ' \u00d7 ' +
      Math.round(dragRect.h * scale.sy);
    selLabel.hidden = dragRect.w < 30;
  }

  function captureRegion(rect) {
    const src = activeMode === 'pdf' ? pdfCanvas : video;
    const scale = getScale();
    const sx = Math.round(rect.x * scale.sx);
    const sy = Math.round(rect.y * scale.sy);
    const sw = Math.max(1, Math.round(rect.w * scale.sx));
    const sh = Math.max(1, Math.round(rect.h * scale.sy));
    if (tooBig(sw, sh)) { sel.hidden = true; showToast(t('snp_capture_failed', 'Capture is too large')); return; }
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
      if (tooBig(w, h)) { showToast(t('snp_capture_failed', 'Capture is too large')); return; }
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
      if (tooBig(w, h)) { showToast(t('snp_capture_failed', 'Capture is too large')); return; }
      workCanvas.width = w;
      workCanvas.height = h;
      const ctx = workCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pdfCanvas, 0, 0, w, h);
      finalizeCapture(w, h);
    }
  }

  function finalizeCapture(w, h) {
    if (!w || !h || tooBig(w, h)) {
      showToast(t('snp_capture_failed', 'Capture is too large')); return;
    }
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    workCanvas.toBlob((blob) => {
      if (!blob) { showToast(t('snp_capture_failed', 'Capture failed')); return; }
      lastBlob = blob;
      lastBlobUrl = URL.createObjectURL(blob);
      resultImg.src = lastBlobUrl;
      resultSize.textContent = w + ' \u00d7 ' + h + ' px';
      resultPanel.hidden = false;
      captureActions.hidden = false;
      showToast(t('snp_capture_ready', 'Capture ready'));
    }, 'image/png');
  }

  // ---------- Multi-capture stitch ----------

  var stitchCanvas = null;
  var stitchCount = 0;
  var stitchPanel = document.getElementById('stitchPanel');
  var stitchCountEl = document.getElementById('stitchCount');

  function addToStitch() {
    if (!lastBlob) { showToast(t('snp_capture_first', 'Capture a region first')); return; }
    var img = new Image();
    var sourceUrl = URL.createObjectURL(lastBlob);
    img.onload = function () {
      URL.revokeObjectURL(sourceUrl);
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
        if (tooBig(newW, newH)) {
          showToast(t('snp_stitching_failed', 'Stitched image is too large'));
          return;
        }
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
    img.onerror = function () {
      URL.revokeObjectURL(sourceUrl);
      showToast(t('snp_capture_failed', 'Could not add capture'));
    };
    img.src = sourceUrl;
  }

  function clearStitch() {
    stitchCanvas = null;
    stitchCount = 0;
    stitchCountEl.textContent = '0';
    stitchPanel.hidden = true;
    showToast(t('snp_stitch_cleared', 'Stitch cleared'));
  }

  // Shared PNG/JPG/PDF/copy/print/annotate buttons (js/export.js).
  ImageExport.mountActions(document.getElementById('captureExport'),
    function () { return lastBlob ? ImageExport.blobToCanvas(lastBlob) : null; }, { name: 'snapshot' });
  ImageExport.mountActions(document.getElementById('stitchExport'),
    function () { return stitchCount ? stitchCanvas : null; }, { name: 'stitched' });

  // ---------- Scroll recording (Method A) ----------

  function lockRegion(rect) {
    const scale = getScale();
    lockedRegion = {
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      nx: Math.round(rect.x * scale.sx),
      nw: Math.max(1, Math.round(rect.w * scale.sx))
    };
    lockBadge.hidden = false;
    scrollControls.hidden = false;
    sel.classList.add('is-locked');
    sel.hidden = false;
    sel.style.left = rect.x + 'px';
    sel.style.top = rect.y + 'px';
    sel.style.width = rect.w + 'px';
    sel.style.height = rect.h + 'px';
    selLabel.textContent = lockedRegion.nw + ' × ' + Math.max(1, Math.round(rect.h * scale.sy));
    hint.textContent = t('snp_lock_hint', 'Region locked. Click "Record scroll", then scroll the shared page.');
  }

  function unlockRegion() {
    lockedRegion = null;
    lockBadge.hidden = true;
    scrollControls.hidden = true;
    sel.classList.remove('is-locked');
    sel.hidden = true;
    if (isRecording) stopRecording();
    hint.textContent = t('snp_drag_hint', 'Drag on the preview to select a region. Release to capture.');
    showToast(t('snp_region_unlocked', 'Region unlocked.'));
  }

  function startRecording() {
    if (!stream || activeMode !== 'screen') {
      showToast(t('snp_need_screen', 'Screen capture must be active to record scrolling.'));
      return;
    }
    if (!lockedRegion) {
      showToast(t('snp_no_region', 'Select a region first by dragging on the preview.'));
      return;
    }
    isRecording = true;
    recState = 'WATCHING';
    autoStitchCanvas = null;
    autoSegmentCount = 0;
    lastCaptureData = null;
    prevStripData = null;

    recordScrollBtn.hidden = true;
    unlockRegionBtn.hidden = true;
    stopRecordBtn.hidden = false;
    recStatus.hidden = false;
    recStatusText.textContent = t('snp_watching', 'Waiting for scroll…');
    recCount.textContent = '';

    captureCurrentRegion();

    sampleTimer = setInterval(sampleFrame, SAMPLE_MS);
    hint.textContent = t('snp_recording_hint', 'Scroll the shared page slowly. Segments are captured automatically.');
  }

  function stopRecording() {
    isRecording = false;
    recState = 'IDLE';
    if (sampleTimer) { clearInterval(sampleTimer); sampleTimer = null; }
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    prevStripData = null;

    recordScrollBtn.hidden = false;
    unlockRegionBtn.hidden = false;
    stopRecordBtn.hidden = true;
    recStatus.hidden = true;

    if (autoSegmentCount > 0 && autoStitchCanvas) {
      autoStitchCanvas.toBlob(function (blob) {
        if (!blob) return;
        if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
        lastBlob = blob;
        lastBlobUrl = URL.createObjectURL(blob);
        resultImg.src = lastBlobUrl;
        resultSize.textContent = autoStitchCanvas.width + ' × ' + autoStitchCanvas.height + ' px';
        resultPanel.hidden = false;
        captureActions.hidden = false;
      }, 'image/png');
    }
    showToast(tpl('snp_rec_stopped', 'Recording stopped. {count} segments captured.', { count: autoSegmentCount }));
    hint.textContent = t('snp_lock_hint', 'Region locked. Click "Record scroll", then scroll the shared page.');
  }

  function captureCurrentRegion() {
    if (!stream || !video.videoWidth) return;
    const scale = getScale();
    const sx = lockedRegion.nx;
    const sy = Math.round(lockedRegion.y * scale.sy);
    const sw = lockedRegion.nw;
    const sh = Math.max(1, Math.round(lockedRegion.h * scale.sy));
    if (tooBig(sw, sh)) return;

    workCanvas.width = sw;
    workCanvas.height = sh;
    const ctx = workCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

    const newData = ctx.getImageData(0, 0, sw, sh);
    appendToAutoStitch(newData, sw, sh);
  }

  function appendToAutoStitch(newData, w, h) {
    let overlapRows = 0;
    if (lastCaptureData && autoStitchCanvas) {
      overlapRows = findOverlapRows(lastCaptureData, newData, w);
    }
    const appendH = h - overlapRows;
    if (appendH <= 0) return;

    if (!autoStitchCanvas) {
      autoStitchCanvas = document.createElement('canvas');
      autoStitchCanvas.width = w;
      autoStitchCanvas.height = h;
      const sctx = autoStitchCanvas.getContext('2d');
      sctx.putImageData(newData, 0, 0);
    } else {
      const oldH = autoStitchCanvas.height;
      const newH = oldH + appendH;
      if (tooBig(w, newH)) {
        stopRecording();
        showToast(t('snp_stitch_too_large', 'Stitched image reached max size. Recording stopped.'));
        return;
      }
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = newH;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(autoStitchCanvas, 0, 0);
      const appendCanvas = document.createElement('canvas');
      appendCanvas.width = w;
      appendCanvas.height = appendH;
      const actx = appendCanvas.getContext('2d');
      actx.putImageData(newData, 0, -overlapRows);
      tctx.drawImage(appendCanvas, 0, oldH);
      autoStitchCanvas.width = w;
      autoStitchCanvas.height = newH;
      autoStitchCanvas.getContext('2d').drawImage(tmp, 0, 0);
    }

    lastCaptureData = newData;
    autoSegmentCount++;
    recCount.textContent = tpl('snp_rec_segments', '{count} segments', { count: autoSegmentCount });
    if (overlapRows > 0) {
      showToast(tpl('snp_overlap_removed', '{rows}px overlap removed', { rows: overlapRows }));
    }
  }

  // --- Frame comparison (MSE on center strip) ---

  function sampleFrame() {
    if (!isRecording || !stream || !video.videoWidth) return;
    const scale = getScale();
    const regNx = lockedRegion.nx;
    const regNw = lockedRegion.nw;
    const stripW = Math.max(4, Math.floor(regNw * 0.1));
    const stripX = regNx + Math.floor((regNw - stripW) / 2);
    const natH = video.videoHeight;

    workCanvas.width = stripW;
    workCanvas.height = natH;
    const ctx = workCanvas.getContext('2d');
    ctx.drawImage(video, stripX, 0, stripW, natH, 0, 0, stripW, natH);
    const currStrip = ctx.getImageData(0, 0, stripW, natH);

    if (!prevStripData) {
      prevStripData = currStrip;
      return;
    }

    const mse = computeMSE(prevStripData.data, currStrip.data);
    prevStripData = currStrip;

    switch (recState) {
      case 'WATCHING':
        if (mse > CHANGE_THRESH) {
          recState = 'SCROLLING';
          scrollingStartTime = Date.now();
          recStatusText.textContent = t('snp_scrolling', 'Scrolling…');
        }
        break;
      case 'SCROLLING':
        if (mse < STABLE_THRESH) {
          recState = 'DEBOUNCING';
          debounceTimer = setTimeout(function () {
            if (recState === 'DEBOUNCING') {
              recState = 'CAPTURE';
              recStatusText.textContent = t('snp_auto_capturing', 'Capturing…');
              captureCurrentRegion();
              recState = 'WATCHING';
              recStatusText.textContent = t('snp_watching', 'Waiting for scroll…');
            }
          }, DEBOUNCE_MS);
        } else if (Date.now() - scrollingStartTime > MAX_SCROLL_WAIT) {
          recState = 'CAPTURE';
          recStatusText.textContent = t('snp_auto_capturing', 'Capturing…');
          captureCurrentRegion();
          recState = 'WATCHING';
          scrollingStartTime = 0;
          recStatusText.textContent = t('snp_watching', 'Waiting for scroll…');
        }
        break;
      case 'DEBOUNCING':
        if (mse > CHANGE_THRESH) {
          if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
          recState = 'SCROLLING';
          recStatusText.textContent = t('snp_scrolling', 'Scrolling…');
        }
        break;
    }
  }

  function computeMSE(a, b) {
    const len = Math.min(a.length, b.length);
    let sum = 0, count = 0;
    for (let i = 0; i < len; i += 4) {
      const dr = a[i] - b[i];
      const dg = a[i + 1] - b[i + 1];
      const db = a[i + 2] - b[i + 2];
      sum += dr * dr + dg * dg + db * db;
      count += 3;
    }
    return count > 0 ? sum / count : 0;
  }

  // --- Overlap detection (NCC) ---

  // The previous frame's bottom rows can sit anywhere in the new frame (small
  // scrolls = large overlap), so search every offset, not just the top rows.
  function findOverlapRows(prevData, newData, width) {
    const prevH = prevData.height;
    const newH = newData.height;
    if (prevH < MATCH_ROWS || newH < MATCH_ROWS) return 0;
    const lastOff = newH - MATCH_ROWS;

    const tplY = prevH - MATCH_ROWS;
    const tplGray = toGrayStrip(prevData.data, width, tplY, MATCH_ROWS);
    const tplStats = computeStats(tplGray);
    const newGray = toGrayStrip(newData.data, width, 0, newH);

    if (tplStats.std < 1.0) {
      return findOverlapMSE(tplGray, newGray, width, lastOff);
    }

    let bestNCC = -1, bestOffset = -1;
    for (let off = 0; off <= lastOff; off++) {
      const candGray = newGray.subarray(off * width, (off + MATCH_ROWS) * width);
      const candStats = computeStats(candGray);
      if (candStats.std < 0.5) continue;

      let num = 0;
      for (let i = 0; i < tplGray.length; i += SAMPLE_STEP) {
        num += (tplGray[i] - tplStats.mean) * (candGray[i] - candStats.mean);
      }
      const samples = Math.ceil(tplGray.length / SAMPLE_STEP);
      const ncc = num / (tplStats.std * candStats.std * samples);

      if (ncc > bestNCC) {
        bestNCC = ncc;
        bestOffset = off;
      }
    }

    if (bestNCC >= NCC_THRESH && bestOffset >= 0) {
      return bestOffset + MATCH_ROWS;
    }
    return 0;
  }

  function findOverlapMSE(tplGray, newGray, width, lastOff) {
    let bestMSE = Infinity, bestOffset = -1;
    for (let off = 0; off <= lastOff; off++) {
      const candGray = newGray.subarray(off * width, (off + MATCH_ROWS) * width);
      let sum = 0;
      for (let i = 0; i < tplGray.length; i += SAMPLE_STEP) {
        const d = tplGray[i] - candGray[i];
        sum += d * d;
      }
      const mse = sum / Math.ceil(tplGray.length / SAMPLE_STEP);
      if (mse < bestMSE) {
        bestMSE = mse;
        bestOffset = off;
      }
    }
    if (bestMSE < 5.0 && bestOffset >= 0) {
      return bestOffset + MATCH_ROWS;
    }
    return 0;
  }

  function toGrayStrip(data, width, startRow, rows) {
    const out = new Float32Array(width * rows);
    for (let r = 0; r < rows; r++) {
      const rowOff = (startRow + r) * width * 4;
      for (let c = 0; c < width; c++) {
        const i = rowOff + c * 4;
        out[r * width + c] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
    }
    return out;
  }

  function computeStats(arr) {
    let sum = 0;
    for (let i = 0; i < arr.length; i += SAMPLE_STEP) sum += arr[i];
    const n = Math.ceil(arr.length / SAMPLE_STEP);
    const mean = sum / n;
    let vsum = 0;
    for (let i = 0; i < arr.length; i += SAMPLE_STEP) {
      const d = arr[i] - mean;
      vsum += d * d;
    }
    return { mean: mean, std: Math.sqrt(vsum / n) };
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
  document.getElementById('addToStitchBtn').addEventListener('click', addToStitch);
  document.getElementById('stitchClearBtn').addEventListener('click', clearStitch);
  recordScrollBtn.addEventListener('click', startRecording);
  stopRecordBtn.addEventListener('click', stopRecording);
  unlockRegionBtn.addEventListener('click', unlockRegion);

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
    if (isRecording) stopRecording();
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
  });
})();
