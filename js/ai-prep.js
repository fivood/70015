/**
 * Web Toolbox — AI Image Prep
 * Paste an image, get a resized, metadata-free PNG straight back on the clipboard.
 */
(function () {
  'use strict';

  function t(key, fallback) {
    var v = typeof window.t === 'function' ? window.t(key) : key;
    return v && v !== key ? v : fallback;
  }
  function showToast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    setTimeout(function () { el.classList.remove('is-visible'); }, 2200);
  }

  var drop = document.getElementById('aipDrop');
  var input = document.getElementById('aipInput');
  var sizeSelector = document.getElementById('aipSize');
  var result = document.getElementById('aipResult');
  var status = document.getElementById('aipStatus');
  var media = document.getElementById('aipMedia');

  var maxSide = 1568;
  var source = null; // { img, bytes, name }
  var out = null;    // processed canvas
  var outBytes = 0;
  var version = 0;

  function formatBytes(n) {
    return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  // Claude's published estimate; the model scales anything over 1568 px down first.
  function claudeTokens(w, h) {
    var s = Math.min(1, 1568 / Math.max(w, h));
    return Math.ceil(Math.round(w * s) * Math.round(h * s) / 750);
  }

  function decode(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  // Redrawing onto a canvas is what drops EXIF/location: only pixels survive.
  function render() {
    var w0 = source.img.naturalWidth, h0 = source.img.naturalHeight;
    var s = maxSide ? Math.min(1, maxSide / Math.max(w0, h0)) : 1;
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w0 * s));
    c.height = Math.max(1, Math.round(h0 * s));
    var cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(source.img, 0, 0, c.width, c.height);
    out = c;
    media.replaceChildren(c);
    document.getElementById('aipDims').textContent = w0 + ' × ' + h0 + (s < 1 ? ' → ' + c.width + ' × ' + c.height : '');
    document.getElementById('aipTokens').textContent = '≈ ' + claudeTokens(c.width, c.height).toLocaleString();
    result.hidden = false;
    document.body.classList.add('is-working');
    return c;
  }

  function showBytes() {
    document.getElementById('aipBytes').textContent = formatBytes(source.bytes) + ' → ' + formatBytes(outBytes) + ' PNG';
  }

  function setStatus(kind, text) {
    status.className = 'aip-status aip-status--' + kind;
    status.textContent = text;
  }

  // Must be called synchronously inside a user gesture (paste, click): the clipboard write
  // starts now with a promise for the PNG, so the gesture still counts when it resolves.
  // `ready` resolves to a newly loaded source, or nothing to re-render the current one.
  function processAndCopy(ready) {
    var v = ++version;
    setStatus('working', t('aip_working', 'Processing…'));
    var png = ready.then(function (loaded) {
      if (v !== version) throw new Error('superseded');
      if (loaded) source = loaded;
      return ImageExport.toBlob(render(), 'image/png');
    }).then(function (blob) {
      outBytes = blob.size;
      showBytes();
      return blob;
    });
    var write = navigator.clipboard && window.ClipboardItem
      ? navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      : Promise.reject(new Error('unsupported'));
    Promise.all([png, write]).then(function () {
      if (v === version) setStatus('ok', t('aip_copied', 'Copied. Paste it into the AI chat with Ctrl+V (⌘V).'));
    }, function () {
      if (v !== version) return;
      png.then(function () {
        setStatus('warn', t('aip_copy_failed', 'Ready, but the browser did not allow copying automatically. Use Copy below.'));
      }, function () {
        setStatus('warn', t('aip_load_fail', 'Could not read this image.'));
      });
    });
  }

  function load(file) {
    if (!file || !file.type.startsWith('image/')) { showToast(t('aip_no_image', 'No image on the clipboard')); return null; }
    return decode(file).then(function (img) {
      // Clipboard images arrive named image.png; give those a neutral name.
      return { img: img, bytes: file.size, name: file.name && file.name !== 'image.png' ? file.name.replace(/\.[^.]+$/, '') : 'ai-ready' };
    });
  }

  // Paste: the only entry point where the browser lets us write the clipboard back on its own.
  window.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        var ready = load(items[i].getAsFile());
        if (ready) processAndCopy(ready);
        return;
      }
    }
    showToast(t('aip_no_image', 'No image on the clipboard'));
  });

  // Drop / file picker carry no clipboard permission: process, then offer the Copy button.
  function loadWithoutCopy(file) {
    var ready = load(file);
    if (!ready) return;
    var v = ++version;
    setStatus('working', t('aip_working', 'Processing…'));
    ready.then(function (loaded) {
      if (v !== version) throw new Error('superseded');
      source = loaded;
      return ImageExport.toBlob(render(), 'image/png');
    }).then(function (blob) {
      outBytes = blob.size;
      showBytes();
      setStatus('warn', t('aip_copy_manual', 'Ready. Use Copy below, then paste into the AI chat.'));
    }, function () { if (v === version) setStatus('warn', t('aip_load_fail', 'Could not read this image.')); });
  }

  input.addEventListener('change', function (e) { loadWithoutCopy(e.target.files[0]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (evt) {
    drop.addEventListener(evt, function (e) { e.preventDefault(); drop.classList.add('is-dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    drop.addEventListener(evt, function (e) { e.preventDefault(); drop.classList.remove('is-dragover'); });
  });
  drop.addEventListener('drop', function (e) { loadWithoutCopy(e.dataTransfer.files[0]); });

  // Changing the size is a click, so the clipboard can follow along.
  sizeSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-value]');
    if (!btn) return;
    [].forEach.call(sizeSelector.querySelectorAll('.segmented__btn'), function (b) { b.classList.toggle('is-active', b === btn); });
    maxSide = parseInt(btn.dataset.value, 10);
    if (source) processAndCopy(Promise.resolve());
  });

  ImageExport.mountActions(document.getElementById('aipActions'), function () { return out; }, {
    name: function () { return source ? source.name : 'ai-ready'; },
    skip: ['pdf', 'print']
  });
})();
