(function () {
  'use strict';
  // Injected on every capture; register the listener only once per page.
  if (window.__zimgExtLoaded) return;
  window.__zimgExtLoaded = true;

  var overlay = null;
  var selBox = null;
  var selLabel = null;
  var hint = null;
  var dragStart = null;

  function createOverlay() {
    if (overlay) return;
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

    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(selBox);
    document.documentElement.appendChild(hint);

    overlay.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
    document.addEventListener('keydown', onKey, true);
  }

  function removeOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (selBox) { selBox.remove(); selBox = null; }
    if (hint) { hint.remove(); hint = null; }
    dragStart = null;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    document.removeEventListener('keydown', onKey, true);
  }

  function rectFrom(e) {
    return {
      x: Math.min(dragStart.x, e.clientX),
      y: Math.min(dragStart.y, e.clientY),
      w: Math.abs(e.clientX - dragStart.x),
      h: Math.abs(e.clientY - dragStart.y)
    };
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
    var r = rectFrom(e);
    selBox.style.left = r.x + 'px';
    selBox.style.top = r.y + 'px';
    selBox.style.width = r.w + 'px';
    selBox.style.height = r.h + 'px';
    selLabel.textContent = Math.round(r.w * devicePixelRatio) + ' × ' + Math.round(r.h * devicePixelRatio);
  }

  function onUp(e) {
    if (!dragStart) return;
    var r = rectFrom(e);
    dragStart = null;
    if (r.w < 8 || r.h < 8) {
      selBox.style.display = 'none';
      return;
    }
    removeOverlay();
    // Wait for the overlay removal to paint before the tab is captured.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        chrome.runtime.sendMessage({ type: 'regionSelected', rect: r, viewW: window.innerWidth });
      });
    });
  }

  function onKey(e) {
    if (e.key === 'Escape') removeOverlay();
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    switch (msg.type) {
      case 'startSelection':
        createOverlay();
        sendResponse({ ok: true });
        break;
      case 'getPageDimensions':
        sendResponse({
          scrollHeight: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0),
          viewW: window.innerWidth,
          viewH: window.innerHeight,
          dpr: window.devicePixelRatio || 1,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        });
        break;
      case 'scrollTo':
        // 'instant' overrides a page's `scroll-behavior: smooth`.
        window.scrollTo({ left: msg.x || 0, top: msg.y, behavior: 'instant' });
        // Two frames so lazy content and sticky elements settle before capture.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { sendResponse({ actualY: window.scrollY }); });
        });
        return true;
    }
  });
})();
