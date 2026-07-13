(function () {
  'use strict';

  const imgInput = document.getElementById('imgInput');
  const imgUpload = document.getElementById('imgUpload');
  const prefixToggle = document.getElementById('prefixToggle');
  const base64List = document.getElementById('base64List');
  const base64Input = document.getElementById('base64Input');
  const imgPreview = document.getElementById('imgPreview');
  const previewImg = document.getElementById('previewImg');
  const previewSize = document.getElementById('previewSize');
  const downloadImgBtn = document.getElementById('downloadImgBtn');
  const b64Hint = document.getElementById('b64Hint');
  const toast = document.getElementById('toast');

  let previewObjectUrl = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function getPrefix() {
    const checkbox = prefixToggle.querySelector('input[type="checkbox"]');
    return checkbox ? checkbox.checked : true;
  }

  function stripPrefix(dataUrl) {
    return dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
  }

  async function handleImageFiles(files) {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!validFiles.length) {
      showToast('请选择图片文件');
      return;
    }

    for (const file of validFiles) {
      try {
        const dataUrl = await fileToBase64(file);
        const output = getPrefix() ? dataUrl : stripPrefix(dataUrl);
        addBase64Item(file, output);
      } catch (err) {
        showToast(file.name + ' 读取失败');
      }
    }
  }

  function addBase64Item(file, base64) {
    const item = document.createElement('div');
    item.className = 'file';

    const url = URL.createObjectURL(file);
    const sizeText = formatBytes(base64.length);

    item.innerHTML = `
      <img class="file__thumb" src="${url}" alt="" loading="lazy">
      <div class="file__info">
        <p class="file__name">${escapeHtml(file.name)}</p>
        <p class="file__meta">Base64 长度：${base64.length.toLocaleString()} · 约 ${sizeText}</p>
      </div>
      <div class="file__actions">
        <button class="btn btn--primary btn--sm" type="button" data-copy>复制</button>
        <button class="btn btn--secondary btn--sm" type="button" data-download>下载 .txt</button>
      </div>
    `;

    const copyBtn = item.querySelector('[data-copy]');
    const downloadBtn = item.querySelector('[data-download]');

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(base64);
        showToast('已复制到剪贴板');
      } catch (e) {
        showToast('复制失败，请手动复制');
      }
    });

    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([base64], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name.replace(/\.[^/.]+$/, '') + '.txt';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    base64List.appendChild(item);
    base64List.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Drag & drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    imgUpload.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ['dragenter', 'dragover'].forEach(evt => {
    imgUpload.addEventListener(evt, () => imgUpload.classList.add('is-dragover'));
  });

  ['dragleave', 'drop'].forEach(evt => {
    imgUpload.addEventListener(evt, () => imgUpload.classList.remove('is-dragover'));
  });

  imgUpload.addEventListener('drop', (e) => {
    handleImageFiles(e.dataTransfer.files);
  });

  imgInput.addEventListener('change', (e) => {
    handleImageFiles(e.target.files);
    imgInput.value = '';
  });

  // Base64 to image
  function parseBase64Input(value) {
    let raw = value.trim();
    if (!raw) return null;
    if (!raw.startsWith('data:')) {
      raw = 'data:image/png;base64,' + raw;
    }
    return raw;
  }

  function updatePreview() {
    const value = base64Input.value;
    const dataUrl = parseBase64Input(value);

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }

    if (!dataUrl) {
      imgPreview.hidden = true;
      b64Hint.textContent = '输入后会自动解析并预览。';
      return;
    }

    previewImg.onload = () => {
      imgPreview.hidden = false;
      previewSize.textContent = `${previewImg.naturalWidth} × ${previewImg.naturalHeight} px`;
      b64Hint.textContent = '解析成功，点击下方按钮下载原图。';
    };

    previewImg.onerror = () => {
      imgPreview.hidden = true;
      b64Hint.textContent = '无法解析该 Base64 内容，请检查格式。';
    };

    previewImg.src = dataUrl;
  }

  base64Input.addEventListener('input', debounce(updatePreview, 300));

  downloadImgBtn.addEventListener('click', () => {
    const dataUrl = parseBase64Input(base64Input.value);
    if (!dataUrl) return;

    const a = document.createElement('a');
    a.href = dataUrl;

    // Try to infer extension
    const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
    const ext = match && match[1] ? match[1].replace('jpeg', 'jpg') : 'png';
    a.download = 'base64-image.' + ext;
    a.click();
  });

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }
})();
