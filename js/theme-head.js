(function () {
  'use strict';
  try {
    const theme = localStorage.getItem('70015-theme');
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  } catch (e) {}
})();
