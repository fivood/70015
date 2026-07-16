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

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

  async function handleImageFiles(files) {
    const validFiles = Array.from(files).filter(f => {
      if (!f.type.startsWith('image/')) return false;
      if (f.size > MAX_FILE_SIZE) {
        showToast(tpl('conv_too_large', '{name} is too large (max 50 MB)', { name: f.name }));
        return false;
      }
      return true;
    });
    if (!validFiles.length) {
      showToast(t('conv_select_images', 'Please select image files'));
      return;
    }

    for (const file of validFiles) {
      try {
        const dataUrl = await fileToBase64(file);
        const output = getPrefix() ? dataUrl : stripPrefix(dataUrl);
        addBase64Item(file, output);
      } catch (err) {
        showToast(tpl('b64_read_fail', 'Failed to read {name}', { name: file.name }));
      }
    }
  }

  function addBase64Item(file, base64) {
    const item = document.createElement('div');
    item.className = 'file';

    const url = URL.createObjectURL(file);
    const byteSize = new Blob([base64]).size;
    const sizeText = formatBytes(byteSize);

    item.innerHTML = `
      <img class="file__thumb" src="${url}" alt="" loading="lazy" decoding="async">
      <div class="file__info">
        <p class="file__name">${escapeHtml(file.name)}</p>
        <p class="file__meta">${t('b64_len', 'Base64 length')}: ${base64.length.toLocaleString()} \u00b7 ~${sizeText}</p>
      </div>
      <div class="file__actions">
        <button class="btn btn--primary btn--sm" type="button" data-copy>${t('b64_copy', 'Copy')}</button>
        <button class="btn btn--secondary btn--sm" type="button" data-download>${t('b64_dl_txt', 'Download .txt')}</button>
        <button class="btn btn--secondary btn--sm" type="button" data-remove title="${t('b64_remove_title', 'Remove')}">${t('b64_remove', 'Remove')}</button>
      </div>
    `;

    const copyBtn = item.querySelector('[data-copy]');
    const downloadBtn = item.querySelector('[data-download]');
    const removeBtn = item.querySelector('[data-remove]');

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(base64);
        showToast(t('b64_copied_clipboard', 'Copied to clipboard'));
      } catch (e) {
        showToast(t('toast_copy_fail', 'Copy failed'));
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

    removeBtn.addEventListener('click', () => {
      URL.revokeObjectURL(url);
      item.remove();
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
      b64Hint.textContent = t('b64_preview_hint', 'Preview updates automatically.');
      return;
    }

    previewImg.onload = () => {
      imgPreview.hidden = false;
      previewSize.textContent = `${previewImg.naturalWidth} \u00d7 ${previewImg.naturalHeight} px`;
      b64Hint.textContent = t('b64_parsed', 'Parsed. Click the button to download the image.');
    };

    previewImg.onerror = () => {
      imgPreview.hidden = true;
      b64Hint.textContent = t('b64_parse_fail', 'Could not parse this Base64 content.');
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
