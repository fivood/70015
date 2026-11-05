/**
 * Web Toolbox — Favicon Generator
 * One image or SVG -> favicon.ico, PNG icon sizes, and a web manifest (rendering in js/icon.js).
 */
(function () {
  'use strict';

  function t(key) { return (typeof window.t === 'function') ? window.t(key) : key; }
  function showToast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    setTimeout(function () { el.classList.remove('is-visible'); }, 2200);
  }

  var drop = document.getElementById('favDrop');
  var input = document.getElementById('favInput');
  var fitSelector = document.getElementById('favFitSelector');
  var result = document.getElementById('favResult');
  var previews = document.getElementById('favPreviews');
  var icoInfo = document.getElementById('favIcoInfo');
  var zipInfo = document.getElementById('favZipInfo');
  var sizeChips = document.getElementById('favIcoSizes');

  var img = null, baseName = 'favicon', fit = 'contain', focus = null, files = [], version = 0, previewUrls = [];

  function icoSizes() {
    return [].map.call(sizeChips.querySelectorAll('input:checked'), function (c) { return parseInt(c.value, 10); });
  }

  function kb(n) { return (n / 1024).toFixed(1) + ' KB'; }

  // Cover only: where the square icon is cut from the image.
  var cropGroup = document.getElementById('favCropGroup');
  var picker = IconKit.createCoverPicker(document.getElementById('favCropCanvas'), function (f) { focus = f; build(); });

  function syncPicker() {
    cropGroup.hidden = !(img && fit === 'cover' && picker.show(img, IconKit.getVisibleImageBounds(img), 1, focus));
  }

  document.getElementById('favCropReset').addEventListener('click', function () {
    focus = null;
    picker.setFocus(null);
    build();
  });

  function load(file) {
    if (!file || !(file.type.startsWith('image/') || /\.svg$/i.test(file.name))) { showToast(t('sz_need_image')); return; }
    baseName = file.name.replace(/\.[^/.]+$/, '') || 'favicon';
    IconKit.loadImageFromFile(file).then(function (image) { img = image; focus = null; syncPicker(); build(); }, function () { showToast(t('sz_load_fail')); });
  }

  function build() {
    if (!img) return;
    var v = ++version;
    IconKit.buildFaviconFiles(img, fit, focus, icoSizes()).then(function (out) {
      if (v !== version) return;
      files = out;
      render();
    }, function () { showToast(t('sz_export_fail')); });
  }

  function render() {
    previewUrls.forEach(URL.revokeObjectURL);
    previewUrls = [];
    previews.innerHTML = files.filter(function (f) { return /\.png$/.test(f.name); }).map(function (f) {
      var url = URL.createObjectURL(f.blob);
      previewUrls.push(url);
      var size = f.name.match(/(\d+)x\d+|apple-touch-icon/);
      var px = size[1] || '180';
      return '<figure class="fav-preview"><div class="fav-preview__box"><img src="' + url + '" width="' + Math.min(px, 96) + '" height="' + Math.min(px, 96) + '" alt=""></div>' +
        '<figcaption>' + f.name + '</figcaption></figure>';
    }).join('');
    var total = files.reduce(function (s, f) { return s + f.blob.size; }, 0);
    icoInfo.textContent = icoSizes().join(', ') + ' px · ' + kb(files[0].blob.size);
    zipInfo.textContent = files.length + ' ' + t('fav_files') + ' · ' + kb(total);
    result.hidden = false;
  }

  input.addEventListener('change', function (e) { load(e.target.files[0]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (evt) {
    drop.addEventListener(evt, function (e) { e.preventDefault(); drop.classList.add('is-dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    drop.addEventListener(evt, function (e) { e.preventDefault(); drop.classList.remove('is-dragover'); });
  });
  drop.addEventListener('drop', function (e) { load(e.dataTransfer.files[0]); });
  window.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) { load(items[i].getAsFile()); e.preventDefault(); return; }
    }
  });

  fitSelector.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-value]');
    if (!btn) return;
    [].forEach.call(fitSelector.querySelectorAll('.segmented__btn'), function (b) { b.classList.toggle('is-active', b === btn); });
    fit = btn.dataset.value;
    syncPicker();
    build();
  });

  sizeChips.addEventListener('change', function (e) {
    if (!icoSizes().length) {
      e.target.checked = true;
      showToast(t('conv_select_ico'));
      return;
    }
    build();
  });

  document.getElementById('favIcoBtn').addEventListener('click', function () {
    if (files.length) saveAs(files[0].blob, 'favicon.ico');
  });
  document.getElementById('favZipBtn').addEventListener('click', function () {
    if (!files.length) return;
    var zip = new JSZip();
    files.forEach(function (f) { zip.file(f.name, f.blob); });
    zip.generateAsync({ type: 'blob' }).then(function (blob) {
      saveAs(blob, baseName + '-favicon.zip');
      showToast(t('toast_exported'));
    }, function () { showToast(t('conv_zip_failed')); });
  });
})();
