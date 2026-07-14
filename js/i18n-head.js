(function () {
  'use strict';
  try {
    var lang = localStorage.getItem('70015-lang');
    if (!lang) {
      var nav = (navigator.language || 'en').toLowerCase();
      lang = nav.startsWith('zh') ? 'zh' : 'en';
    }
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  } catch (e) {
    document.documentElement.setAttribute('data-lang', 'en');
  }
})();
