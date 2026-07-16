/**
 * 70015 \u2014 Palette Generator
 * Extract dominant colors from images
 */

(function () {
  'use strict';

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const uploadTitle = dropZone.querySelector('.upload__title');
  const uploadHint = dropZone.querySelector('.upload__hint');
  const colorCountInput = document.getElementById('colorCount');
  const colorCountValue = document.getElementById('colorCountValue');
  const sampleInput = document.getElementById('samplePrecision');
  const sampleValue = document.getElementById('sampleValue');
  const actionsPanel = document.getElementById('actionsPanel');
  const fileCount = document.getElementById('fileCount');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const paletteGrid = document.getElementById('paletteGrid');
  const toast = document.getElementById('toast');

  const state = {
    items: [], // { id, file, blobUrl, colors }
    colorCount: 5,
    samplePrecision: 2,
  };

  const SAMPLE_LABELS = { 1: 'Low', 2: 'Med', 3: 'High' };
  const SAMPLE_LABEL_KEYS = { 1: 'pal_sample_low', 2: 'pal_sample_med', 3: 'pal_sample_high' };
  const SAMPLE_SIZES = { 1: 32, 2: 64, 3: 128 };
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
  function sampleLabel(value) {
    return t(SAMPLE_LABEL_KEYS[value], SAMPLE_LABELS[value]);
  }

  function showToast(message, duration = 2000) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), duration);
  }

  function id() {
    return Math.random().toString(36).slice(2, 10);
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  function getLuminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  // Upload events
  let originalTitle = '';
  let originalHint = '';

  dropZone.addEventListener('dragenter', () => {
    if (!originalTitle) {
      originalTitle = uploadTitle.textContent;
      originalHint = uploadHint.textContent;
    }
    uploadTitle.textContent = t('conv_drop_files', 'Drop files to upload');
    uploadHint.textContent = t('conv_hint', 'Multiple images and folders supported');
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('is-dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('is-dragover');
    uploadTitle.textContent = originalTitle;
    uploadHint.textContent = originalHint;
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('is-dragover');
    uploadTitle.textContent = originalTitle;
    uploadHint.textContent = originalHint;
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';
  });

  colorCountInput.addEventListener('input', () => {
    state.colorCount = parseInt(colorCountInput.value, 10);
    colorCountValue.textContent = state.colorCount;
  });

  colorCountInput.addEventListener('change', () => {
    reextractAll();
  });

  sampleInput.addEventListener('input', () => {
    state.samplePrecision = parseInt(sampleInput.value, 10);
    sampleValue.textContent = sampleLabel(state.samplePrecision);
  });

  sampleInput.addEventListener('change', () => {
    reextractAll();
  });

  clearBtn.addEventListener('click', () => {
    state.items.forEach((item) => {
      if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    });
    state.items = [];
    render();
    showToast(t('toast_cleared', 'Cleared'));
  });

  exportBtn.addEventListener('click', () => {
    if (state.items.length === 0) {
      showToast(t('pal_nothing_export', 'Nothing to export'));
      return;
    }
    const data = state.items.map((item) => ({
      name: item.file.name,
      colors: item.colors.map((c) => c.hex),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `70015-palettes-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('pal_json_exported', 'JSON exported'));
  });

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

  function handleFiles(fileListObj) {
    const accepted = Array.from(fileListObj).filter((file) => {
      if (!file.type.startsWith('image/')) return false;
      if (file.size > MAX_FILE_SIZE) {
        showToast(tpl('conv_too_large', '{name} is too large (max 50 MB)', { name: file.name }));
        return false;
      }
      return true;
    });
    if (accepted.length === 0) {
      showToast(t('conv_select_images', 'Please select image files'));
      return;
    }

    const newItems = accepted.map((file) => ({
      id: id(),
      file,
      blobUrl: URL.createObjectURL(file),
      colors: [],
    }));

    state.items.push(...newItems);
    render();
    extractItems(newItems);
  }

  function reextractAll() {
    if (state.items.length === 0) return;
    state.items.forEach((item) => (item.colors = []));
    render();
    extractItems(state.items);
  }

  async function extractItems(items) {
    for (const item of items) {
      try {
        item.colors = await extractColors(item.file);
      } catch (err) {
        console.error(err);
        item.colors = [];
      }
      renderItem(item);
    }
    updateActions();
  }

  function extractColors(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const colors = getPalette(img, state.colorCount, SAMPLE_SIZES[state.samplePrecision]);
            resolve(colors);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error(t('conv_read_image_fail', 'Could not read image')));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error(t('conv_file_read_failed', 'File read failed')));
      reader.readAsDataURL(file);
    });
  }

  function getPalette(img, colorCount, sampleSize) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Downsample to sampleSize
    const ratio = img.naturalWidth / img.naturalHeight;
    let w, h;
    if (ratio > 1) {
      w = sampleSize;
      h = Math.round(sampleSize / ratio);
    } else {
      h = sampleSize;
      w = Math.round(sampleSize * ratio);
    }
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h).data;
    const buckets = new Map();

    // Quantize and count colors
    for (let i = 0; i < imageData.length; i += 16) { // Skip pixels for speed
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const a = imageData[i + 3];
      if (a < 128) continue;

      // Quantize to 6bit, merge similar colors
      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;
      const key = `${qr},${qg},${qb}`;

      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    // Sort by frequency
    const sorted = Array.from(buckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, colorCount * 3);

    // Merge overly similar colors
    const unique = [];
    for (const [key] of sorted) {
      const [r, g, b] = key.split(',').map(Number);
      const hex = rgbToHex(r, g, b);

      let tooClose = false;
      for (const existing of unique) {
        const dr = r - existing.r;
        const dg = g - existing.g;
        const db = b - existing.b;
        const distance = Math.sqrt(dr * dr + dg * dg + db * db);
        if (distance < 48) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        unique.push({ r, g, b, hex });
        if (unique.length >= colorCount) break;
      }
    }

    return unique;
  }

  function render() {
    paletteGrid.innerHTML = '';
    state.items.forEach((item) => renderItem(item));
    updateActions();
  }

  function renderItem(item) {
    let el = document.getElementById(`palette-${item.id}`);
    if (!el) {
      el = document.createElement('article');
      el.className = 'palette-card';
      el.id = `palette-${item.id}`;
      paletteGrid.appendChild(el);
    }

    const colorsHtml = item.colors
      .map(
        (color) => `
        <div class="color-swatch" style="background-color: ${color.hex};" data-hex="${color.hex}" title="Copy ${color.hex}">
          <span class="color-swatch__label">${color.hex}</span>
        </div>
      `
      )
      .join('');

    const loading = item.colors.length === 0 ? '<p class="palette-card__name">' + t('pal_extracting', 'Extracting...') + '</p>' : '';

    el.innerHTML = `
      <img class="palette-card__thumb" src="${item.blobUrl}" alt="" loading="lazy" decoding="async">
      <div class="palette-card__info">
        <h3 class="palette-card__name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</h3>
        ${loading}
        <div class="palette-card__colors">${colorsHtml}</div>
        <div class="palette-card__actions">
          <button class="btn btn--secondary btn--sm" data-action="copy-css" data-id="${item.id}" type="button">${t('pal_copy_css', 'Copy CSS')}</button>
          <button class="btn btn--secondary btn--sm" data-action="remove" data-id="${item.id}" type="button">${t('conv_remove', 'Remove')}</button>
        </div>
      </div>
    `;

    el.querySelectorAll('.color-swatch').forEach((swatch) => {
      swatch.addEventListener('click', () => {
        copyToClipboard(swatch.dataset.hex);
      });
    });

    const copyCssBtn = el.querySelector('[data-action="copy-css"]');
    if (copyCssBtn) {
      copyCssBtn.addEventListener('click', () => copyCss(item));
    }

    const removeBtn = el.querySelector('[data-action="remove"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => removeItem(item.id));
    }
  }

  function copyCss(item) {
    if (item.colors.length === 0) return;
    const css = item.colors
      .map((color, i) => `  --color-${i + 1}: ${color.hex};`)
      .join('\n');
    copyToClipboard(`:root {\n${css}\n}`);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(
      () => showToast(tpl('col_copied_value', 'Copied {value}', { value: text })),
      () => showToast(t('toast_copy_fail', 'Copy failed'))
    );
  }

  function removeItem(itemId) {
    const item = state.items.find((i) => i.id === itemId);
    if (item && item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    state.items = state.items.filter((i) => i.id !== itemId);
    const el = document.getElementById(`palette-${itemId}`);
    if (el) el.remove();
    updateActions();
  }

  function updateActions() {
    const count = state.items.length;
    actionsPanel.hidden = count === 0;
    fileCount.textContent = tpl('pal_count_images', '{count} images', { count });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  window.onLangChange = function () {
    sampleValue.textContent = sampleLabel(state.samplePrecision);
    render();
  };
})();
