/**
 * Web Toolbox — Image Converter
 * 纯前端图片格式转换器
 * 参考实现：HTML5 Canvas API + JSZip + FileSaver
 */

(function () {
  'use strict';

  // DOM 元素
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const formatSelector = document.getElementById('formatSelector');
  const formatNote = document.getElementById('formatNote');
  const qualityInput = document.getElementById('quality');
  const qualityValue = document.getElementById('qualityValue');
  const resizeModeSelector = document.getElementById('resizeModeSelector');
  const dimensionsPanel = document.getElementById('dimensionsPanel');
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
  };

  const FORMAT_NOTES = {
    webp: 'WebP 兼容性最好（~95%），体积通常比 JPEG 小 25%–35%。',
    avif: 'AVIF 压缩率最高，但 Safari 16+ / Firefox 93+ / Chrome 85+ 才支持导出；不支持的浏览器会自动降级为 WebP。',
    jpeg: 'JPEG 通用性最强，适合照片；不支持透明背景，透明区域会变成白色。',
    png: 'PNG 是无损格式，保留透明通道，但体积通常较大。',
  };

  const FORMAT_MIMES = {
    webp: 'image/webp',
    avif: 'image/avif',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };

  const FORMAT_EXTENSIONS = {
    webp: 'webp',
    avif: 'avif',
    jpeg: 'jpg',
    png: 'png',
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

  function getExtension(filename) {
    const ext = filename.split('.').pop();
    return ext ? ext.toLowerCase() : '';
  }

  function getBaseName(filename) {
    return filename.replace(/\.[^/.]+$/, '');
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
      reconvertAll();
    });
  });

  // 质量滑块
  qualityInput.addEventListener('input', () => {
    state.quality = parseInt(qualityInput.value, 10) / 100;
    qualityValue.textContent = qualityInput.value;
  });

  qualityInput.addEventListener('change', () => {
    reconvertAll();
  });

  // 尺寸模式
  resizeModeSelector.querySelectorAll('.segmented__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      resizeModeSelector.querySelectorAll('.segmented__btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.resizeMode = btn.dataset.value;
      updateDimensionFields();
      reconvertAll();
    });
  });

  function updateDimensionFields() {
    const mode = state.resizeMode;
    dimensionsPanel.classList.toggle('is-hidden', mode === 'original');
    widthField.hidden = mode === 'original' || mode === 'height';
    heightField.hidden = mode === 'original' || mode === 'width';

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
    reconvertAll();
  });

  heightInput.addEventListener('change', () => {
    state.height = parseInt(heightInput.value, 10) || null;
    reconvertAll();
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
        const name = `${getBaseName(item.file.name)}.${FORMAT_EXTENSIONS[state.format]}`;
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
            const { width, height } = calculateDimensions(img.naturalWidth, img.naturalHeight);
            workCanvas.width = width;
            workCanvas.height = height;

            // 清空画布，避免 JPEG/PNG 出现透明残影
            ctx.clearRect(0, 0, width, height);
            if (format === 'jpeg') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
            }

            ctx.drawImage(img, 0, 0, width, height);

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
    const meta = isReady
      ? `${item.result.width}×${item.result.height} · ${formatBytes(item.result.blob.size)}${reduction}`
      : `${formatBytes(item.file.size)}`;

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
  updateDimensionFields();
})();
