(function () {
  'use strict';

  var preview = document.getElementById('preview');
  var canvas = document.getElementById('resultCanvas');
  var actions = document.getElementById('actions');
  var statusBar = document.getElementById('statusBar');
  var statusText = document.getElementById('statusText');
  var info = document.getElementById('info');

  var baseName = 'screenshot';

  // Same strings and language setting as the tool pages (js/i18n.js).
  function t(key) { return typeof window.t === 'function' ? window.t(key) : key; }

  document.title = t('ext_result_title');

  function setStatus(text) {
    statusBar.hidden = false;
    statusText.textContent = text;
  }

  async function compose() {
    setStatus(t('ext_stitching'));
    var data = await ImageExport.take('capture');
    if (!data || !data.captures || !data.captures.length) {
      setStatus(t('ext_capture_failed'));
      return;
    }
    if (data.title) baseName = data.title;

    var R = data.R, C = data.clip, n = data.captures.length;
    var ctx = canvas.getContext('2d');
    var s = 0;
    // Decode one shot at a time (createImageBitmap decodes off the main thread)
    // and free it right away, so memory holds one screen plus the output.
    for (var i = 0; i < n; i++) {
      setStatus(t('ext_stitching') + ' ' + (i + 1) + ' / ' + n);
      var cap = data.captures[i];
      var bmp = await createImageBitmap(cap.blob);
      if (!s) {
        // Screenshot pixels per CSS pixel (covers devicePixelRatio and page zoom).
        s = bmp.width / data.viewW;
        canvas.width = Math.max(1, Math.round(R.w * s));
        canvas.height = Math.max(1, Math.round(R.h * s));
      }
      // Place the shot's clip at its content position; later shots cover any overlap.
      ctx.drawImage(bmp,
        Math.round(C.x * s), Math.round(C.y * s), Math.round(C.w * s), Math.round(C.h * s),
        Math.round((cap.x - R.x) * s), Math.round((cap.y - R.y) * s), Math.round(C.w * s), Math.round(C.h * s));
      bmp.close();
    }

    var text = t('ext_result_info').replace('{w}', canvas.width).replace('{h}', canvas.height).replace('{count}', n);
    if (data.truncated) text += ' · ' + t('ext_truncated');
    info.textContent = text;
    statusBar.hidden = true;
    preview.hidden = false;
    actions.hidden = false;
  }

  // Same PNG/JPG/PDF/copy/print/annotate buttons as the tool pages (js/export.js).
  ImageExport.mountActions(actions, function () { return canvas.width > 1 ? canvas : null; }, {
    name: function () { return baseName; }
  });

  compose().catch(function (err) {
    console.error(err);
    setStatus(t('ext_capture_failed'));
  });
})();
