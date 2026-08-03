(function () {
  'use strict';

  const qrText = document.getElementById('qrText');
  const eclSelector = document.getElementById('eclSelector');
  const cellSize = document.getElementById('cellSize');
  const cellValue = document.getElementById('cellValue');
  const margin = document.getElementById('margin');
  const marginValue = document.getElementById('marginValue');
  const darkColor = document.getElementById('darkColor');
  const lightColor = document.getElementById('lightColor');
  const transparentBg = document.getElementById('transparentBg');
  const canvas = document.getElementById('qrCanvas');
  const qrInfo = document.getElementById('qrInfo');
  const qrHint = document.getElementById('qrHint');
  const downloadPngBtn = document.getElementById('downloadPngBtn');
  const downloadSvgBtn = document.getElementById('downloadSvgBtn');
  const qrModeSelector = document.getElementById('qrModeSelector');
  const qrGenerateView = document.getElementById('qrGenerateView');
  const qrDecodeView = document.getElementById('qrDecodeView');
  const qrGeneratePreview = document.getElementById('qrGeneratePreview');
  const qrDecodeDrop = document.getElementById('qrDecodeDrop');
  const qrDecodeInput = document.getElementById('qrDecodeInput');
  const qrDecodeStatus = document.getElementById('qrDecodeStatus');
  const qrDecodeResult = document.getElementById('qrDecodeResult');
  const qrDecodePreview = document.getElementById('qrDecodePreview');
  const qrDecodeCanvas = document.getElementById('qrDecodeCanvas');
  const qrDecodedText = document.getElementById('qrDecodedText');
  const qrDecodeCopyBtn = document.getElementById('qrDecodeCopyBtn');
  const qrDecodeClearBtn = document.getElementById('qrDecodeClearBtn');
  const toast = document.getElementById('toast');

  const hasLib = typeof window.qrcode === 'function';
  let ecl = 'M';
  let lastQr = null;
  let lastMeta = null;
  let qrMode = 'generate';
  let decodeObjectUrl = null;
  function t(key, fallback) {
    return (typeof window.t === 'function') ? window.t(key) : fallback;
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    if (!document.execCommand('copy')) throw new Error('copy failed');
    area.remove();
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      clearTimeout(t);
      const args = arguments;
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }
  const renderSoon = debounce(render, 40);

  eclSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-value]');
    if (!btn) return;
    [...eclSelector.querySelectorAll('.segmented__btn')].forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    ecl = btn.dataset.value;
    render();
  });

  cellSize.addEventListener('input', e => { cellValue.textContent = e.target.value; renderSoon(); });
  margin.addEventListener('input', e => { marginValue.textContent = e.target.value; renderSoon(); });
  darkColor.addEventListener('input', renderSoon);
  lightColor.addEventListener('input', renderSoon);
  transparentBg.addEventListener('change', renderSoon);
  qrText.addEventListener('input', debounce(render, 250));

  function render() {
    if (!hasLib) { qrHint.textContent = t('qr_lib_failed', 'QR library failed to load.'); return; }
    const text = qrText.value.trim();
    if (!text) { canvas.width = canvas.height = 1; qrInfo.textContent = '\u2014'; lastQr = null; return; }
    let qr;
    try {
      qr = qrcode(0, ecl);
      qr.addData(text);
      qr.make();
    } catch (err) {
      canvas.width = canvas.height = 1;
      qrInfo.textContent = '\u2014';
      qrHint.textContent = t('qr_too_long', 'Text too long for a QR code at this error-correction level.');
      lastQr = null;
      return;
    }
    const count = qr.getModuleCount();
    const cell = parseInt(cellSize.value, 10);
    const m = parseInt(margin.value, 10);
    const size = (count + m * 2) * cell;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    if (!transparentBg.checked) {
      ctx.fillStyle = lightColor.value;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.fillStyle = darkColor.value;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + m) * cell, (r + m) * cell, cell, cell);
      }
    }
    lastQr = qr;
    lastMeta = { count, cell, m, size, transparent: transparentBg.checked, dark: darkColor.value, light: lightColor.value };
    qrInfo.textContent = size + ' \u00d7 ' + size + ' px \u00b7 ' + count + ' ' + t('qr_modules', 'modules');
    qrHint.textContent = t('qr_updates', 'Updates as you type.');
  }

  function buildSvg() {
    const { count, cell, m, size, transparent, dark, light } = lastMeta;
    const darks = [];
    for (let r = 0; r < count; r++) {
      let runStart = -1;
      for (let c = 0; c <= count; c++) {
        const isDark = c < count && lastQr.isDark(r, c);
        if (isDark && runStart < 0) runStart = c;
        if (!isDark && runStart >= 0) {
          const width = c - runStart;
          darks.push('<path d="M' + ((runStart + m) * cell) + ' ' + ((r + m) * cell) + 'h' + (width * cell) + 'v' + cell + 'h-' + (width * cell) + 'z"/>');
          runStart = -1;
        }
      }
    }
    const bg = transparent ? '' : '<rect width="' + size + '" height="' + size + '" fill="' + light + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges">' + bg + '<g fill="' + dark + '">' + darks.join('') + '</g></svg>';
  }

  function downloadPng() {
    if (!lastQr) { showToast(t('qr_nothing_download', 'Nothing to download')); return; }
    canvas.toBlob((blob) => {
      if (!blob) { showToast(t('ann_export_fail', 'Export failed')); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'qr-' + Date.now() + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  }

  function downloadSvg() {
    if (!lastQr) { showToast(t('qr_nothing_download', 'Nothing to download')); return; }
    const blob = new Blob([buildSvg()], { type: 'image/svg+xml;charset=utf-8' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = 'qr-' + Date.now() + '.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  downloadPngBtn.addEventListener('click', downloadPng);
  downloadSvgBtn.addEventListener('click', downloadSvg);

  function setMode(mode) {
    qrMode = mode;
    qrModeSelector.querySelectorAll('[data-mode]').forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    qrGenerateView.hidden = mode !== 'generate';
    qrGeneratePreview.hidden = mode !== 'generate';
    qrDecodeView.hidden = mode !== 'decode';
    if (mode === 'generate') render();
  }

  function clearDecodeUrl() {
    if (decodeObjectUrl) {
      URL.revokeObjectURL(decodeObjectUrl);
      decodeObjectUrl = null;
    }
  }

  function resetDecode() {
    clearDecodeUrl();
    qrDecodePreview.removeAttribute('src');
    qrDecodedText.value = '';
    qrDecodeResult.hidden = true;
    qrDecodeStatus.textContent = t('qr_decode_empty', 'No QR image loaded.');
    qrDecodeStatus.setAttribute('data-i18n', 'qr_decode_empty');
  }

  async function decodeImage(img) {
    if ('BarcodeDetector' in window) {
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const results = await detector.detect(img);
        if (results.length && results[0].rawValue) return results[0].rawValue;
      } catch (_) {
        // Fall through to jsQR when the native detector is unavailable or fails.
      }
    }

    if (typeof window.jsQR !== 'function') return null;
    const maxEdge = 2400;
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    qrDecodeCanvas.width = width;
    qrDecodeCanvas.height = height;
    const ctx = qrDecodeCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);
    const result = window.jsQR(ctx.getImageData(0, 0, width, height).data, width, height, {
      inversionAttempts: 'attemptBoth'
    });
    return result ? result.data : null;
  }

  async function decodeFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast(t('qr_decode_image_only', 'Please choose an image containing a QR code.'));
      return;
    }
    resetDecode();
    qrDecodeStatus.textContent = t('qr_decode_loading', 'Decoding QR image...');
    qrDecodeStatus.removeAttribute('data-i18n');
    decodeObjectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      qrDecodePreview.src = decodeObjectUrl;
      try {
        const data = await decodeImage(img);
        if (!data) {
          qrDecodeStatus.textContent = t('qr_decode_not_found', 'No QR code was found in this image.');
          qrDecodeStatus.removeAttribute('data-i18n');
          qrDecodeResult.hidden = false;
          return;
        }
        qrDecodedText.value = data;
        qrDecodeResult.hidden = false;
        qrDecodeStatus.textContent = t('qr_decode_found', 'QR code decoded.');
        qrDecodeStatus.removeAttribute('data-i18n');
      } catch (_) {
        qrDecodeStatus.textContent = t('qr_decode_failed', 'Could not decode this image.');
        qrDecodeStatus.removeAttribute('data-i18n');
      }
    };
    img.onerror = () => {
      resetDecode();
      showToast(t('qr_decode_failed', 'Could not decode this image.'));
    };
    img.src = decodeObjectUrl;
  }

  qrModeSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (btn) setMode(btn.dataset.mode);
  });

  qrDecodeInput.addEventListener('change', (e) => {
    decodeFile(e.target.files[0]);
    qrDecodeInput.value = '';
  });
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    qrDecodeDrop.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
  });
  ['dragenter', 'dragover'].forEach((eventName) => qrDecodeDrop.addEventListener(eventName, () => qrDecodeDrop.classList.add('is-dragover')));
  ['dragleave', 'drop'].forEach((eventName) => qrDecodeDrop.addEventListener(eventName, () => qrDecodeDrop.classList.remove('is-dragover')));
  qrDecodeDrop.addEventListener('drop', (e) => decodeFile(e.dataTransfer.files[0]));
  window.addEventListener('paste', (e) => {
    if (qrMode !== 'decode') return;
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { e.preventDefault(); decodeFile(file); break; }
      }
    }
  });
  qrDecodeCopyBtn.addEventListener('click', async () => {
    if (!qrDecodedText.value) return;
    try {
      await copyText(qrDecodedText.value);
      showToast(t('qr_decode_copied', 'Copied decoded content'));
    } catch (_) {
      showToast(t('qr_decode_copy_failed', 'Copy failed'));
    }
  });
  qrDecodeClearBtn.addEventListener('click', resetDecode);

  render();
})();
