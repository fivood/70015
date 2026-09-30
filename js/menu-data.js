(function () {
  'use strict';

  var items = [
    { href: './', labelKey: 'm_home', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>' },
    { href: 'converter', labelKey: 'm_converter', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15 L8 10 L12 14 L21 5"/></svg>' },
    { href: 'resize', labelKey: 'm_resize', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3 V14 a3 3 0 0 0 3 3 H21"/><path d="M3 7 H14 a3 3 0 0 1 3 3 V21"/><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/></svg>' },
    { href: 'metadata', labelKey: 'm_metadata', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="M7 17l3.5-4 2.5 3 2-2.5L19 17"/></svg>' },
    { href: 'image-editor', labelKey: 'm_image_editor', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 16l-1 4z"/><path d="M13.5 7.5l3 3"/><path d="M4 4h5M4 8h3"/></svg>' },
    { href: 'snapshot', labelKey: 'm_snapshot', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h2l1.5-2h9L18 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>' },
    { href: 'annotate', labelKey: 'm_annotate', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>' },
    { href: 'color', labelKey: 'm_color', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3 A9 9 0 0 0 12 21 Z" fill="currentColor" stroke="none"/></svg>' },
    { href: 'palette', labelKey: 'm_palette', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2 L12 22"/><path d="M2 12 L22 12"/><circle cx="12" cy="12" r="4"/></svg>' },
    { href: 'base64', labelKey: 'm_base64', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 16l-3-4 3-4"/><path d="M16 8l3 4-3 4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>' },
    { href: 'qr', labelKey: 'm_qr', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="18" y="18" width="3" height="3" rx="0.5"/></svg>' },
    { href: 'svg', labelKey: 'm_svg', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="8 8 4 12 8 16"/><polyline points="16 8 20 12 16 16"/><line x1="13" y1="6" x2="11" y2="18"/></svg>' },
    { href: 'editor', labelKey: 'm_editor', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17 L11 7 L13 7 L17 17"/><path d="M9 13 L15 13"/></svg>' },
    { href: 'isometric', labelKey: 'm_isometric', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>' }
  ];

  // Extension pages have no server to resolve extensionless URLs.
  var isExtension = /-extension:$/.test(location.protocol); // chrome-extension: / moz-extension:
  function pageUrl(href) {
    if (!isExtension) return href;
    return href === './' ? 'index.html' : href + '.html';
  }

  // The extension popup renders its own tool grid from the same list.
  window.MENU_ITEMS = items;
  window.menuPageUrl = pageUrl;

  var grid = document.getElementById('menuGrid');

  function label(it) {
    if (typeof window.t === 'function') return window.t(it.labelKey);
    return it.labelKey;
  }

  function render() {
    if (!grid) return;
    var seg = (location.pathname.split('/').pop() || 'index').replace(/\.html?$/i, '').toLowerCase() || 'index';
    function isActive(href) {
      if (href === './') return seg === 'index';
      return seg === href.toLowerCase();
    }
    grid.innerHTML = items.map(function (it) {
      return '<a class="menu__item' + (isActive(it.href) ? ' is-active' : '') + '" href="' + pageUrl(it.href) + '">' +
        '<span class="menu__icon">' + it.icon + '</span>' +
        '<span class="menu__label">' + label(it) + '</span>' +
        '</a>';
    }).join('');
  }

  window.renderMenu = render;
  render();
})();
