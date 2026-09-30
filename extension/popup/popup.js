(function () {
  'use strict';

  var fullPageBtn = document.getElementById('fullPageBtn');
  var regionBtn = document.getElementById('regionBtn');
  var status = document.getElementById('status');
  var statusText = document.getElementById('statusText');
  var spinner = status.querySelector('.popup__spinner');

  function msg(key) {
    return chrome.i18n.getMessage(key) || key;
  }

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    var text = msg(key);
    if (text) el.textContent = text;
  });

  function showStatus(text, isError) {
    status.hidden = false;
    statusText.textContent = text;
    spinner.style.display = isError ? 'none' : '';
  }

  async function start(mode) {
    fullPageBtn.disabled = regionBtn.disabled = true;
    if (mode === 'full') showStatus(msg('capturing'));
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var res = tabs[0] ? await chrome.runtime.sendMessage({ type: 'start', mode: mode, tabId: tabs[0].id }) : null;
    if (!res || res.error) {
      showStatus(msg('cannot_capture'), true);
      fullPageBtn.disabled = regionBtn.disabled = false;
      return;
    }
    window.close();
  }

  fullPageBtn.addEventListener('click', function () { start('full'); });
  regionBtn.addEventListener('click', function () { start('region'); });
})();
