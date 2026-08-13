(function () {
  'use strict';
  if (window.__zimgExtLoaded) return;
  window.__zimgExtLoaded = true;

  var overlay = null;
  var selBox = null;
  var selLabel = null;
  var hint = null;
  var dragStart = null;
  var region = null;

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'zimg-ext-overlay';

    selBox = document.createElement('div');
    selBox.className = 'zimg-ext-sel';
    selBox.style.display = 'none';

    selLabel = document.createElement('span');
    selLabel.className = 'zimg-ext-sel-label';
    selBox.appendChild(selLabel);

    hint = document.createElement('div');
    hint.className = 'zimg-ext-hint';
    hint.textContent = chrome.i18n.getMessage('scroll_hint') || 'Drag to select a region';

    document.body.appendChild(overlay);
    document.body.appendChild(selBox);
    document.body.appendChild(hint);

    overlay.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('keydown', onKey);
  }

  function removeOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (selBox) { selBox.remove(); selBox = null; }
    if (hint) { hint.remove(); hint = null; }
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('keydown', onKey);
    window.__zimgExtLoaded = false;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function onDown(e) {
    e.preventDefault();
    dragStart = { x: e.clientX, y: e.clientY };
    selBox.style.display = 'block';
    selBox.style.left = e.clientX + 'px';
    selBox.style.top = e.clientY + 'px';
    selBox.style.width = '0px';
    selBox.style.height = '0px';
  }

  function onMove(e) {
    if (!dragStart) return;
    e.preventDefault();
    var x = Math.min(dragStart.x, e.clientX);
    var y = Math.min(dragStart.y, e.clientY);
    var w = Math.abs(e.clientX - dragStart.x);
    var h = Math.abs(e.clientY - dragStart.y);
    selBox.style.left = x + 'px';
    selBox.style.top = y + 'px';
    selBox.style.width = w + 'px';
    selBox.style.height = h + 'px';
    selLabel.textContent = Math.round(w * devicePixelRatio) + ' × ' + Math.round(h * devicePixelRatio);
  }

  function onUp(e) {
    if (!dragStart) return;
    var x = Math.min(dragStart.x, e.clientX);
    var y = Math.min(dragStart.y, e.clientY);
    var w = Math.abs(e.clientX - dragStart.x);
    var h = Math.abs(e.clientY - dragStart.y);
    dragStart = null;

    if (w < 8 || h < 8) {
      selBox.style.display = 'none';
      return;
    }

    region = {
      x: x + window.scrollX,
      y: y + window.scrollY,
      w: w,
      h: h,
      viewW: window.innerWidth,
      viewH: window.innerHeight,
      dpr: devicePixelRatio,
      scrollH: document.documentElement.scrollHeight,
      startScrollY: y + window.scrollY,
      endScrollY: y + h + window.scrollY
    };

    removeOverlay();
    chrome.runtime.sendMessage({ type: 'regionSelected', region: region });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      removeOverlay();
      chrome.runtime.sendMessage({ type: 'cancelled' });
    }
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    switch (msg.type) {
      case 'startSelection':
        createOverlay();
        sendResponse({ ok: true });
        break;
      case 'getPageDimensions':
        sendResponse({
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          viewW: window.innerWidth,
          viewH: window.innerHeight,
          dpr: devicePixelRatio,
          scrollY: window.scrollY
        });
        break;
      case 'scrollTo':
        window.scrollTo(0, msg.y);
        setTimeout(function () {
          sendResponse({ actualY: window.scrollY });
        }, 50);
        return true;
      case 'cleanup':
        removeOverlay();
        sendResponse({ ok: true });
        break;
    }
  });
})();
