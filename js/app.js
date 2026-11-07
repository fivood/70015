/**
 * Web Toolbox \u2014 Image Converter
 * Browser-based image converter (WebP / AVIF / JPEG / PNG / ICO)
 * Uses HTML5 Canvas API + JSZip + FileSaver
 */

(function () {
  'use strict';

  // DOM elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const uploadTitle = dropZone.querySelector('.upload__title');
  const uploadHint = dropZone.querySelector('.upload__hint');
  const formatSelector = document.getElementById('formatSelector');
  const formatNote = document.getElementById('formatNote');
  const presetSelector = document.getElementById('presetSelector');
  const icoSizePanel = document.getElementById('icoSizePanel');
  const icoSizeSelector = document.getElementById('icoSizeSelector');
  const icoCropSelector = document.getElementById('icoCropSelector');
  const qualityInput = document.getElementById('quality');
  const qualityValue = document.getElementById('qualityValue');
  const resizeModeSelector = document.getElementById('resizeModeSelector');
  const dimensionsPanel = document.getElementById('dimensionsPanel');
  const customFitPanel = document.getElementById('customFitPanel');
  const customFitSelector = document.getElementById('customFitSelector');
  const widthInput = document.getElementById('widthInput');
  const heightInput = document.getElementById('heightInput');
  const widthField = document.getElementById('widthField');
  const heightField = document.getElementById('heightField');
  const actionsPanel = document.getElementById('actionsPanel');
  const fileCount = document.getElementById('fileCount');
  const totalSize = document.getElementById('totalSize');
  const clearBtn = document.getElementById('clearBtn');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const fileList = document.getElementById('fileList');
  const toast = document.getElementById('toast');

  let conversionGeneration = 0;
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

  // State
  const state = {
    files: [], // { id, file, status, result, error, blobUrl }
    format: 'webp',
    quality: 0.85,
    resizeMode: 'original',
    width: null,
    height: null,
    icoSizes: [32, 256],
    icoCropMode: 'contain',
    customFit: 'contain',
  };

  const FORMAT_NOTES = {
    webp: 'WebP offers the best size-to-compatibility ratio.',
    avif: 'AVIF has the highest compression, but export requires a supported browser; otherwise falls back to WebP.',
    jpeg: 'JPEG is the most compatible format for photos; transparent areas become white.',
    png: 'PNG is lossless and keeps transparency, but files are usually larger.',
    ico: 'ICO is used for favicons. Include 32\u00d732 and 256\u00d7256 for best coverage.',
  };
  const FORMAT_NOTE_KEYS = {
    webp: 'conv_note_webp', avif: 'conv_note_avif', jpeg: 'conv_note_jpeg', png: 'conv_note_png', ico: 'conv_note_ico'
  };
  function formatNoteText(fmt) {
    if (typeof window.t === 'function' && FORMAT_NOTE_KEYS[fmt]) return window.t(FORMAT_NOTE_KEYS[fmt]);
    return FORMAT_NOTES[fmt] || '';
  }

  const FORMAT_MIMES = {
    webp: 'image/webp',
    avif: 'image/avif',
    jpeg: 'image/jpeg',
    png: 'image/png',
    ico: 'image/x-icon',
  };

  const FORMAT_EXTENSIONS = {
    webp: 'webp',
    avif: 'avif',
    jpeg: 'jpg',
    png: 'png',
    ico: 'ico',
  };

  const DEFAULT_ICO_SIZES = [32, 256];

  const PRESETS = {
    custom: null,
    'webp-only': { format: 'webp', resizeMode: 'original', quality: 0.85 },
    'blog-cover': { format: 'webp', resizeMode: 'custom', width: 1200, height: 630, customFit: 'cover', quality: 0.85 },
    thumbnail: { format: 'jpeg', resizeMode: 'custom', width: 300, height: 300, customFit: 'cover', quality: 0.8 },
    social: { format: 'jpeg', resizeMode: 'custom', width: 1080, height: 1080, customFit: 'cover', quality: 0.9 },
  };

  // Utilities
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function id() {
    return Math.random().toString(36).slice(2, 10);
  }

  function showToast(message, duration = 2500) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), duration);
  }

  function getBaseName(filename) {
    return filename.replace(/\.[^/.]+$/, '');
  }

  // Check if browser supports a canvas output format
  async function isFormatSupported(mime) {
    try {
      const probe = document.createElement('canvas');
      probe.width = 1;
      probe.height = 1;
      const blob = await new Promise((resolve) => probe.toBlob(resolve, mime));
      return !!blob && blob.type === mime;
    } catch {
      return false;
    }
  }

  // Upload events
  let originalTitle = '';
  let originalHint = '';

  dropZone.addEventListener('dragenter', () => {
    if (!originalTitle) {
      originalTitle = uploadTitle.textContent;
      originalHint = uploadHint.textContent;
    }
    uploadTitle.textContent = (typeof window.t === 'function') ? window.t('conv_drop_files') : 'Drop files to upload';
    uploadHint.textContent = (typeof window.t === 'function') ? window.t('conv_hint') : 'Multiple images and folders supported';
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

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('is-dragover');
    uploadTitle.textContent = originalTitle;
    uploadHint.textContent = originalHint;
    handleFiles(await collectDropFiles(e.dataTransfer));
  });

  // Walk dropped entries recursively so whole folders can be dropped.
  // Falls back to the plain file list when the entry API is unavailable.
  async function collectDropFiles(dataTransfer) {
    const items = dataTransfer.items;
    if (!items || typeof items[0] === 'undefined' || !items[0].webkitGetAsEntry) {
      return Array.from(dataTransfer.files || []);
    }
    const files = [];
    const readEntry = (entry) => new Promise((resolve) => {
      if (!entry) { resolve(); return; }
      if (entry.isFile) {
        entry.file((file) => { files.push(file); resolve(); }, () => resolve());
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readBatch = () => {
          reader.readEntries((entries) => {
            if (!entries.length) { resolve(); return; }
            Promise.all(Array.from(entries).map(readEntry)).then(readBatch);
          }, () => resolve());
        };
        readBatch();
      } else {
        resolve();
      }
    });
    await Promise.all(Array.from(items).map((item) => readEntry(item.webkitGetAsEntry())));
    return files.length ? files : Array.from(dataTransfer.files || []);
  }

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = ''; // Allow re-selecting the same file
  });

  // Format selection
  formatSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      formatSelector.querySelectorAll('.segmented__btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.format = btn.dataset.value;
      formatNote.textContent = formatNoteText(state.format);
      formatNote.setAttribute('data-i18n', FORMAT_NOTE_KEYS[state.format] || '');
      toggleIcoPanel();
      setActivePreset('custom');
      reconvertAll();
    });
  });

  function toggleIcoPanel() {
    icoSizePanel.hidden = state.format !== 'ico';
  }

  // Presets
  presetSelector.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset);
    });
  });

  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) {
      setActivePreset(presetKey);
      return;
    }

    // Apply preset values
    if (preset.format) state.format = preset.format;
    if (preset.resizeMode) state.resizeMode = preset.resizeMode;
    if (preset.width !== undefined) state.width = preset.width;
    if (preset.height !== undefined) state.height = preset.height;
    if (preset.customFit) state.customFit = preset.customFit;
    if (preset.quality !== undefined) state.quality = preset.quality;
    if (preset.icoSizes) state.icoSizes = [...preset.icoSizes];
    if (preset.icoCropMode) state.icoCropMode = preset.icoCropMode;

    setActivePreset(presetKey);
    updateUI();
    reconvertAll();
  }

  function setActivePreset(presetKey) {
    presetSelector.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.preset === presetKey);
    });
  }

  function updateUI() {
    // Format
    formatSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.value === state.format);
    });
    formatNote.textContent = formatNoteText(state.format);
    formatNote.setAttribute('data-i18n', FORMAT_NOTE_KEYS[state.format] || '');
    toggleIcoPanel();

    // Resize mode
    resizeModeSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.value === state.resizeMode);
    });
    updateDimensionFields();

    // Dimension inputs
    widthInput.value = state.width || '';
    heightInput.value = state.height || '';

    // Custom fit
    customFitSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.value === state.customFit);
    });

    // ICO sizes
    icoSizeSelector.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = state.icoSizes.includes(parseInt(cb.value, 10));
    });

    // ICO crop mode
    icoCropSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.value === state.icoCropMode);
    });

    // Quality
    qualityInput.value = Math.round(state.quality * 100);
    qualityValue.textContent = qualityInput.value;
  }

  // ICO size selection
  icoSizeSelector.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const selected = Array.from(icoSizeSelector.querySelectorAll('input:checked')).map((c) => parseInt(c.value, 10));
      if (selected.length === 0) {
        // Keep at least one, default to 32
        cb.checked = true;
        state.icoSizes = [32];
        showToast(t('conv_select_ico', 'Select at least one ICO size'));
      } else {
        state.icoSizes = selected;
      }
      setActivePreset('custom');
      reconvertAll();
    });
  });

  // ICO non-square image handling
  icoCropSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      icoCropSelector.querySelectorAll('.segmented__btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.icoCropMode = btn.dataset.value;
      setActivePreset('custom');
      reconvertAll();
    });
  });

  // Quality slider
  qualityInput.addEventListener('input', () => {
    state.quality = parseInt(qualityInput.value, 10) / 100;
    qualityValue.textContent = qualityInput.value;
  });

  qualityInput.addEventListener('change', () => {
    setActivePreset('custom');
    reconvertAll();
  });

  // Resize mode
  resizeModeSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      resizeModeSelector.querySelectorAll('.segmented__btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.resizeMode = btn.dataset.value;
      updateDimensionFields();
      setActivePreset('custom');
      reconvertAll();
    });
  });

  function updateDimensionFields() {
    const mode = state.resizeMode;
    dimensionsPanel.classList.toggle('is-hidden', mode === 'original');
    widthField.hidden = mode === 'original' || mode === 'height';
    heightField.hidden = mode === 'original' || mode === 'width';
    customFitPanel.hidden = mode !== 'custom';

    if (mode === 'width') {
      widthField.querySelector('label').textContent = t('conv_target_w', 'Target width px');
      widthField.querySelector('label').setAttribute('data-i18n', 'conv_target_w');
    } else if (mode === 'height') {
      heightField.querySelector('label').textContent = t('conv_target_h', 'Target height px');
      heightField.querySelector('label').setAttribute('data-i18n', 'conv_target_h');
    } else if (mode === 'max') {
      widthField.querySelector('label').textContent = t('conv_max_edge', 'Max edge px');
      widthField.querySelector('label').setAttribute('data-i18n', 'conv_max_edge');
    } else if (mode === 'custom') {
      widthField.querySelector('label').textContent = t('conv_w_px', 'Width px');
      widthField.querySelector('label').setAttribute('data-i18n', 'conv_w_px');
      heightField.querySelector('label').textContent = t('conv_h_px', 'Height px');
      heightField.querySelector('label').setAttribute('data-i18n', 'conv_h_px');
    }
  }

  widthInput.addEventListener('change', () => {
    state.width = parseInt(widthInput.value, 10) || null;
    setActivePreset('custom');
    reconvertAll();
  });

  heightInput.addEventListener('change', () => {
    state.height = parseInt(heightInput.value, 10) || null;
    setActivePreset('custom');
    reconvertAll();
  });

  // Custom fit mode
  customFitSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      customFitSelector.querySelectorAll('.segmented__btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.customFit = btn.dataset.value;
      setActivePreset('custom');
      reconvertAll();
    });
  });

  // Clear
  clearBtn.addEventListener('click', () => {
    conversionGeneration++;
    state.files.forEach((item) => {
      if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    });
    state.files = [];
    render();
    showToast(t('conv_all_cleared', 'All images cleared'));
  });

  // Download ZIP
  downloadAllBtn.addEventListener('click', async () => {
    if (typeof JSZip !== 'function' || typeof saveAs !== 'function') {
      showToast(t('conv_zip_failed', 'ZIP dependencies are unavailable')); return;
    }
    const readyItems = state.files.filter((f) => f.status === 'ready' && f.result);
    if (readyItems.length === 0) {
      showToast(t('conv_no_ready', 'No files ready for download'));
      return;
    }

    downloadAllBtn.disabled = true;
    const originalText = downloadAllBtn.innerHTML;
    downloadAllBtn.innerHTML = '<span>' + t('conv_zipping', 'Zipping...') + '</span>';

    try {
      const zip = new JSZip();
      const folder = zip.folder('converted-images');
      // a.png and a.jpg both become a.webp: number repeats instead of letting one overwrite the other.
      const used = new Set();
      readyItems.forEach((item) => {
        const name = outputName(item);
        const dot = name.lastIndexOf('.');
        let unique = name;
        for (let n = 2; used.has(unique.toLowerCase()); n++) unique = `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
        used.add(unique.toLowerCase());
        folder.file(unique, item.result.blob);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `web-toolbox-images-${state.format}-${Date.now()}.zip`);
      showToast(tpl('conv_zipped', 'Zipped {count} images', { count: readyItems.length }));
    } catch (err) {
      console.error(err);
      showToast(t('conv_zip_failed', 'ZIP failed') + ': ' + err.message);
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.innerHTML = originalText;
    }
  });

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

  // Handle files
  function handleFiles(fileListObj) {
    const accepted = Array.from(fileListObj || []).filter((file) => {
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
      status: 'pending',
      result: null,
      error: null,
      blobUrl: null,
    }));

    state.files.push(...newItems);
    render();
    convertItems(newItems, conversionGeneration, captureSettings());

    // Scroll to file list after upload
    setTimeout(() => {
      actionsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  // Reconvert all
  function reconvertAll() {
    const generation = ++conversionGeneration;
    if (state.files.length === 0) return;
    state.files.forEach((item) => {
      item.status = 'pending';
      item.result = null;
      item.error = null;
      if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
      item.blobUrl = null;
    });
    render();
    convertItems(state.files, generation, captureSettings());
  }

  // Core conversion
  function captureSettings() {
    return {
      format: state.format,
      quality: state.quality,
      resizeMode: state.resizeMode,
      width: state.width,
      height: state.height,
      icoSizes: [...state.icoSizes],
      icoCropMode: state.icoCropMode,
      customFit: state.customFit,
    };
  }

  async function convertItems(items, generation = conversionGeneration, settings = captureSettings()) {
    const supportsAvif = settings.format === 'avif' ? await isFormatSupported('image/avif') : true;
    const actualFormat = settings.format === 'avif' && !supportsAvif ? 'webp' : settings.format;

    for (const item of items) {
      if (generation !== conversionGeneration || !state.files.includes(item)) return;
      const rev = item.rev;
      try {
        item.status = 'converting';
        renderItem(item);

        // A crop position picked in the preview dialog applies to this file only.
        const result = await convertFile(item.file, actualFormat, item.focus ? { ...settings, focus: item.focus } : settings);
        if (generation !== conversionGeneration || !state.files.includes(item)) return;
        if (item.rev !== rev) continue; // superseded by a newer reconvertItem
        item.result = result;
        item.status = 'ready';
        if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
        item.blobUrl = URL.createObjectURL(result.blob);
      } catch (err) {
        if (generation !== conversionGeneration || !state.files.includes(item)) return;
        item.status = 'error';
        item.error = err.message || t('conv_conversion_failed', 'Conversion failed');
      }
      renderItem(item);
    }

    if (generation === conversionGeneration) updateActions();
  }

  function getCanvasContext(canvas) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error(t('conv_output_unsupported', 'Browser does not support canvas output'));
    return context;
  }

  function convertFile(file, format, settings) {
    return IconKit.loadImageFromFile(file).then(function (img) {
      try {
        if (format === 'ico') {
          return IconKit.convertToIco(img, settings);
        }

        var canvas = document.createElement('canvas');
        var ctx = getCanvasContext(canvas);
        var dims = calculateDimensions(img.naturalWidth, img.naturalHeight, settings);
        var width = dims.width;
        var height = dims.height;
        if (width * height > 64 * 1024 * 1024) {
          throw new Error(t('conv_conversion_failed', 'Output is too large'));
        }
        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);
        if (format === 'jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }

        var isCustomCover = settings.resizeMode === 'custom' && settings.customFit === 'cover' && settings.width && settings.height;
        if (isCustomCover) {
          const win = IconKit.coverWindow({ x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }, width / height, settings.focus);
          ctx.drawImage(img, win.x, win.y, win.w, win.h, 0, 0, width, height);
        } else {
          ctx.drawImage(img, 0, 0, width, height);
        }

        var mime = FORMAT_MIMES[format];
        var quality = format === 'png' ? undefined : settings.quality;

        return new Promise(function (resolve, reject) {
          canvas.toBlob(
            function (blob) {
              if (!blob) {
                reject(new Error(t('conv_output_unsupported', 'Browser does not support this output format')));
                return;
              }
              resolve({
                blob: blob,
                width: width,
                height: height,
                originalWidth: img.naturalWidth,
                originalHeight: img.naturalHeight,
                format: format,
              });
            },
            mime,
            quality
          );
        });
      } catch (err) {
        return Promise.reject(err);
      }
    });
  }


  function calculateDimensions(originalWidth, originalHeight, settings = state) {
    const mode = settings.resizeMode;
    const w = settings.width;
    const h = settings.height;

    if (mode === 'original') {
      return { width: originalWidth, height: originalHeight };
    }

    const ratio = originalWidth / originalHeight;

    if (mode === 'width' && w) {
      return { width: w, height: Math.round(w / ratio) };
    }

    if (mode === 'height' && h) {
      return { width: Math.round(h * ratio), height: h };
    }

    if (mode === 'max' && w) {
      const maxSide = Math.max(originalWidth, originalHeight);
      if (maxSide <= w) return { width: originalWidth, height: originalHeight };
      if (originalWidth >= originalHeight) {
        return { width: w, height: Math.round(w / ratio) };
      }
      return { width: Math.round(w * ratio), height: w };
    }

    if (mode === 'custom' && w && h) {
      if (settings.customFit === 'cover') {
        // Center crop to fill target size
        return { width: w, height: h };
      }
      // Contain scale to user dimensions, keep aspect ratio
      const targetRatio = w / h;
      if (ratio > targetRatio) {
        return { width: w, height: Math.round(w / ratio) };
      }
      return { width: Math.round(h * ratio), height: h };
    }

    return { width: originalWidth, height: originalHeight };
  }

  // Render
  function render() {
    fileList.innerHTML = '';
    state.files.forEach((item) => renderItem(item));
    updateActions();
  }

  function renderItem(item) {
    let el = document.getElementById(`file-${item.id}`);
    if (!el) {
      el = document.createElement('article');
      el.className = 'file';
      el.id = `file-${item.id}`;
      fileList.appendChild(el);
    }

    const isReady = item.status === 'ready';
    const isError = item.status === 'error';
    const isConverting = item.status === 'converting';

    const hasThumb = !!item.blobUrl;
    const thumbHtml = hasThumb
      ? `<button class="file__thumb-btn" type="button" data-action="preview" title="${escapeHtml(t('conv_preview_open', 'View full size'))}"><img class="file__thumb" src="${item.blobUrl}" alt="" loading="lazy" decoding="async"></button>`
      : `<div class="file__thumb-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15 L16 10 L10 16 L7 13 L3 17"/></svg></div>`;

    const statusClass = isError ? 'file__status--error' : isReady ? 'file__status--ready' : 'file__status--converting';
    const statusHtml = isConverting
      ? `<span class="file__status ${statusClass}">${t('conv_s_converting', 'Converting')}</span><span class="progress-bar" aria-hidden="true"><span class="progress-bar__fill"></span></span>`
      : `<span class="file__status ${statusClass}">${isError ? t('conv_s_failed', 'Failed') : isReady ? t('conv_s_done', 'Done') : t('conv_s_pending', 'Pending')}</span>`;

    const reduction = isReady
      ? ', ' + tpl('conv_saved', 'saved {percent}%', { percent: Math.max(0, 100 - Math.round((item.result.blob.size / item.file.size) * 100)) })
      : '';

    let meta = `${formatBytes(item.file.size)}`;
    if (isReady) {
      if (item.result.format === 'ico' && item.result.icoSizes) {
        const sizesText = item.result.icoSizes.join(', ') + ' px';
        meta = `ICO (${sizesText}) \u00b7 ${formatBytes(item.result.blob.size)}${reduction}`;
      } else {
        meta = `${item.result.width}\u00d7${item.result.height} \u00b7 ${formatBytes(item.result.blob.size)}${reduction}`;
      }
      // The bold name is what gets downloaded; the source file moves to the meta line.
      meta = `${escapeHtml(item.file.name)} \u2192 ${meta}`;
    }
    const shownName = isReady ? outputName(item) : item.file.name;
    const nameHtml = isReady
      ? `<h3 class="file__name file__name--split" title="${escapeHtml(shownName)}"><span>${escapeHtml(getBaseName(item.file.name))}</span><span>.${FORMAT_EXTENSIONS[item.result.format]}</span></h3>`
      : `<h3 class="file__name" title="${escapeHtml(shownName)}">${escapeHtml(shownName)}</h3>`;

    el.innerHTML = `
      ${thumbHtml}
      <div class="file__info">
        ${nameHtml}
        <p class="file__meta">${meta}</p>
        ${statusHtml}
      </div>
      <div class="file__actions">
        ${
          isReady
            ? `<button class="btn btn--primary btn--sm" type="button" data-action="download" data-id="${item.id}">${t('conv_download', 'Download')}</button>`
            : ''
        }
        <button class="btn btn--secondary btn--sm" type="button" data-action="remove" data-id="${item.id}">${t('conv_remove', 'Remove')}</button>
      </div>
    `;

    // Bind events
    const downloadBtn = el.querySelector('[data-action="download"]');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => downloadItem(item));
    }

    const removeBtn = el.querySelector('[data-action="remove"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => removeItem(item.id));
    }

    const previewBtn = el.querySelector('[data-action="preview"]');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => openPreview(item));
    }

    if (previewItem === item) updatePreview();
  }

  function outputName(item) {
    return `${getBaseName(item.file.name)}.${FORMAT_EXTENSIONS[item.result.format]}`;
  }

  function downloadItem(item) {
    if (!item.result) return;
    saveAs(item.result.blob, outputName(item));
  }

  // ---------- Full-size preview, and crop position for Cover modes ----------
  const previewDialog = document.getElementById('previewDialog');
  const previewTitle = document.getElementById('previewTitle');
  const previewImg = document.getElementById('previewImg');
  const previewInfo = document.getElementById('previewInfo');
  const previewCrop = document.getElementById('previewCrop');
  let previewItem = null;
  // Releasing the frame reconverts just this file with its new crop position.
  const coverPicker = IconKit.createCoverPicker(document.getElementById('previewCropCanvas'), (focus) => {
    previewItem.focus = focus;
    reconvertItem(previewItem);
  });

  // Aspect ratio a Cover crop cuts the image to under the current settings, or null if nothing is cut.
  function coverRatio(settings) {
    if (settings.format === 'ico') return settings.icoCropMode === 'cover' ? 1 : null;
    if (settings.resizeMode === 'custom' && settings.customFit === 'cover' && settings.width && settings.height) return settings.width / settings.height;
    return null;
  }

  async function openPreview(item) {
    previewItem = item;
    previewCrop.hidden = true;
    updatePreview();
    previewDialog.showModal();

    const ratio = coverRatio(state);
    if (!ratio) return;
    const img = await IconKit.loadImageFromFile(item.file);
    if (previewItem !== item) return;
    // ICO crops inside the visible (non-transparent) part of the image, as js/icon.js does.
    const bounds = state.format === 'ico'
      ? IconKit.getVisibleImageBounds(img)
      : { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
    previewCrop.hidden = !coverPicker.show(img, bounds, ratio, item.focus);
  }

  function updatePreview() {
    const item = previewItem;
    previewTitle.textContent = item.result ? outputName(item) : item.file.name;
    if (item.blobUrl && previewImg.getAttribute('src') !== item.blobUrl) previewImg.src = item.blobUrl;
    previewImg.classList.toggle('is-stale', item.status !== 'ready');
    previewInfo.textContent = item.result
      ? `${item.result.format === 'ico' ? 'ICO ' + item.result.icoSizes.join(', ') + ' px' : item.result.width + '×' + item.result.height} · ${formatBytes(item.result.blob.size)}`
      : t('conv_s_converting', 'Converting');
  }

  document.getElementById('previewCropReset').addEventListener('click', () => {
    previewItem.focus = null;
    coverPicker.setFocus(null);
    reconvertItem(previewItem);
  });

  // Click on the backdrop closes, like the close button.
  previewDialog.addEventListener('click', (e) => { if (e.target === previewDialog) previewDialog.close(); });
  previewDialog.addEventListener('close', () => { previewItem = null; });

  function reconvertItem(item) {
    item.status = 'pending';
    item.rev = (item.rev || 0) + 1; // a later drag supersedes a conversion still in flight
    convertItems([item], conversionGeneration, captureSettings());
  }

  function removeItem(itemId) {
    const item = state.files.find((f) => f.id === itemId);
    if (item && item === previewItem) previewDialog.close();
    if (item && item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    state.files = state.files.filter((f) => f.id !== itemId);
    const el = document.getElementById(`file-${itemId}`);
    if (el) el.remove();
    updateActions();
  }

  function updateActions() {
    const count = state.files.length;
    if (count === 0) {
      actionsPanel.hidden = true;
      return;
    }

    actionsPanel.hidden = false;
    document.body.classList.add('is-working');
    const readyCount = state.files.filter((f) => f.status === 'ready').length;
    fileCount.textContent = tpl('conv_count_done', '{count} images · {ready}/{count} done', { count, ready: readyCount });
    const total = state.files
      .filter((f) => f.status === 'ready' && f.result)
      .reduce((sum, f) => sum + f.result.blob.size, 0);
    totalSize.textContent = formatBytes(total);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Init
  updateUI();
  window.onLangChange = function () {
    updateUI();
    render();
  };
})();
