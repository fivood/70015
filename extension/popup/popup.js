(function () {
  'use strict';
  // Firefox exposes promise-based browser.*; Chrome/Edge only chrome.*.
  var chrome = globalThis.browser || globalThis.chrome;

  var captureBtns = document.querySelectorAll('[data-mode]');
  var status = document.getElementById('status');
  var statusText = document.getElementById('statusText');
  var spinner = status.querySelector('.popup__spinner');
  var toolGrid = document.getElementById('toolGrid');

  // Same strings and language setting as the tool pages (js/i18n.js).
  function t(key) { return window.t(key); }

  function showStatus(text, isError) {
    status.hidden = false;
    statusText.textContent = text;
    spinner.style.display = isError ? 'none' : '';
  }

  function setDisabled(v) { captureBtns.forEach(function (b) { b.disabled = v; }); }

  async function start(mode) {
    setDisabled(true);
    if (mode !== 'selection') showStatus(t('ext_capturing'));
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var res = tabs[0] ? await chrome.runtime.sendMessage({ type: 'start', mode: mode, tabId: tabs[0].id }) : null;
    if (!res || res.error) {
      showStatus(t('ext_cannot_capture'), true);
      setDisabled(false);
      return;
    }
    window.close();
  }

  captureBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { start(btn.dataset.mode); });
  });

  // Show the user's current shortcuts (editable at chrome://extensions/shortcuts).
  chrome.commands.getAll().then(function (commands) {
    commands.forEach(function (c) {
      var kbd = document.querySelector('[data-command="' + c.name + '"] .popup__kbd');
      if (kbd) kbd.textContent = c.shortcut || '';
    });
  });

  // Tool grid: every page except Home, opened in a new tab.
  // 'install' is the site's download page; inside the extension it is redundant.
  var SKIP = { './': 1, install: 1 };
  window.MENU_ITEMS.filter(function (it) { return !SKIP[it.href]; }).forEach(function (it) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'popup__tool';
    btn.innerHTML = '<span class="popup__tool-icon" aria-hidden="true">' + it.icon + '</span>';
    var label = document.createElement('span');
    label.className = 'popup__tool-label';
    label.textContent = t(it.labelKey);
    btn.appendChild(label);
    btn.addEventListener('click', function () {
      chrome.tabs.create({ url: chrome.runtime.getURL(window.menuPageUrl(it.href)) });
      window.close();
    });
    toolGrid.appendChild(btn);
  });
})();
