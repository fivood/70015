/**
 * Web Toolbox — Image Converter
 * 纯前端图片格式转换器（支持 WebP / AVIF / JPEG / PNG / ICO）
 * 参考实现：HTML5 Canvas API + JSZip + FileSaver
 */

(function () {
  'use strict';

  // DOM 元素
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
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

  // 状态
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
    webp: 'WebP 兼容性最好（~95%），体积通常比 JPEG 小 25%–35%。',
    avif: 'AVIF 压缩率最高，但 Safari 16+ / Firefox 93+ / Chrome 85+ 才支持导出；不支持的浏览器会自动降级为 WebP。',
    jpeg: 'JPEG 通用性最强，适合照片；不支持透明背景，透明区域会变成白色。',
    png: 'PNG 是无损格式，保留透明通道，但体积通常较大。',
    ico: 'ICO 用于网站 favicon，支持多尺寸（PNG 编码）。非方形图片可选择居中裁剪或等比缩放。推荐同时包含 32×32 与 256×256。',
  };

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

  // 工具函数
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

  // 检测浏览器是否支持某种 canvas 输出格式
  async function isFormatSupported(mime) {
    try {
      const blob = await new Promise((resolve) => workCanvas.toBlob(resolve, mime));
      return !!blob;
    } catch {
      return false;
    }
  }

  // 事件绑定：上传
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('is-dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('is-dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('is-dragover');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = ''; // 允许重复选择同一文件
  });

  // 格式选择
  formatSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      formatSelector.querySelectorAll('.segmented__btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.format = btn.dataset.value;
      formatNote.textContent = FORMAT_NOTES[state.format];
      toggleIcoPanel();
      setActivePreset('custom');
      reconvertAll();
    });
  });

  function toggleIcoPanel() {
    icoSizePanel.hidden = state.format !== 'ico';
  }

  // 快速预设
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

    // 应用预设值
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
    // 格式
    formatSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.value === state.format);
    });
    formatNote.textContent = FORMAT_NOTES[state.format];
    toggleIcoPanel();

    // 尺寸模式
    resizeModeSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.value === state.resizeMode);
    });
    updateDimensionFields();

    // 宽高输入
    widthInput.value = state.width || '';
    heightInput.value = state.height || '';

    // 自定义适配
    customFitSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.value === state.customFit);
    });

    // ICO 尺寸
    icoSizeSelector.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = state.icoSizes.includes(parseInt(cb.value, 10));
    });

    // ICO 裁剪模式
    icoCropSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.value === state.icoCropMode);
    });

    // 质量
    qualityInput.value = Math.round(state.quality * 100);
    qualityValue.textContent = qualityInput.value;
  }

  // ICO 尺寸选择
  icoSizeSelector.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const selected = Array.from(icoSizeSelector.querySelectorAll('input:checked')).map((c) => parseInt(c.value, 10));
      if (selected.length === 0) {
        // 至少保留一个，默认 32
        cb.checked = true;
        state.icoSizes = [32];
        showToast('至少选择一个 ICO 尺寸');
      } else {
        state.icoSizes = selected;
      }
      setActivePreset('custom');
      reconvertAll();
    });
  });

  // ICO 非方形图片处理模式
  icoCropSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      icoCropSelector.querySelectorAll('.segmented__btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.icoCropMode = btn.dataset.value;
      setActivePreset('custom');
      reconvertAll();
    });
  });

  // 质量滑块
  qualityInput.addEventListener('input', () => {
    state.quality = parseInt(qualityInput.value, 10) / 100;
    qualityValue.textContent = qualityInput.value;
  });

  qualityInput.addEventListener('change', () => {
    setActivePreset('custom');
    reconvertAll();
  });

  // 尺寸模式
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
      widthField.querySelector('label').textContent = '目标宽度 px';
    } else if (mode === 'height') {
      heightField.querySelector('label').textContent = '目标高度 px';
    } else if (mode === 'max') {
      widthField.querySelector('label').textContent = '最大边 px';
    } else if (mode === 'custom') {
      widthField.querySelector('label').textContent = '宽度 px';
      heightField.querySelector('label').textContent = '高度 px';
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

  // 自定义尺寸适配方式
  customFitSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      customFitSelector.querySelectorAll('.segmented__btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.customFit = btn.dataset.value;
      setActivePreset('custom');
      reconvertAll();
    });
  });

  // 清空
  clearBtn.addEventListener('click', () => {
    state.files.forEach((item) => {
      if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    });
    state.files = [];
    render();
    showToast('已清空全部图片');
  });

  // 打包下载
  downloadAllBtn.addEventListener('click', async () => {
    const readyItems = state.files.filter((f) => f.status === 'ready' && f.result);
    if (readyItems.length === 0) {
      showToast('没有可下载的文件');
      return;
    }

    downloadAllBtn.disabled = true;
    const originalText = downloadAllBtn.innerHTML;
    downloadAllBtn.innerHTML = '<span>打包中…</span>';

    try {
      const zip = new JSZip();
      const folder = zip.folder('converted-images');
      readyItems.forEach((item) => {
        const name = `${getBaseName(item.file.name)}.${FORMAT_EXTENSIONS[item.result.format]}`;
        folder.file(name, item.result.blob);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `web-toolbox-images-${state.format}-${Date.now()}.zip`);
      showToast(`已打包 ${readyItems.length} 张图片`);
    } catch (err) {
      console.error(err);
      showToast('打包失败：' + err.message);
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.innerHTML = originalText;
    }
  });

  // 处理文件
  function handleFiles(fileListObj) {
    const accepted = Array.from(fileListObj).filter((file) => file.type.startsWith('image/'));
    if (accepted.length === 0) {
      showToast('请选择图片文件');
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
  }

  // 重新转换全部
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

  // 核心转换逻辑
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
        item.error = err.message || '转换失败';
      }
      renderItem(item);
    }

    updateActions();
  }

  function convertFile(file, format) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            if (format === 'ico') {
              resolve(convertToIco(img));
              return;
            }

            const { width, height } = calculateDimensions(img.naturalWidth, img.naturalHeight);
            workCanvas.width = width;
            workCanvas.height = height;

            ctx.clearRect(0, 0, width, height);
            if (format === 'jpeg') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
            }

            const isCustomCover = state.resizeMode === 'custom' && state.customFit === 'cover' && state.width && state.height;
            if (isCustomCover) {
              drawCoverRect(ctx, img, width, height);
            } else {
              ctx.drawImage(img, 0, 0, width, height);
            }

            const mime = FORMAT_MIMES[format];
            const quality = format === 'png' ? undefined : state.quality;

            workCanvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('浏览器不支持输出该格式'));
                  return;
                }
                resolve({
                  blob,
                  width,
                  height,
                  originalWidth: img.naturalWidth,
                  originalHeight: img.naturalHeight,
                  format,
                });
              },
              mime,
              quality
            );
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('无法读取图片'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  // ICO 生成：PNG 编码的多尺寸图标（Vista+ 兼容）
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
      if (!blob) throw new Error('无法生成 ICO 所需的 PNG 数据');
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

  // 居中裁剪并填满目标矩形（cover）
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

  // 把图片绘制成正方形：cover 居中裁剪 / contain 等比缩放透明填充
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

    // cover 模式：居中裁剪
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
        // 按目标尺寸居中裁剪并填满
        return { width: w, height: h };
      }
      // 按用户给的宽高进行 contain 缩放，保持比例
      const targetRatio = w / h;
      if (ratio > targetRatio) {
        return { width: w, height: Math.round(w / ratio) };
      }
      return { width: Math.round(h * ratio), height: h };
    }

    return { width: originalWidth, height: originalHeight };
  }

  // 渲染
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

    const thumbSrc = item.blobUrl || '';
    const statusClass = isError ? 'file__status--error' : 'file__status--ready';
    const statusText = isConverting ? '转换中…' : isError ? '失败' : isReady ? '完成' : '待处理';

    const reduction = isReady
      ? `，节省 ${Math.max(0, 100 - Math.round((item.result.blob.size / item.file.size) * 100))}%`
      : '';

    let meta = `${formatBytes(item.file.size)}`;
    if (isReady) {
      if (item.result.format === 'ico' && item.result.icoSizes) {
        const sizesText = item.result.icoSizes.join('、') + ' px';
        meta = `ICO（${sizesText}） · ${formatBytes(item.result.blob.size)}${reduction}`;
      } else {
        meta = `${item.result.width}×${item.result.height} · ${formatBytes(item.result.blob.size)}${reduction}`;
      }
    }

    el.innerHTML = `
      <img class="file__thumb" src="${thumbSrc}" alt="" loading="lazy">
      <div class="file__info">
        <h3 class="file__name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</h3>
        <p class="file__meta">${meta}</p>
        <span class="file__status ${statusClass}">${statusText}</span>
      </div>
      <div class="file__actions">
        ${
          isReady
            ? `<button class="btn btn--primary btn--sm" type="button" data-action="download" data-id="${item.id}">下载</button>`
            : ''
        }
        <button class="btn btn--secondary btn--sm" type="button" data-action="remove" data-id="${item.id}">移除</button>
      </div>
    `;

    // 绑定事件
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
    fileCount.textContent = `${count} 张图片`;
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

  // 初始化
  updateUI();
})();
