(function () {
  'use strict';
  // Firefox exposes promise-based browser.*; Chrome/Edge only chrome.*.
  var chrome = globalThis.browser || globalThis.chrome;
  // Injected before every capture; set up only once per page.
  if (window.__zimgExtLoaded) return;
  window.__zimgExtLoaded = true;

  var EDGE = 40;           // px from the scroller edge that auto-scrolls while selecting
  var target = null;       // element being scrolled; null = the window
  var restoreScroll = null;
  var hidden = [];         // [element, previous visibility, previous priority]
  var cancelled = false;
  var ui = null;           // selection overlay state

  // ---------- Scrolling ----------

  function getScroll(t) {
    return t ? { x: t.scrollLeft, y: t.scrollTop } : { x: window.scrollX, y: window.scrollY };
  }

  function setScroll(t, x, y) {
    // 'instant' overrides `scroll-behavior: smooth` on the page.
    (t || window).scrollTo({ left: x, top: y, behavior: 'instant' });
  }

  // Real scroll range: scrollHeight can include overflow that can't actually be scrolled to.
  function measureMax(t) {
    var s = getScroll(t);
    setScroll(t, 1e9, 1e9);
    var m = getScroll(t);
    setScroll(t, s.x, s.y);
    return m;
  }

  function viewportSize() {
    var de = document.documentElement;
    // clientWidth/Height exclude the window scrollbars; min() guards quirks mode.
    return { w: Math.min(window.innerWidth, de.clientWidth || window.innerWidth), h: Math.min(window.innerHeight, de.clientHeight || window.innerHeight) };
  }

  function isScrollable(el) {
    var cs = getComputedStyle(el);
    return (el.scrollHeight > el.clientHeight + 4 && /(auto|scroll|overlay)/.test(cs.overflowY)) ||
      (el.scrollWidth > el.clientWidth + 4 && /(auto|scroll|overlay)/.test(cs.overflowX));
  }

  function visibleArea(el) {
    var r = el.getBoundingClientRect(), v = viewportSize();
    return Math.max(0, Math.min(r.right, v.w) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, v.h) - Math.max(r.top, 0));
  }

  // Full page: the window if it scrolls, else the largest visible scrollable element
  // (apps, chat and docs sites that scroll an inner container).
  function findPageScroller() {
    var m = measureMax(null);
    if (m.y > 4 || m.x > 4) return null;
    var best = null, bestArea = 0;
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.scrollHeight <= el.clientHeight + 4 && el.scrollWidth <= el.clientWidth + 4) return;
      if (!isScrollable(el)) return;
      var area = visibleArea(el);
      if (area > bestArea) { bestArea = area; best = el; }
    });
    return best;
  }

  function scrollerAt(x, y) {
    var stack = document.elementsFromPoint(x, y).filter(function (el) { return !ui || !ui.nodes.includes(el); });
    for (var el = stack[0]; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (isScrollable(el)) return el;
    }
    return null;
  }

  // clip: part of the scroller visible in the viewport (viewport CSS px).
  // off: content coordinate of the clip's top-left when scrolled to 0,0.
  // withMax probes the scroll range by jumping to the end and back; skip it while selecting.
  function geometry(t, withMax) {
    var v = viewportSize();
    var ex = 0, ey = 0, cw = v.w, ch = v.h;
    if (t) {
      var r = t.getBoundingClientRect();
      ex = r.left + t.clientLeft; ey = r.top + t.clientTop; cw = t.clientWidth; ch = t.clientHeight;
    }
    var x0 = Math.max(ex, 0), y0 = Math.max(ey, 0);
    var clip = { x: x0, y: y0, w: Math.max(1, Math.min(ex + cw, v.w) - x0), h: Math.max(1, Math.min(ey + ch, v.h) - y0) };
    return { clip: clip, off: { x: clip.x - ex, y: clip.y - ey }, max: withMax ? measureMax(t) : null };
  }

  function makePlan(R, mode) {
    var g = geometry(target, true);
    // Only content that can be scrolled into the clip is capturable.
    var minX = g.off.x, minY = g.off.y;
    var maxX = g.off.x + g.max.x + g.clip.w, maxY = g.off.y + g.max.y + g.clip.h;
    var x = Math.max(R.x, minX), y = Math.max(R.y, minY);
    var region = { x: x, y: y, w: Math.max(1, Math.min(R.x + R.w, maxX) - x), h: Math.max(1, Math.min(R.y + R.h, maxY) - y) };
    restoreScroll = getScroll(target);
    cancelled = false;
    document.addEventListener('keydown', onCaptureKey, true);
    return {
      mode: mode, clip: g.clip, off: g.off, max: g.max, R: region,
      viewW: window.innerWidth, dpr: window.devicePixelRatio || 1, title: document.title
    };
  }

  function onCaptureKey(e) {
    if (e.key === 'Escape') cancelled = true;
  }

  function planFor(mode) {
    if (mode === 'visible') {
      target = null;
      var s = getScroll(null), v = viewportSize();
      return makePlan({ x: s.x, y: s.y, w: v.w, h: v.h }, 'visible');
    }
    target = findPageScroller();
    return makePlan({ x: 0, y: 0, w: 1e9, h: 1e9 }, 'full');
  }

  // Fixed/sticky elements would repeat on every screen; hide them after the first shot.
  // ponytail: a sticky element in normal flow is hidden too (leaves a gap); ok for headers/footers/chat widgets.
  function hideFixed() {
    document.querySelectorAll('body *').forEach(function (el) {
      var pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') return;
      if (target && el.contains(target)) return; // the scroller lives inside it
      hidden.push([el, el.style.getPropertyValue('visibility'), el.style.getPropertyPriority('visibility')]);
      el.style.setProperty('visibility', 'hidden', 'important');
    });
  }

  function restore() {
    hidden.forEach(function (h) {
      if (h[1]) h[0].style.setProperty('visibility', h[1], h[2]);
      else h[0].style.removeProperty('visibility');
    });
    hidden = [];
    if (restoreScroll) setScroll(target, restoreScroll.x, restoreScroll.y);
    restoreScroll = null;
    document.removeEventListener('keydown', onCaptureKey, true);
  }

  function afterPaint(fn) {
    requestAnimationFrame(function () { requestAnimationFrame(fn); });
  }

  // ---------- Selection (can extend past the screen) ----------

  function startSelection() {
    if (ui) return;
    var overlay = document.createElement('div');
    overlay.className = 'zimg-ext-overlay';
    var box = document.createElement('div');
    box.className = 'zimg-ext-sel';
    box.style.display = 'none';
    var label = document.createElement('span');
    label.className = 'zimg-ext-sel-label';
    box.appendChild(label);
    var hint = document.createElement('div');
    hint.className = 'zimg-ext-hint';
    hint.textContent = chrome.i18n.getMessage('scroll_hint') || 'Drag to select. Scroll with the wheel or drag to an edge. Esc cancels.';
    [overlay, box, hint].forEach(function (n) { document.documentElement.appendChild(n); });

    ui = { nodes: [overlay, box, hint], overlay: overlay, box: box, label: label, drag: null, pointer: null, raf: 0 };
    overlay.addEventListener('mousedown', onDown);
    overlay.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
    document.addEventListener('keydown', onSelectKey, true);
  }

  function endSelection() {
    if (!ui) return;
    cancelAnimationFrame(ui.raf);
    ui.nodes.forEach(function (n) { n.remove(); });
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    document.removeEventListener('keydown', onSelectKey, true);
    ui = null;
  }

  function clampToClip(p, clip) {
    return { x: Math.max(clip.x, Math.min(clip.x + clip.w, p.x)), y: Math.max(clip.y, Math.min(clip.y + clip.h, p.y)) };
  }

  // Viewport point -> content coordinate of the current scroller.
  function toContent(p) {
    var s = getScroll(target), g = ui.drag.geo;
    return { x: p.x - g.clip.x + g.off.x + s.x, y: p.y - g.clip.y + g.off.y + s.y };
  }

  function selectionRect() {
    var a = ui.drag.anchor, b = toContent(clampToClip(ui.pointer, ui.drag.geo.clip));
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }

  function drawBox() {
    var r = selectionRect(), s = getScroll(target), g = ui.drag.geo;
    // Content -> viewport; the box may extend past the screen while scrolled.
    ui.box.style.display = 'block';
    ui.box.style.left = (r.x - s.x - g.off.x + g.clip.x) + 'px';
    ui.box.style.top = (r.y - s.y - g.off.y + g.clip.y) + 'px';
    ui.box.style.width = r.w + 'px';
    ui.box.style.height = r.h + 'px';
    var dpr = window.devicePixelRatio || 1;
    ui.label.textContent = Math.round(r.w * dpr) + ' × ' + Math.round(r.h * dpr);
  }

  function onDown(e) {
    e.preventDefault();
    target = scrollerAt(e.clientX, e.clientY);
    ui.drag = { geo: geometry(target) };
    ui.pointer = { x: e.clientX, y: e.clientY };
    ui.drag.anchor = toContent(clampToClip(ui.pointer, ui.drag.geo.clip));
    drawBox();
    ui.raf = requestAnimationFrame(autoScroll);
  }

  // Dragging near an edge keeps scrolling so the selection can grow past one screen.
  function autoScroll() {
    if (!ui || !ui.drag) return;
    var c = ui.drag.geo.clip, p = ui.pointer, dx = 0, dy = 0;
    if (p.y > c.y + c.h - EDGE) dy = Math.min(EDGE, p.y - (c.y + c.h - EDGE));
    else if (p.y < c.y + EDGE) dy = -Math.min(EDGE, c.y + EDGE - p.y);
    if (p.x > c.x + c.w - EDGE) dx = Math.min(EDGE, p.x - (c.x + c.w - EDGE));
    else if (p.x < c.x + EDGE) dx = -Math.min(EDGE, c.x + EDGE - p.x);
    if (dx || dy) {
      var s = getScroll(target);
      setScroll(target, s.x + dx * 0.6, s.y + dy * 0.6);
      drawBox();
    }
    ui.raf = requestAnimationFrame(autoScroll);
  }

  function onWheel(e) {
    e.preventDefault();
    var t = ui.drag ? target : scrollerAt(e.clientX, e.clientY);
    (t || window).scrollBy({ left: e.deltaX, top: e.deltaY, behavior: 'instant' });
    if (ui.drag) drawBox();
  }

  function onMove(e) {
    if (!ui || !ui.drag) return;
    e.preventDefault();
    ui.pointer = { x: e.clientX, y: e.clientY };
    drawBox();
  }

  function onUp(e) {
    if (!ui || !ui.drag) return;
    ui.pointer = { x: e.clientX, y: e.clientY };
    var r = selectionRect();
    cancelAnimationFrame(ui.raf);
    ui.drag = null;
    if (r.w < 8 || r.h < 8) {
      ui.box.style.display = 'none';
      return;
    }
    endSelection();
    var plan = makePlan(r, 'selection');
    // Let the overlay removal paint before the first shot.
    afterPaint(function () { chrome.runtime.sendMessage({ type: 'selectionDone', plan: plan }); });
  }

  function onSelectKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); endSelection(); }
  }

  // ---------- Messages from the background worker ----------

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    switch (msg.type) {
      case 'startSelection':
        startSelection();
        sendResponse({ ok: true });
        break;
      case 'plan':
        sendResponse(planFor(msg.mode));
        break;
      case 'scrollTo':
        setScroll(target, msg.x, msg.y);
        afterPaint(function () {
          var s = getScroll(target);
          sendResponse({ x: s.x, y: s.y, cancelled: cancelled });
        });
        return true;
      case 'hideFixed':
        hideFixed();
        afterPaint(function () { sendResponse({ ok: true }); });
        return true;
      case 'restore':
        restore();
        sendResponse({ ok: true });
        break;
    }
  });
})();
