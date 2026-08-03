(function () {
  'use strict';

  const drop = document.getElementById('metadataDrop');
  const input = document.getElementById('metadataInput');
  const status = document.getElementById('metadataStatus');
  const panel = document.getElementById('metadataPanel');
  const preview = document.getElementById('metadataPreview');
  const fileName = document.getElementById('metadataFileName');
  const facts = document.getElementById('metadataFacts');
  const table = document.getElementById('metadataTable');
  const formatSelector = document.getElementById('metadataFormatSelector');
  const quality = document.getElementById('metadataQuality');
  const qualityValue = document.getElementById('metadataQualityValue');
  const cleanBtn = document.getElementById('metadataCleanBtn');
  const toast = document.getElementById('toast');

  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  const state = { file: null, image: null, objectUrl: null, format: 'png' };

  function t(key, fallback) {
    return typeof window.t === 'function' ? window.t(key) : fallback;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2500);
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  function formatValue(value) {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Uint8Array) return `[${value.length} bytes]`;
    if (Array.isArray(value)) return value.map(formatValue).join(', ');
    if (value && typeof value === 'object') {
      try { return JSON.stringify(value); } catch (_) { return String(value); }
    }
    return String(value);
  }

  function clearObjectUrl() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  function reset() {
    clearObjectUrl();
    state.file = null;
    state.image = null;
    preview.removeAttribute('src');
    panel.hidden = true;
    fileName.textContent = '\u2014';
    facts.innerHTML = '';
    table.innerHTML = '';
    status.textContent = t('metadata_empty', 'No image loaded.');
    status.setAttribute('data-i18n', 'metadata_empty');
  }

  function renderFacts(file, image) {
    facts.innerHTML = '';
    const values = [
      file.type || t('metadata_unknown', 'Unknown type'),
      formatBytes(file.size),
      `${image.naturalWidth} × ${image.naturalHeight}`
    ];
    values.forEach((value) => {
      const el = document.createElement('span');
      el.className = 'metadata__fact';
      el.textContent = value;
      facts.appendChild(el);
    });
  }

  function renderTable(data) {
    table.innerHTML = '';
    const entries = Object.entries(data || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'settings__note';
      empty.textContent = t('metadata_no_data', 'No readable metadata found in this image.');
      table.appendChild(empty);
      return;
    }
    entries.sort(([a], [b]) => a.localeCompare(b));
    entries.forEach(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'metadata__row';
      const keyEl = document.createElement('div');
      keyEl.className = 'metadata__key';
      keyEl.textContent = key;
      const valueEl = document.createElement('div');
      valueEl.className = 'metadata__value';
      valueEl.textContent = formatValue(value);
      row.append(keyEl, valueEl);
      table.appendChild(row);
    });
  }

  function loadImage(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast(t('metadata_image_only', 'Please choose an image file.'));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast(t('metadata_too_large', 'Image is too large (max 100 MB).'));
      return;
    }

    reset();
    state.file = file;
    state.objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = async () => {
      state.image = image;
      preview.src = state.objectUrl;
      fileName.textContent = file.name;
      renderFacts(file, image);
      panel.hidden = false;
      status.textContent = t('metadata_reading', 'Reading metadata...');
      status.removeAttribute('data-i18n');
      try {
        if (!window.exifr || typeof window.exifr.parse !== 'function') throw new Error('EXIF library unavailable');
        const metadata = await window.exifr.parse(file, true);
        renderTable(metadata);
        status.textContent = t('metadata_ready', 'Metadata loaded locally.');
      } catch (_) {
        renderTable(null);
        status.textContent = t('metadata_parse_failed', 'Could not read metadata, but the image can still be cleaned.');
      }
      status.removeAttribute('data-i18n');
    };
    image.onerror = () => {
      reset();
      showToast(t('metadata_load_failed', 'Could not load this image.'));
    };
    image.src = state.objectUrl;
  }

  function getOutputType() {
    return state.format === 'jpeg' ? 'image/jpeg' : state.format === 'webp' ? 'image/webp' : 'image/png';
  }

  function downloadCleaned() {
    if (!state.file || !state.image) return;
    const canvas = document.createElement('canvas');
    canvas.width = state.image.naturalWidth;
    canvas.height = state.image.naturalHeight;
    if (canvas.width * canvas.height > 64 * 1024 * 1024) {
      showToast(t('metadata_output_large', 'The image is too large to clean safely.'));
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (state.format === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(state.image, 0, 0);
    const type = getOutputType();
    canvas.toBlob((blob) => {
      if (!blob) {
        showToast(t('metadata_export_failed', 'Could not export cleaned image.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = state.file.name.replace(/\.[^/.]+$/, '') + '-clean.' + (state.format === 'jpeg' ? 'jpg' : state.format);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(t('metadata_cleaned', 'Metadata removed from exported image.'));
    }, type, state.format === 'png' ? undefined : Number(quality.value) / 100);
  }

  formatSelector.addEventListener('click', (event) => {
    const button = event.target.closest('[data-value]');
    if (!button) return;
    state.format = button.dataset.value;
    formatSelector.querySelectorAll('[data-value]').forEach((item) => item.classList.toggle('is-active', item === button));
  });
  quality.addEventListener('input', () => { qualityValue.textContent = quality.value; });
  cleanBtn.addEventListener('click', downloadCleaned);
  input.addEventListener('change', (event) => { loadImage(event.target.files[0]); input.value = ''; });
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => drop.addEventListener(eventName, (event) => { event.preventDefault(); event.stopPropagation(); }));
  ['dragenter', 'dragover'].forEach((eventName) => drop.addEventListener(eventName, () => drop.classList.add('is-dragover')));
  ['dragleave', 'drop'].forEach((eventName) => drop.addEventListener(eventName, () => drop.classList.remove('is-dragover')));
  drop.addEventListener('drop', (event) => loadImage(event.dataTransfer.files[0]));
  window.addEventListener('paste', (event) => {
    const items = event.clipboardData && event.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { event.preventDefault(); loadImage(file); break; }
      }
    }
  });

  window.onLangChange = function () {
    if (!state.file) return;
    status.removeAttribute('data-i18n');
  };
})();
