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

  function msg(key) {
    return chrome.i18n.getMessage(key) || key;
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
    if (!stored || !stored.zimgCaptures) {
      setStatus(msg('failed'));
      return;
    }

    var data = stored.zimgCaptures;
    var captures = data.captures;
    var opts = data.opts;

    var images = [];
    for (var i = 0; i < captures.length; i++) {
      setStatus(msg('capturing') + ' ' + (i + 1) + '/' + captures.length);
      try {
        var img = await loadImage(captures[i].dataUrl);
        images.push(img);
      } catch (e) {
        console.error('Failed to load capture', i, e);
      }
    }

    if (!images.length) {
      setStatus(msg('failed'));
      return;
    }

    setStatus(msg('stitching'));

    var stitchOpts = {};
    if (opts.mode === 'region' && opts.region) {
      var r = opts.region;
      var dpr = opts.dpr || 1;
      var viewportPxX = r.x - Math.floor(r.x / r.viewW) * r.viewW;
      stitchOpts.cropX = Math.round(viewportPxX * dpr);
      stitchOpts.cropW = Math.round(r.w * dpr);
    }

    var result = ZimgStitch.stitchImages(images, stitchOpts);

    if (!result || !result.canvas) {
      setStatus(msg('failed'));
      return;
    }

    resultCanvas.width = result.canvas.width;
    resultCanvas.height = result.canvas.height;
    resultCanvas.getContext('2d').drawImage(result.canvas, 0, 0);

    var w = result.canvas.width;
    var h = result.canvas.height;
    info.textContent = w + ' × ' + h + ' px · ' + result.segments + ' segments';

    statusBar.hidden = true;
    preview.hidden = false;
    actions.hidden = false;

    chrome.storage.local.remove('zimgCaptures');
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
    try {
      var blob = await new Promise(function (resolve) {
        resultCanvas.toBlob(resolve, 'image/png');
      });
      if (blob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        copyBtn.querySelector('span').textContent = msg('copied');
        setTimeout(function () {
          copyBtn.querySelector('span').textContent = msg('copy_image');
        }, 2000);
      }
    } catch (e) {
      copyBtn.querySelector('span').textContent = msg('copy_fail');
    }
  });

  processCaptures();
})();
