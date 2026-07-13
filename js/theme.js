(function () {
  'use strict';

  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('70015-theme', theme);
    } catch (e) {}
    updateIcon(theme);
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', theme === 'dark' ? '#1d1c1e' : '#203848');
  }

  function updateIcon(theme) {
    const light = toggle.querySelector('.theme-toggle__light');
    const dark = toggle.querySelector('.theme-toggle__dark');
    if (light && dark) {
      light.style.display = theme === 'dark' ? 'none' : 'block';
      dark.style.display = theme === 'dark' ? 'block' : 'none';
    }
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  applyTheme(currentTheme());

  toggle.addEventListener('click', function () {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });
})();
