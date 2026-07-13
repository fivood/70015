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
  const toast = document.getElementById('toast');

  const hasLib = typeof window.qrcode === 'function';
  let ecl = 'M';
  let lastQr = null;
  let lastMeta = null;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      clearTimeout(t);
      const args = arguments;
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  eclSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-value]');
    if (!btn) return;
    [...eclSelector.querySelectorAll('.segmented__btn')].forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    ecl = btn.dataset.value;
    render();
  });

  cellSize.addEventListener('input', e => { cellValue.textContent = e.target.value; render(); });
  margin.addEventListener('input', e => { marginValue.textContent = e.target.value; render(); });
  darkColor.addEventListener('input', render);
  lightColor.addEventListener('input', render);
  transparentBg.addEventListener('change', render);
  qrText.addEventListener('input', debounce(render, 250));

  function render() {
    if (!hasLib) { qrHint.textContent = 'QR library failed to load.'; return; }
    const text = qrText.value.trim();
    if (!text) { canvas.width = canvas.height = 1; qrInfo.textContent = '—'; lastQr = null; return; }
    let qr;
    try {
      qr = qrcode(0, ecl);
      qr.addData(text);
      qr.make();
    } catch (err) {
      canvas.width = canvas.height = 1;
      qrInfo.textContent = '—';
      qrHint.textContent = 'Text too long for a QR code at this error-correction level.';
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
    qrInfo.textContent = size + ' \u00d7 ' + size + ' px · ' + count + ' modules';
    qrHint.textContent = 'Updates as you type.';
  }

  function buildSvg() {
    const { count, cell, m, size, transparent, dark, light } = lastMeta;
    const darks = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (lastQr.isDark(r, c)) darks.push('<rect x="' + ((c + m) * cell) + '" y="' + ((r + m) * cell) + '" width="' + cell + '" height="' + cell + '"/>');
      }
    }
    const bg = transparent ? '' : '<rect width="' + size + '" height="' + size + '" fill="' + light + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges">' + bg + '<g fill="' + dark + '">' + darks.join('') + '</g></svg>';
  }

  function downloadPng() {
    if (!lastQr) { showToast('Nothing to download'); return; }
    canvas.toBlob((blob) => {
      if (!blob) { showToast('Export failed'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'qr-' + Date.now() + '.png';
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  }

  function downloadSvg() {
    if (!lastQr) { showToast('Nothing to download'); return; }
    const blob = new Blob([buildSvg()], { type: 'image/svg+xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'qr-' + Date.now() + '.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  downloadPngBtn.addEventListener('click', downloadPng);
  downloadSvgBtn.addEventListener('click', downloadSvg);

  render();
})();
