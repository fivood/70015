(function () {
  'use strict';

  var captureState = null;

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function sendToTab(tabId, msg) {
    return chrome.tabs.sendMessage(tabId, msg);
  }

  async function captureTab() {
    var dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    return dataUrl;
  }

  async function injectContentScript(tabId) {
    await chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ['content/content.css'] });
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content/content.js'] });
  }

  async function captureFullPage(tabId) {
    try {
      await injectContentScript(tabId);
      var dims = await sendToTab(tabId, { type: 'getPageDimensions' });
      var viewH = dims.viewH;
      var scrollH = dims.scrollHeight;
      var dpr = dims.dpr;
      var overlap = Math.floor(viewH * 0.15);
      var step = viewH - overlap;
      var steps = Math.ceil(scrollH / step);
      var captures = [];

      for (var i = 0; i < steps; i++) {
        var y = Math.min(i * step, scrollH - viewH);
        await sendToTab(tabId, { type: 'scrollTo', y: y });
        await sleep(400);
        var dataUrl = await captureTab();
        captures.push({ dataUrl: dataUrl, scrollY: y, viewH: viewH, dpr: dpr });
      }

      await sendToTab(tabId, { type: 'cleanup' });
      openResultPage(captures, { mode: 'full', width: dims.viewW, dpr: dpr });
    } catch (err) {
      console.error('Full page capture failed:', err);
    }
  }

  async function captureRegion(tabId, region) {
    try {
      var viewH = region.viewH;
      var dpr = region.dpr;
      var overlap = Math.floor(viewH * 0.15);
      var step = viewH - overlap;
      var startY = Math.max(0, region.startScrollY - region.y % viewH);
      var endY = region.endScrollY;
      var captures = [];

      var y = region.startScrollY - (region.y - Math.floor(region.y / viewH) * viewH);
      if (y < 0) y = 0;

      while (y < endY) {
        var scrollTarget = Math.max(0, Math.min(y, region.scrollH - viewH));
        await sendToTab(tabId, { type: 'scrollTo', y: scrollTarget });
        await sleep(400);
        var dataUrl = await captureTab();
        captures.push({
          dataUrl: dataUrl,
          scrollY: scrollTarget,
          viewH: viewH,
          dpr: dpr,
          region: region
        });
        y += step;
        if (y >= endY && scrollTarget < region.scrollH - viewH) break;
      }

      openResultPage(captures, {
        mode: 'region',
        region: region,
        dpr: dpr
      });
    } catch (err) {
      console.error('Region capture failed:', err);
    }
  }

  function openResultPage(captures, opts) {
    var data = { captures: captures, opts: opts };
    chrome.storage.local.set({ zimgCaptures: data }, function () {
      chrome.tabs.create({ url: chrome.runtime.getURL('result/result.html') });
    });
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type === 'startFullPage') {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) captureFullPage(tabs[0].id);
      });
      sendResponse({ ok: true });
    } else if (msg.type === 'startRegion') {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (!tabs[0]) return;
        injectContentScript(tabs[0].id).then(function () {
          return sendToTab(tabs[0].id, { type: 'startSelection' });
        });
      });
      sendResponse({ ok: true });
    } else if (msg.type === 'regionSelected') {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) captureRegion(tabs[0].id, msg.region);
      });
    } else if (msg.type === 'cancelled') {
      // User cancelled selection
    }
  });
})();
