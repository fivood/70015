(function () {
  'use strict';

  var MIN_CAPTURE_GAP = 550; // captureVisibleTab quota is 2 calls per second
  var MAX_SIDE = 32767; // Chrome canvas limit per side
  var MAX_PIXELS = 64 * 1024 * 1024;
  var lastCaptureAt = 0;

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  async function captureTab(tab) {
    var wait = lastCaptureAt + MIN_CAPTURE_GAP - Date.now();
    if (wait > 0) await sleep(wait);
    // captureVisibleTab grabs whatever tab is active; stop if the user switched away.
    var current = await chrome.tabs.get(tab.id);
    if (!current.active) throw new Error('Tab is no longer active');
    lastCaptureAt = Date.now();
    return chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  }

  async function injectContentScript(tabId) {
    await chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ['content/content.css'] });
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content/content.js'] });
  }

  function flagError(tab, err) {
    console.error('Capture failed:', err);
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#ef4444' });
    chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
  }

  // Captures land at their real scroll offsets, so stitching needs no image matching.
  // ponytail: fixed/sticky headers repeat once per screen; hide them between shots if it matters.
  async function captureFullPage(tab) {
    var dims = await chrome.tabs.sendMessage(tab.id, { type: 'getPageDimensions' });
    var viewH = dims.viewH;
    var dpr = dims.dpr || 1;
    // Stop before the stitched canvas would exceed browser limits.
    var maxCssH = Math.floor(Math.min(MAX_SIDE, MAX_PIXELS / (dims.viewW * dpr)) / dpr);
    var total = Math.min(dims.scrollHeight, maxCssH);
    var captures = [];
    try {
      for (var y = 0; ; y += viewH) {
        var target = Math.max(0, Math.min(y, total - viewH));
        var res = await chrome.tabs.sendMessage(tab.id, { type: 'scrollTo', x: dims.scrollX, y: target });
        var prev = captures[captures.length - 1];
        if (prev && res.actualY <= prev.y) break; // page can't scroll further
        await sleep(250); // let lazy-loaded images appear
        captures.push({ dataUrl: await captureTab(tab), y: res.actualY });
        if (target + viewH >= total) break;
      }
    } finally {
      chrome.tabs.sendMessage(tab.id, { type: 'scrollTo', x: dims.scrollX, y: dims.scrollY }).catch(function () {});
    }
    var last = captures[captures.length - 1];
    await openResultPage(tab, {
      mode: 'full',
      captures: captures,
      viewW: dims.viewW,
      height: Math.min(total, last.y + viewH),
      truncated: total < dims.scrollHeight
    });
  }

  async function captureRegion(tab, rect, viewW) {
    var dataUrl = await captureTab(tab);
    await openResultPage(tab, { mode: 'region', captures: [{ dataUrl: dataUrl, y: 0 }], viewW: viewW, crop: rect });
  }

  async function openResultPage(tab, data) {
    // Needs "unlimitedStorage": long pages exceed the default 10 MB quota.
    await chrome.storage.local.set({ zimgCaptures: data });
    await chrome.tabs.create({ url: chrome.runtime.getURL('result/result.html'), index: tab.index + 1 });
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type === 'start') {
      chrome.tabs.get(msg.tabId).then(async function (tab) {
        chrome.action.setBadgeText({ tabId: tab.id, text: '' });
        try {
          await injectContentScript(tab.id);
        } catch (err) {
          // chrome://, Web Store, PDF viewer, etc. can't be scripted.
          sendResponse({ error: String(err && err.message || err) });
          return;
        }
        if (msg.mode === 'region') {
          await chrome.tabs.sendMessage(tab.id, { type: 'startSelection' });
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: true });
          captureFullPage(tab).catch(function (err) { flagError(tab, err); });
        }
      }).catch(function (err) { sendResponse({ error: String(err && err.message || err) }); });
      return true;
    }
    if (msg.type === 'regionSelected' && sender.tab) {
      captureRegion(sender.tab, msg.rect, msg.viewW).catch(function (err) { flagError(sender.tab, err); });
    }
  });
})();
