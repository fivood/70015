// ImageExport.put: hand captures to the result page via IndexedDB.
// (The test harness loads it as a page script instead.)
if (typeof importScripts === 'function') importScripts('../js/export.js');

(function () {
  'use strict';
  // Firefox exposes promise-based browser.*; Chrome/Edge only chrome.*.
  var chrome = globalThis.browser || globalThis.chrome;

  var MIN_CAPTURE_GAP = 550; // captureVisibleTab quota is 2 calls per second
  var SETTLE_MS = 250;       // let lazy images / scroll-triggered layout settle
  var MAX_SIDE = 32767;      // Chrome canvas limit per side
  var MAX_PIXELS = 64 * 1024 * 1024;
  var lastCaptureAt = 0;

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function send(tab, msg) {
    return chrome.tabs.sendMessage(tab.id, msg);
  }

  async function captureTab(tab) {
    var wait = lastCaptureAt + MIN_CAPTURE_GAP - Date.now();
    if (wait > 0) await sleep(wait);
    // captureVisibleTab grabs whatever tab is active; stop if the user switched away.
    var current = await chrome.tabs.get(tab.id);
    if (!current.active) throw new Error('Tab is no longer active');
    lastCaptureAt = Date.now();
    var dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    // Keep shots as binary Blobs; base64 data URLs are 33% bigger and slow to pass around.
    return (await fetch(dataUrl)).blob();
  }

  async function injectContentScript(tabId) {
    await chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ['content/content.css'] });
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content/content.js'] });
  }

  function setBadge(tab, text, color) {
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: color || '#317fa8' });
    chrome.action.setBadgeText({ tabId: tab.id, text: text });
  }

  function flagError(tab, err) {
    console.error('Capture failed:', err);
    setBadge(tab, '!', '#ef4444');
  }

  // Scroll offsets that bring every part of [start, start+len) into a clip of clipLen.
  function positions(start, len, clipLen, max) {
    var p = Math.max(0, Math.min(start, max));
    var list = [p];
    while (p + clipLen < start + len && p < max) {
      p = Math.min(p + clipLen, max);
      list.push(p);
    }
    return list;
  }

  // Shrink the region so the stitched canvas stays within browser limits.
  function limitRegion(R, dpr) {
    var w = Math.min(R.w, Math.floor(MAX_SIDE / dpr));
    var maxH = Math.floor(Math.min(MAX_SIDE, MAX_PIXELS / (w * dpr)) / dpr);
    return { R: { x: R.x, y: R.y, w: w, h: Math.min(R.h, maxH) }, truncated: w < R.w || R.h > maxH };
  }

  // Every shot is stored with the content coordinate of its clip, so stitching is
  // exact placement, no image matching.
  async function runCapture(tab, plan) {
    var limited = limitRegion(plan.R, plan.dpr);
    var R = limited.R;
    var xs = positions(R.x - plan.off.x, R.w, plan.clip.w, plan.max.x);
    var ys = positions(R.y - plan.off.y, R.h, plan.clip.h, plan.max.y);
    var total = xs.length * ys.length;
    var captures = [];
    var seen = {};
    // Fixed headers belong only at the very top of the page. Starting mid-page (a
    // selection), they'd cover content the user saw below them, so hide them up front.
    var hideAfter = plan.mode === 'visible' ? Infinity : (ys[0] > 0 ? 0 : 1);
    try {
      for (var yi = 0; yi < ys.length; yi++) {
        for (var xi = 0; xi < xs.length; xi++) {
          var pos = await send(tab, { type: 'scrollTo', x: xs[xi], y: ys[yi] });
          if (pos.cancelled) return;
          var key = pos.x + ',' + pos.y;
          if (seen[key]) continue; // page couldn't scroll that far
          seen[key] = true;
          if (captures.length === hideAfter) await send(tab, { type: 'hideFixed' });
          if (total > 1) setBadge(tab, Math.round(captures.length / total * 100) + '%');
          await sleep(SETTLE_MS);
          captures.push({ blob: await captureTab(tab), x: pos.x + plan.off.x, y: pos.y + plan.off.y });
        }
      }
    } finally {
      await send(tab, { type: 'restore' }).catch(function () {});
      chrome.action.setBadgeText({ tabId: tab.id, text: '' });
    }
    await openResultPage(tab, {
      captures: captures,
      clip: plan.clip,
      R: R,
      viewW: plan.viewW,
      truncated: limited.truncated,
      title: plan.title
    });
  }

  async function openResultPage(tab, data) {
    // IndexedDB (shared by all extension pages) stores the Blobs as-is;
    // "unlimitedStorage" lifts its quota for very long pages.
    await ImageExport.put('capture', data);
    await chrome.tabs.create({ url: chrome.runtime.getURL('result/result.html'), index: tab.index + 1 });
  }

  // Throws for pages extensions can't script (chrome://, Web Store, PDF viewer).
  async function prepare(tab, mode) {
    chrome.action.setBadgeText({ tabId: tab.id, text: '' });
    await injectContentScript(tab.id);
    if (mode === 'selection') {
      await send(tab, { type: 'startSelection' });
      return null;
    }
    return send(tab, { type: 'plan', mode: mode });
  }

  function start(tab, mode) {
    return prepare(tab, mode).then(function (plan) {
      if (plan) runCapture(tab, plan).catch(function (err) { flagError(tab, err); });
    });
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type === 'start') {
      chrome.tabs.get(msg.tabId)
        .then(function (tab) { return start(tab, msg.mode); })
        .then(function () { sendResponse({ ok: true }); })
        .catch(function (err) { sendResponse({ error: String(err && err.message || err) }); });
      return true;
    }
    if (msg.type === 'selectionDone' && sender.tab) {
      runCapture(sender.tab, msg.plan).catch(function (err) { flagError(sender.tab, err); });
    }
  });

  var COMMAND_MODES = { 'capture-full': 'full', 'capture-visible': 'visible', 'capture-selection': 'selection' };
  chrome.commands.onCommand.addListener(function (command, tab) {
    if (!COMMAND_MODES[command] || !tab) return;
    start(tab, COMMAND_MODES[command]).catch(function (err) { flagError(tab, err); });
  });
})();
