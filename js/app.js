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
  const workCanvas = document.getElementById('workCanvas');
  const toast = document.getElementById('toast');

  const ctx = workCanvas.getContext('2d');

  // State
  const state = {
    files: [], // { id, file, status, result, error, blobUrl }
    format: 'webp',
    quality: 0.85,
    resizeMode: 'original',
    width: null,
    height: null,
    icoSizes: [32, 256],
    icoCropMode: 'cover',
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
    favicon: { format: 'ico', resizeMode: 'original', icoSizes: [32, 256], icoCropMode: 'cover', quality: 0.9 },
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

  function blobToArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  // Check if browser supports a canvas output format
  async function isFormatSupported(mime) {
    try {
      const blob = await new Promise((resolve) => workCanvas.toBlob(resolve, mime));
      return !!blob;
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

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('is-dragover');
    uploadTitle.textContent = originalTitle;
    uploadHint.textContent = originalHint;
    handleFiles(e.dataTransfer.files);
  });

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
        showToast('Select at least one ICO size');
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
      widthField.querySelector('label').textContent = 'Target width px';
    } else if (mode === 'height') {
      heightField.querySelector('label').textContent = 'Target height px';
    } else if (mode === 'max') {
      widthField.querySelector('label').textContent = 'Max edge px';
    } else if (mode === 'custom') {
      widthField.querySelector('label').textContent = 'Width px';
      heightField.querySelector('label').textContent = 'Height px';
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
    state.files.forEach((item) => {
      if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    });
    state.files = [];
    render();
    showToast('All images cleared');
  });

  // Download ZIP
  downloadAllBtn.addEventListener('click', async () => {
    const readyItems = state.files.filter((f) => f.status === 'ready' && f.result);
    if (readyItems.length === 0) {
      showToast('No files ready for download');
      return;
    }

    downloadAllBtn.disabled = true;
    const originalText = downloadAllBtn.innerHTML;
    downloadAllBtn.innerHTML = '<span>Zipping\u2026</span>';

    try {
      const zip = new JSZip();
      const folder = zip.folder('converted-images');
      readyItems.forEach((item) => {
        const name = `${getBaseName(item.file.name)}.${FORMAT_EXTENSIONS[item.result.format]}`;
        folder.file(name, item.result.blob);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `web-toolbox-images-${state.format}-${Date.now()}.zip`);
      showToast(`Zipped ${readyItems.length} images`);
    } catch (err) {
      console.error(err);
      showToast('Zip failed: ' + err.message);
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.innerHTML = originalText;
    }
  });

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

  // Handle files
  function handleFiles(fileListObj) {
    const accepted = Array.from(fileListObj).filter((file) => {
      if (!file.type.startsWith('image/')) return false;
      if (file.size > MAX_FILE_SIZE) {
        showToast(`${file.name} is too large (max 50 MB)`);
        return false;
      }
      return true;
    });
    if (accepted.length === 0) {
      showToast('Please select image files');
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
    convertItems(newItems);

    // Scroll to file list after upload
    setTimeout(() => {
      actionsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  // Reconvert all
  function reconvertAll() {
    if (state.files.length === 0) return;
    state.files.forEach((item) => {
      item.status = 'pending';
      item.result = null;
      item.error = null;
      if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
      item.blobUrl = null;
    });
    render();
    convertItems(state.files);
  }

  // Core conversion
  async function convertItems(items) {
    const supportsAvif = state.format === 'avif' ? await isFormatSupported('image/avif') : true;
    const actualFormat = state.format === 'avif' && !supportsAvif ? 'webp' : state.format;

    for (const item of items) {
      try {
        item.status = 'converting';
        renderItem(item);

        const result = await convertFile(item.file, actualFormat);
        item.result = result;
        item.status = 'ready';
        item.blobUrl = URL.createObjectURL(result.blob);
      } catch (err) {
        console.error(err);
        item.status = 'error';
        item.error = err.message || 'Conversion failed';
      }
      renderItem(item);
    }

    updateActions();
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      var isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

      if (isSvg) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var svgText = e.target.result;
          try {
            var doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
            var svgEl = doc.documentElement;
            if (svgEl && svgEl.nodeName.toLowerCase() === 'svg') {
              var hasW = svgEl.getAttribute('width');
              var hasH = svgEl.getAttribute('height');
              var vb = svgEl.getAttribute('viewBox');
              if (vb && (!hasW || !hasH)) {
                var parts = vb.trim().split(/[\s,]+/);
                if (parts.length === 4) {
                  var w = parseFloat(parts[2]);
                  var h = parseFloat(parts[3]);
                  if (w > 0 && h > 0) {
                    if (!hasW) svgEl.setAttribute('width', w);
                    if (!hasH) svgEl.setAttribute('height', h);
                    svgText = new XMLSerializer().serializeToString(doc);
                  }
                }
              }
            }
          } catch (err) {
            // If parsing fails, use original text
          }
          var dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
          var img = new Image();
          img.onload = function () { resolve(img); };
          img.onerror = function () { reject(new Error('Could not read image')); };
          img.src = dataUrl;
        };
        reader.onerror = function () { reject(new Error('File read failed')); };
        reader.readAsText(file);
      } else {
        var reader2 = new FileReader();
        reader2.onload = function (e) {
          var img = new Image();
          img.onload = function () { resolve(img); };
          img.onerror = function () { reject(new Error('Could not read image')); };
          img.src = e.target.result;
        };
        reader2.onerror = function () { reject(new Error('File read failed')); };
        reader2.readAsDataURL(file);
      }
    });
  }

  function convertFile(file, format) {
    return loadImageFromFile(file).then(function (img) {
      try {
        if (format === 'ico') {
          return convertToIco(img);
        }

        var dims = calculateDimensions(img.naturalWidth, img.naturalHeight);
        var width = dims.width;
        var height = dims.height;
        workCanvas.width = width;
        workCanvas.height = height;

        ctx.clearRect(0, 0, width, height);
        if (format === 'jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }

        var isCustomCover = state.resizeMode === 'custom' && state.customFit === 'cover' && state.width && state.height;
        if (isCustomCover) {
          drawCoverRect(ctx, img, width, height);
        } else {
          ctx.drawImage(img, 0, 0, width, height);
        }

        var mime = FORMAT_MIMES[format];
        var quality = format === 'png' ? undefined : state.quality;

        return new Promise(function (resolve, reject) {
          workCanvas.toBlob(
            function (blob) {
              if (!blob) {
                reject(new Error('Browser does not support this output format'));
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

  // ICO generation: multi-size PNG-encoded icon
  async function convertToIco(img) {
    const sizes = [...state.icoSizes].sort((a, b) => a - b);
    if (sizes.length === 0) sizes.push(32);

    const pngBuffers = [];
    for (const size of sizes) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const c = canvas.getContext('2d');
      c.clearRect(0, 0, size, size);
      drawSquareImage(c, img, size, state.icoCropMode);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not generate PNG data for ICO');
      const buf = await blobToArrayBuffer(blob);
      pngBuffers.push({ size, buffer: new Uint8Array(buf) });
    }

    const count = pngBuffers.length;
    const headerSize = 6;
    const dirSize = count * 16;
    let dataOffset = headerSize + dirSize;

    const header = new DataView(new ArrayBuffer(headerSize));
    header.setUint16(0, 0, true); // Reserved
    header.setUint16(2, 1, true); // Type: icon
    header.setUint16(4, count, true); // Count

    const dir = new DataView(new ArrayBuffer(dirSize));
    const parts = [new Uint8Array(header.buffer)];

    let dirOffset = 0;
    for (let i = 0; i < count; i++) {
      const { size, buffer } = pngBuffers[i];
      const w = size >= 256 ? 0 : size;
      const h = size >= 256 ? 0 : size;

      dir.setUint8(dirOffset, w);
      dir.setUint8(dirOffset + 1, h);
      dir.setUint8(dirOffset + 2, 0); // ColorCount
      dir.setUint8(dirOffset + 3, 0); // Reserved
      dir.setUint16(dirOffset + 4, 1, true); // Planes
      dir.setUint16(dirOffset + 6, 32, true); // BitCount
      dir.setUint32(dirOffset + 8, buffer.length, true); // BytesInRes
      dir.setUint32(dirOffset + 12, dataOffset, true); // ImageOffset

      parts.push(buffer);
      dataOffset += buffer.length;
      dirOffset += 16;
    }

    parts.splice(1, 0, new Uint8Array(dir.buffer));
    const icoBlob = new Blob(parts, { type: 'image/x-icon' });

    return {
      blob: icoBlob,
      width: sizes[sizes.length - 1],
      height: sizes[sizes.length - 1],
      icoSizes: sizes,
      originalWidth: img.naturalWidth,
      originalHeight: img.naturalHeight,
      format: 'ico',
    };
  }

  // Cover crop and fill target rectangle
  function drawCoverRect(c, img, targetWidth, targetHeight) {
    const targetRatio = targetWidth / targetHeight;
    const sourceRatio = img.naturalWidth / img.naturalHeight;
    let sx, sy, sWidth, sHeight;

    if (sourceRatio > targetRatio) {
      sHeight = img.naturalHeight;
      sWidth = sHeight * targetRatio;
      sx = (img.naturalWidth - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = img.naturalWidth;
      sHeight = sWidth / targetRatio;
      sx = 0;
      sy = (img.naturalHeight - sHeight) / 2;
    }

    c.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
  }

  // Draw image as square: cover crop or contain scale with transparent padding
  function drawSquareImage(c, img, size, mode) {
    const ratio = img.naturalWidth / img.naturalHeight;

    if (mode === 'contain') {
      let dw, dh;
      if (ratio > 1) {
        dw = size;
        dh = size / ratio;
      } else {
        dh = size;
        dw = size * ratio;
      }
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;
      c.clearRect(0, 0, size, size);
      c.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, dw, dh);
      return;
    }

    // Cover: center crop
    let sx, sy, sWidth, sHeight;
    if (ratio > 1) {
      sHeight = img.naturalHeight;
      sWidth = sHeight;
      sx = (img.naturalWidth - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = img.naturalWidth;
      sHeight = sWidth;
      sx = 0;
      sy = (img.naturalHeight - sHeight) / 2;
    }

    c.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);
  }

  function calculateDimensions(originalWidth, originalHeight) {
    const mode = state.resizeMode;
    const w = state.width;
    const h = state.height;

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
      if (state.customFit === 'cover') {
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
      ? `<img class="file__thumb" src="${item.blobUrl}" alt="" loading="lazy" decoding="async">`
      : `<div class="file__thumb-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15 L16 10 L10 16 L7 13 L3 17"/></svg></div>`;

    const statusClass = isError ? 'file__status--error' : isReady ? 'file__status--ready' : 'file__status--converting';
    const statusHtml = isConverting
      ? `<span class="file__status ${statusClass}">Converting</span><span class="progress-bar" aria-hidden="true"><span class="progress-bar__fill"></span></span>`
      : `<span class="file__status ${statusClass}">${isError ? 'Failed' : isReady ? 'Done' : 'Pending'}</span>`;

    const reduction = isReady
      ? `, saved ${Math.max(0, 100 - Math.round((item.result.blob.size / item.file.size) * 100))}%`
      : '';

    let meta = `${formatBytes(item.file.size)}`;
    if (isReady) {
      if (item.result.format === 'ico' && item.result.icoSizes) {
        const sizesText = item.result.icoSizes.join(', ') + ' px';
        meta = `ICO (${sizesText}) \u00b7 ${formatBytes(item.result.blob.size)}${reduction}`;
      } else {
        meta = `${item.result.width}\u00d7${item.result.height} \u00b7 ${formatBytes(item.result.blob.size)}${reduction}`;
      }
    }

    el.innerHTML = `
      ${thumbHtml}
      <div class="file__info">
        <h3 class="file__name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</h3>
        <p class="file__meta">${meta}</p>
        ${statusHtml}
      </div>
      <div class="file__actions">
        ${
          isReady
            ? `<button class="btn btn--primary btn--sm" type="button" data-action="download" data-id="${item.id}">Download</button>`
            : ''
        }
        <button class="btn btn--secondary btn--sm" type="button" data-action="remove" data-id="${item.id}">Remove</button>
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
  }

  function downloadItem(item) {
    if (!item.result) return;
    const name = `${getBaseName(item.file.name)}.${FORMAT_EXTENSIONS[item.result.format]}`;
    saveAs(item.result.blob, name);
  }

  function removeItem(itemId) {
    const item = state.files.find((f) => f.id === itemId);
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
    const readyCount = state.files.filter((f) => f.status === 'ready').length;
    fileCount.textContent = `${count} images \u00b7 ${readyCount}/${count} done`;
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
})();
