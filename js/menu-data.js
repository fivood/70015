(function () {
  'use strict';

  const items = [
    { href: './', label: 'Home', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>` },
    { href: 'converter', label: 'Image Converter', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15 L8 10 L12 14 L21 5"/></svg>` },
    { href: 'palette', label: 'Color Palette', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2 L12 22"/><path d="M2 12 L22 12"/><circle cx="12" cy="12" r="4"/></svg>` },
    { href: 'color', label: 'Color & Contrast', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3 A9 9 0 0 0 12 21 Z" fill="currentColor" stroke="none"/></svg>` },
    { href: 'base64', label: 'Base64 Swap', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 16l-3-4 3-4"/><path d="M16 8l3 4-3 4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>` },
    { href: 'svg', label: 'SVG Tools', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 8 4 12 8 16"/><polyline points="16 8 20 12 16 16"/><line x1="13" y1="6" x2="11" y2="18"/></svg>` },
    { href: 'qr', label: 'QR Code', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="18" y="18" width="3" height="3" rx="0.5"/></svg>` },
    { href: 'annotate', label: 'Screenshot Annotate', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>` },
    { href: 'snapshot', label: 'Web Snapshot', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h2l1.5-2h9L18 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>` },
    { href: 'editor', label: 'SVG Editor', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17 L11 7 L13 7 L17 17"/><path d="M9 13 L15 13"/></svg>` }
  ];

  const grid = document.getElementById('menuGrid');
  if (!grid) return;

  const seg = (location.pathname.split('/').pop() || 'index').replace(/\.html?$/i, '').toLowerCase() || 'index';

  function isActive(href) {
    if (href === './') return seg === 'index';
    return seg === href.toLowerCase();
  }

  grid.innerHTML = items.map(it =>
    `<a class="menu__item${isActive(it.href) ? ' is-active' : ''}" href="${it.href}">
      <span class="menu__icon">${it.icon}</span>
      <span class="menu__label">${it.label}</span>
    </a>`
  ).join('');
})();
