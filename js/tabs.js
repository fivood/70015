/**
 * Web Toolbox — tab bar for pages that host two tools.
 * Each button has data-tab="name" and aria-controls="<panel id>". The first tab is the
 * default; the others deep-link as #name. Returns show(name) for switching from code.
 */
(function () {
  'use strict';

  window.initTabs = function (bar, initial) {
    var btns = [].slice.call(bar.querySelectorAll('[data-tab]'));
    var names = btns.map(function (b) { return b.dataset.tab; });

    function show(name) {
      btns.forEach(function (b) {
        var on = b.dataset.tab === name;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on);
        document.getElementById(b.getAttribute('aria-controls')).hidden = !on;
      });
    }

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tab]');
      if (!btn) return;
      show(btn.dataset.tab);
      history.replaceState(null, '', btn.dataset.tab === names[0] ? location.pathname : '#' + btn.dataset.tab);
    });

    // Leaves the URL alone on load so other hashes (e.g. #handoff) survive for their readers.
    var hash = location.hash.slice(1);
    show(initial || (names.indexOf(hash) >= 0 ? hash : names[0]));
    return show;
  };
})();
