(function () {
  'use strict';

  var fullPageBtn = document.getElementById('fullPageBtn');
  var regionBtn = document.getElementById('regionBtn');
  var status = document.getElementById('status');
  var statusText = document.getElementById('statusText');

  function msg(key) {
    return chrome.i18n.getMessage(key) || key;
  }

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    var text = msg(key);
    if (text) el.textContent = text;
  });

  function showStatus(text) {
    status.hidden = false;
    statusText.textContent = text;
  }

  fullPageBtn.addEventListener('click', function () {
    showStatus(msg('capturing'));
    chrome.runtime.sendMessage({ type: 'startFullPage' });
    setTimeout(function () { window.close(); }, 600);
  });

  regionBtn.addEventListener('click', function () {
    chrome.runtime.sendMessage({ type: 'startRegion' });
    window.close();
  });
})();
