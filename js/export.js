// Shared image export for tool pages and the extension: file naming, PNG/JPG/PDF
// download, clipboard, print, and handing an image to the annotate tool.
// PDF needs js/pdf.js loaded on the page. The extension service worker also imports
// this file, so nothing at the top level may touch window/document.
(function () {
  'use strict';

  var HANDOFF_DB = '70015-handoff';
  var HANDOFF_KEY = 'annotate';
  var isExtension = /-extension:$/.test(location.protocol); // chrome-extension: / moz-extension:

  function tr(key, fallback) {
    var v = typeof window.t === 'function' ? window.t(key) : key;
    return v && v !== key ? v : fallback;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function fileName(base, ext) {
    var d = new Date();
    var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    var clean = String(base || 'image').replace(/[\\/:*?"<>|\s]+/g, ' ').trim().slice(0, 80) || 'image';
    return clean + '-' + stamp + '.' + ext;
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function toBlob(canvas, type, quality) {
    var source = canvas;
    if (type === 'image/jpeg') {
      // JPEG has no alpha: flatten on white instead of black.
      source = document.createElement('canvas');
      source.width = canvas.width;
      source.height = canvas.height;
      var ctx = source.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, source.width, source.height);
      ctx.drawImage(canvas, 0, 0);
    }
    return new Promise(function (resolve, reject) {
      source.toBlob(function (b) { b ? resolve(b) : reject(new Error('Encoding failed')); }, type || 'image/png', quality);
    });
  }

  async function blobToCanvas(blob) {
    var bmp = await createImageBitmap(blob);
    var c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    return c;
  }

  function copy(canvas) {
    // Pass the promise so the clipboard write keeps the click's user activation.
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(canvas, 'image/png') })]);
  }

  // Print just the image from a throwaway iframe, so page UI never lands on paper.
  async function print(canvas) {
    var blob = await toBlob(canvas, 'image/png');
    var url = URL.createObjectURL(blob);
    var frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    var doc = frame.contentDocument;
    doc.body.style.margin = '0';
    var img = doc.createElement('img');
    img.style.width = '100%';
    img.src = url;
    doc.body.appendChild(img);
    await img.decode();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(function () { frame.remove(); URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- Annotate handoff (IndexedDB: same origin, no size limit) ----------

  function idb(mode, fn) {
    return new Promise(function (resolve, reject) {
      var open = indexedDB.open(HANDOFF_DB, 1);
      open.onupgradeneeded = function () { open.result.createObjectStore('images'); };
      open.onerror = function () { reject(open.error); };
      open.onsuccess = function () {
        var db = open.result;
        var tx = db.transaction('images', mode);
        var req = fn(tx.objectStore('images'));
        tx.oncomplete = function () { db.close(); resolve(req && req.result); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      };
    });
  }

  // Structured clone keeps Blobs binary: no base64 or JSON, unlike chrome.storage.
  function put(key, value) {
    return idb('readwrite', function (s) { return s.put(value, key); });
  }

  function take(key) {
    return idb('readwrite', function (s) { var r = s.get(key); s.delete(key); return r; });
  }

  async function sendToAnnotate(canvas) {
    // Open the tab while the click's user activation is still valid, then fill it.
    window.open(isExtension ? '/annotate.html#handoff' : 'annotate#handoff', '_blank');
    var blob = await toBlob(canvas, 'image/png');
    await put(HANDOFF_KEY, blob);
    var ch = new BroadcastChannel(HANDOFF_DB);
    ch.postMessage('ready');
    ch.close();
  }

  // Annotate page: take the handed-off image if we were opened for one.
  function receiveAnnotateHandoff(callback) {
    if (location.hash !== '#handoff' || !window.indexedDB) return;
    var done = false;
    var ch = new BroadcastChannel(HANDOFF_DB);
    function take() {
      take(HANDOFF_KEY).then(function (blob) {
        if (!blob || done) return;
        done = true;
        ch.close();
        history.replaceState(null, '', location.pathname + location.search);
        callback(blob);
      });
    }
    // Subscribe first, then check: the image may already be stored or arrive later.
    ch.onmessage = take;
    take();
  }

  // ---------- Standard action buttons ----------

  var ACTIONS = [
    { id: 'png', key: 'exp_png', label: 'PNG', primary: true, run: function (c, name) { return toBlob(c, 'image/png').then(function (b) { download(b, fileName(name, 'png')); }); } },
    { id: 'jpg', key: 'exp_jpg', label: 'JPG', run: function (c, name) { return toBlob(c, 'image/jpeg', 0.92).then(function (b) { download(b, fileName(name, 'jpg')); }); } },
    { id: 'pdf', key: 'exp_pdf', label: 'PDF', run: function (c, name) { return window.canvasToPdf(c).then(function (b) { download(b, fileName(name, 'pdf')); }); } },
    { id: 'copy', key: 'exp_copy', label: 'Copy', run: function (c) { return copy(c).then(function () { return tr('exp_copied', 'Copied'); }); } },
    { id: 'print', key: 'exp_print', label: 'Print', run: function (c) { return print(c); } },
    { id: 'annotate', key: 'exp_annotate', label: 'Annotate', run: function (c) { return sendToAnnotate(c); } }
  ];

  // Render PNG/JPG/PDF/Copy/Print/Annotate buttons into `container`.
  // getCanvas may return a canvas or a promise of one; opts.skip lists action ids to omit.
  function mountActions(container, getCanvas, opts) {
    opts = opts || {};
    ACTIONS.forEach(function (action) {
      if ((opts.skip || []).indexOf(action.id) >= 0) return;
      if (action.id === 'pdf' && typeof window.canvasToPdf !== 'function') return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--sm ' + (action.primary ? 'btn--primary' : 'btn--secondary');
      var label = document.createElement('span');
      label.setAttribute('data-i18n', action.key);
      label.textContent = tr(action.key, action.label);
      btn.appendChild(label);
      btn.addEventListener('click', async function () {
        var original = label.textContent;
        btn.disabled = true;
        label.textContent = tr('exp_working', '…');
        var shown;
        try {
          var canvas = await getCanvas();
          shown = canvas ? await action.run(canvas, typeof opts.name === 'function' ? opts.name() : opts.name) : null;
        } catch (err) {
          console.error(err);
          shown = tr('exp_failed', 'Failed');
        }
        btn.disabled = false;
        label.textContent = shown || original;
        if (shown) setTimeout(function () { label.textContent = tr(action.key, action.label); }, 1500);
      });
      container.appendChild(btn);
    });
  }

  // `self`, not `window`: the extension's service worker loads this file for put/take.
  self.ImageExport = {
    put: put,
    take: take,
    fileName: fileName,
    download: download,
    toBlob: toBlob,
    blobToCanvas: blobToCanvas,
    copy: copy,
    print: print,
    sendToAnnotate: sendToAnnotate,
    receiveAnnotateHandoff: receiveAnnotateHandoff,
    mountActions: mountActions
  };
})();
