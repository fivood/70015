(function () {
  'use strict';

  var items = [
    { href: './', labelKey: 'm_home', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>' },
    { href: 'install', labelKey: 'm_install', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' },
    { group: 'g_image', href: 'ai-prep', labelKey: 'm_aiprep', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4"/><path d="M12 9.5l1 2.2 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z"/></svg>' },
    { group: 'g_image', href: 'converter', labelKey: 'm_converter', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15 L8 10 L12 14 L21 5"/></svg>' },
    { group: 'g_image', href: 'favicon', labelKey: 'm_favicon', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M12 12.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z"/></svg>' },
    { group: 'g_image', href: 'resize', labelKey: 'm_resize', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3 V14 a3 3 0 0 0 3 3 H21"/><path d="M3 7 H14 a3 3 0 0 1 3 3 V21"/><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/></svg>' },
    { group: 'g_image', href: 'stitch', labelKey: 'm_stitch', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/></svg>' },
    { group: 'g_image', href: 'image-editor', labelKey: 'm_image_editor', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 16l-1 4z"/><path d="M13.5 7.5l3 3"/><path d="M4 4h5M4 8h3"/></svg>' },
    { group: 'g_image', href: 'snapshot', labelKey: 'm_snapshot', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h2l1.5-2h9L18 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>' },
    { group: 'g_image', href: 'metadata', labelKey: 'm_metadata', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="M7 17l3.5-4 2.5 3 2-2.5L19 17"/></svg>' },
    { group: 'g_design', href: 'color', labelKey: 'm_color', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3 A9 9 0 0 0 12 21 Z" fill="currentColor" stroke="none"/></svg>' },
    { group: 'g_design', href: 'editor', labelKey: 'm_editor', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17 L11 7 L13 7 L17 17"/><path d="M9 13 L15 13"/></svg>' },
    { group: 'g_design', href: 'isometric', labelKey: 'm_isometric', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>' },
    { group: 'g_encode', href: 'base64', labelKey: 'm_base64', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 16l-3-4 3-4"/><path d="M16 8l3 4-3 4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>' },
    { group: 'g_encode', href: 'qr', labelKey: 'm_qr', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="18" y="18" width="3" height="3" rx="0.5"/></svg>' }
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
    var lastGroup;
    grid.innerHTML = items.map(function (it) {
      var header = it.group && it.group !== lastGroup ? '<div class="menu__group">' + label({ labelKey: it.group }) + '</div>' : '';
      lastGroup = it.group;
      return header + '<a class="menu__item' + (isActive(it.href) ? ' is-active' : '') + '" href="' + pageUrl(it.href) + '">' +
        '<span class="menu__icon">' + it.icon + '</span>' +
        '<span class="menu__label">' + label(it) + '</span>' +
        '</a>';
    }).join('');
  }

  window.renderMenu = render;
  render();
})();
