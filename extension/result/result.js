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
    name: function () { return baseName; },
    add: ['palette', 'beads']
  });

  // ---------- QR codes in the screenshot ----------
  // Decoded locally in a worker (qr-scan.js). Nothing is opened or fetched on its own: a link
  // gets an Open button after the checks in js/qr-link.js, programs need a second click, and
  // script / local-file schemes are only shown.

  var qrPanel = document.getElementById('qrPanel');
  var qrList = document.getElementById('qrList');
  var qrTitle = document.getElementById('qrTitle');
  var stage = document.getElementById('stage');
  var qrCount = 0;

  function tpl(key, vars) {
    var text = t(key);
    Object.keys(vars || {}).forEach(function (k) { text = text.split('{' + k + '}').join(vars[k]); });
    return text;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text; // decoded content is always text, never markup
    return n;
  }

  function addCode(data, box) {
    var n = ++qrCount, info = QrLink.check(data);
    // Numbered outline on the screenshot (percent units follow the preview's scaling).
    var mark = el('div', 'result__qr-mark');
    mark.style.left = box.x / canvas.width * 100 + '%';
    mark.style.top = box.y / canvas.height * 100 + '%';
    mark.style.width = box.w / canvas.width * 100 + '%';
    mark.style.height = box.h / canvas.height * 100 + '%';
    mark.appendChild(el('span', 'result__qr-num', String(n)));
    stage.appendChild(mark);

    var card = el('article', 'qr-item' + (info.kind === 'blocked' || info.confirm ? ' is-risky' : ''));
    var head = el('div', 'qr-item__head');
    head.appendChild(el('span', 'result__qr-num', String(n)));
    var type = info.kind === 'blocked' ? 'ext_qr_kind_blocked' : info.kind === 'text' ? 'ext_qr_kind_text' : info.file ? 'ext_qr_kind_file' : 'ext_qr_kind_link';
    head.appendChild(el('span', 'qr-item__type', t(type)));
    var locate = el('button', 'qr-item__locate', t('ext_qr_locate'));
    locate.type = 'button';
    locate.addEventListener('click', function () {
      mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
      mark.classList.remove('is-flash');
      void mark.offsetWidth;
      mark.classList.add('is-flash');
    });
    head.appendChild(locate);
    card.appendChild(head);

    if (info.kind === 'link') {
      var site = el('p', 'qr-item__site', t('ext_qr_site') + ' ');
      site.appendChild(el('strong', null, info.host));
      card.appendChild(site);
    }
    card.appendChild(el('code', 'qr-item__text', info.url || info.text));
    if (info.file) card.appendChild(el('p', 'qr-item__file', tpl('ext_qr_file', { name: info.file })));
    if (info.kind === 'blocked') card.appendChild(el('p', 'qr-item__warn', tpl('ext_qr_blocked', { scheme: info.scheme })));
    info.warnings.forEach(function (w) {
      card.appendChild(el('p', 'qr-item__warn', tpl('ext_qr_w_' + w.code, w.vars)));
    });

    var actions = el('div', 'qr-item__actions');
    if (info.kind === 'link') {
      var open = el('button', 'btn ' + (info.confirm ? 'btn--danger' : 'btn--primary'), t(info.file ? 'ext_qr_open_file' : 'ext_qr_open'));
      open.type = 'button';
      open.addEventListener('click', function () {
        if (info.confirm && !open.dataset.armed) { // programs and installers: a second, deliberate click
          open.dataset.armed = '1';
          open.textContent = t('ext_qr_open_confirm');
          return;
        }
        window.open(info.url, '_blank', 'noopener,noreferrer');
      });
      actions.appendChild(open);
    }
    var copyBtn = el('button', 'btn', t('ext_qr_copy'));
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(info.url || info.text).then(function () {
        copyBtn.textContent = t('ext_qr_copied');
        setTimeout(function () { copyBtn.textContent = t('ext_qr_copy'); }, 1500);
      });
    });
    actions.appendChild(copyBtn);
    card.appendChild(actions);

    qrList.appendChild(card);
    qrTitle.textContent = tpl('ext_qr_title', { n: qrCount });
    qrPanel.hidden = false;
  }

  function scanQr() {
    if (typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function' || !window.QrLink) return;
    createImageBitmap(canvas).then(function (bmp) {
      var worker = new Worker('qr-scan.js');
      worker.onmessage = function (e) {
        if (e.data.type === 'found') addCode(e.data.data, e.data.box);
        else worker.terminate();
      };
      worker.onerror = function () { worker.terminate(); };
      worker.postMessage({ bitmap: bmp }, [bmp]);
    }).catch(function () { /* too large to copy: skip the scan */ });
  }

  compose().then(function () {
    if (!preview.hidden) scanQr();
  }).catch(function (err) {
    console.error(err);
    setStatus(t('ext_capture_failed'));
  });
})();
