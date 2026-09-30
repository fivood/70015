(function () {
  'use strict';

  var preview = document.getElementById('preview');
  var resultCanvas = document.getElementById('resultCanvas');
  var actions = document.getElementById('actions');
  var statusBar = document.getElementById('statusBar');
  var statusText = document.getElementById('statusText');
  var info = document.getElementById('info');
  var downloadBtn = document.getElementById('downloadBtn');
  var copyBtn = document.getElementById('copyBtn');

  var MAX_SIDE = 32767;

  function msg(key, subs) {
    return chrome.i18n.getMessage(key, subs) || key;
  }

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    var text = msg(key);
    if (text) el.textContent = text;
  });

  document.title = msg('result_title');

  function setStatus(text) {
    statusText.textContent = text;
  }

  function loadImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  async function processCaptures() {
    setStatus(msg('stitching'));
    var stored = await chrome.storage.local.get('zimgCaptures');
    var data = stored && stored.zimgCaptures;
    if (!data || !data.captures || !data.captures.length) {
      setStatus(msg('failed'));
      return;
    }
    chrome.storage.local.remove('zimgCaptures');

    var images = [];
    for (var i = 0; i < data.captures.length; i++) {
      images.push(await loadImage(data.captures[i].dataUrl));
    }

    // Screenshot pixels per CSS pixel (covers devicePixelRatio and page zoom).
    var scale = images[0].naturalWidth / data.viewW;
    var ctx = resultCanvas.getContext('2d');

    if (data.mode === 'region') {
      var c = data.crop;
      resultCanvas.width = Math.max(1, Math.round(c.w * scale));
      resultCanvas.height = Math.max(1, Math.round(c.h * scale));
      ctx.drawImage(images[0], Math.round(c.x * scale), Math.round(c.y * scale), resultCanvas.width, resultCanvas.height,
        0, 0, resultCanvas.width, resultCanvas.height);
    } else {
      resultCanvas.width = images[0].naturalWidth;
      resultCanvas.height = Math.min(MAX_SIDE, Math.round(data.height * scale));
      // Each shot is drawn at its real scroll offset; later shots cover the overlap.
      images.forEach(function (img, idx) {
        ctx.drawImage(img, 0, Math.round(data.captures[idx].y * scale));
      });
    }

    var text = msg('result_info', [String(resultCanvas.width), String(resultCanvas.height), String(images.length)]);
    if (data.truncated) text += ' · ' + msg('truncated');
    info.textContent = text;

    statusBar.hidden = true;
    preview.hidden = false;
    actions.hidden = false;
  }

  downloadBtn.addEventListener('click', function () {
    resultCanvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'long-screenshot-' + Date.now() + '.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }, 'image/png');
  });

  copyBtn.addEventListener('click', async function () {
    var label = copyBtn.querySelector('span');
    try {
      var blob = await new Promise(function (resolve) { resultCanvas.toBlob(resolve, 'image/png'); });
      if (!blob || !navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard unavailable');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      label.textContent = msg('copied');
    } catch (e) {
      label.textContent = msg('copy_fail');
    }
    setTimeout(function () { label.textContent = msg('copy_image'); }, 2000);
  });

  processCaptures().catch(function (err) {
    console.error(err);
    setStatus(msg('failed'));
  });
})();
