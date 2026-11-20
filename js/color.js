(function () {
  'use strict';

  const C = window.ColorCore;
  const $ = (id) => document.getElementById(id);
  const rows = {
    fg: { swatch: $('fgSwatch'), picker: $('fgPicker'), input: $('fgHex'), pick: $('fgPick'), values: $('fgValues') },
    bg: { swatch: $('bgSwatch'), picker: $('bgPicker'), input: $('bgHex'), pick: $('bgPick'), values: $('bgValues') }
  };
  const ratioNumber = $('ratioNumber');
  const badges = $('badges');
  const fixRow = $('fixRow');
  const preview = $('preview');
  const recentEl = $('recentColors');
  const shadesEl = $('shades');
  const harmoniesEl = $('harmonies');
  const baseTabs = $('baseTabs');
  const toast = $('toast');

  const hasEyeDropper = typeof window.EyeDropper === 'function';
  const eyeDropper = hasEyeDropper ? new EyeDropper() : null;

  function t(key, fallback) { return typeof window.t === 'function' ? window.t(key) : fallback; }
  function tpl(key, fallback, vars) {
    let text = t(key, fallback);
    Object.keys(vars || {}).forEach((name) => { text = text.split('{' + name + '}').join(vars[name]); });
    return text;
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2000);
  }

  function normalizeHex(input) {
    if (!input) return null;
    let h = String(input).trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map(c => c + c).join('');
    return /^[0-9a-fA-F]{6}$/.test(h) ? '#' + h.toLowerCase() : null;
  }

  // Any CSS color (#hex, rgb(), hsl(), oklch(), a name such as "teal") as #rrggbb: the
  // browser paints it onto one pixel and we read it back (sRGB; alpha is ignored).
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  probe.canvas.width = probe.canvas.height = 1;
  function parseColor(input) {
    const hex = normalizeHex(input);
    if (hex || !input || !CSS.supports('color', input.trim())) return hex;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = '#000';
    probe.fillStyle = input.trim();
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return C.rgbToHex({ r: d[0], g: d[1], b: d[2] });
  }

  // ---------- Stored state: the two colors, recent colors, scale base ----------

  function read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  const colors = {
    fg: normalizeHex(read('70015-color-fg', null)) || '#203848',
    bg: normalizeHex(read('70015-color-bg', null)) || '#ffffff'
  };
  let recent = read('70015-color-recent', []).filter(normalizeHex).slice(0, 16);
  let base = read('70015-color-base', 'fg') === 'bg' ? 'bg' : 'fg';

  // Recent colors: every color the user settles on (picked, typed, applied), newest first.
  function remember(hex) {
    if (!hex) return;
    recent = [hex].concat(recent.filter(h => h !== hex)).slice(0, 16);
    write('70015-color-recent', recent);
    renderRecent();
  }

  function set(role, hex, keep) {
    if (!hex) return;
    colors[role] = hex;
    write('70015-color-' + role, hex);
    if (keep) remember(hex);
    render();
  }

  // ---------- Swatch menu: copy, use as text, use as background ----------

  let menu = null;
  function closeMenu() {
    if (!menu) return;
    menu.remove();
    menu = null;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onMenuKey, true);
  }
  function onOutside(e) { if (menu && !menu.contains(e.target)) closeMenu(); }
  function onMenuKey(e) { if (e.key === 'Escape') { closeMenu(); e.stopPropagation(); } }

  function openMenu(anchor, hex) {
    closeMenu();
    menu = document.createElement('div');
    menu.className = 'swatch-menu';
    menu.setAttribute('role', 'menu');
    const head = document.createElement('div');
    head.className = 'swatch-menu__head';
    const chip = document.createElement('span');
    chip.className = 'swatch-menu__chip';
    chip.style.background = hex;
    head.append(chip, hex.toUpperCase());
    menu.appendChild(head);
    [
      ['col_menu_copy', 'Copy HEX', () => copy(hex.toUpperCase())],
      ['col_menu_fg', 'Use as text', () => { set('fg', hex, true); showToast(tpl('col_set_fg', 'Text color: {hex}', { hex: hex.toUpperCase() })); }],
      ['col_menu_bg', 'Use as background', () => { set('bg', hex, true); showToast(tpl('col_set_bg', 'Background: {hex}', { hex: hex.toUpperCase() })); }]
    ].forEach(([key, label, run]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.textContent = t(key, label);
      b.addEventListener('click', () => { closeMenu(); run(); });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    const below = r.bottom + 6 + mh <= window.innerHeight;
    menu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left)) + window.scrollX + 'px';
    menu.style.top = (below ? r.bottom + 6 : r.top - mh - 6) + window.scrollY + 'px';
    menu.querySelector('button').focus();
    setTimeout(() => {
      document.addEventListener('pointerdown', onOutside, true);
      document.addEventListener('keydown', onMenuKey, true);
    });
  }

  // A color square that opens the menu; `label` (optional) is shown under it.
  function swatchButton(hex, label, extraClass) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch-btn' + (extraClass ? ' ' + extraClass : '');
    b.title = hex.toUpperCase();
    b.setAttribute('aria-label', (label ? label + ' ' : '') + hex.toUpperCase());
    const sq = document.createElement('span');
    sq.className = 'swatch-btn__color';
    sq.style.background = hex;
    b.appendChild(sq);
    if (label != null) {
      const cap = document.createElement('span');
      cap.className = 'swatch-btn__label';
      cap.textContent = label;
      b.appendChild(cap);
      const code = document.createElement('code');
      code.textContent = hex.slice(1).toUpperCase();
      b.appendChild(code);
    }
    b.addEventListener('click', () => openMenu(b, hex));
    return b;
  }

  // ---------- Rendering ----------

  const FORMAT_KEYS = ['hex', 'rgb', 'hsl', 'hsb', 'oklch', 'cmyk'];

  function renderRow(role) {
    const row = rows[role], hex = colors[role], f = C.formats(hex);
    row.swatch.style.background = hex;
    row.picker.value = hex;
    if (document.activeElement !== row.input) {
      row.input.value = f.hex;
      row.input.removeAttribute('aria-invalid');
    }
    row.values.innerHTML = '';
    FORMAT_KEYS.forEach((k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'value-chip';
      if (k === 'cmyk') b.title = t('col_cmyk_note', 'Approximate, without a color profile');
      const name = document.createElement('span');
      name.textContent = k.toUpperCase();
      const code = document.createElement('code');
      code.textContent = f[k].replace(/^[a-z]+\((.*)\)$/, k === 'hex' ? '$&' : '$1');
      b.append(name, code);
      b.addEventListener('click', () => copy(f[k]));
      row.values.appendChild(b);
    });
  }

  const LEVELS = [
    { key: 'col_aa_n', label: 'AA normal', min: 4.5 },
    { key: 'col_aa_l', label: 'AA large', min: 3 },
    { key: 'col_aaa_n', label: 'AAA normal', min: 7 },
    { key: 'col_aaa_l', label: 'AAA large', min: 4.5 }
  ];

  function renderContrast() {
    const ratio = C.contrast(colors.fg, colors.bg);
    ratioNumber.textContent = (Math.floor(ratio * 100) / 100).toFixed(2);
    badges.innerHTML = '';
    LEVELS.forEach((lv) => {
      const pass = ratio >= lv.min, s = document.createElement('span');
      s.className = 'badge ' + (pass ? 'badge--pass' : 'badge--fail');
      s.textContent = (pass ? '✓ ' : '✕ ') + t(lv.key, lv.label);
      badges.appendChild(s);
    });
    preview.style.color = colors.fg;
    preview.style.background = colors.bg;

    // Nearest text colors (lightness only) that reach AA / AAA on this background.
    fixRow.innerHTML = '';
    const targets = [['AA', 4.5], ['AAA', 7]].filter(([, min]) => ratio < min);
    fixRow.hidden = !targets.length;
    if (!targets.length) return;
    const lead = document.createElement('span');
    lead.className = 'contrast-fix__lead';
    lead.textContent = t('col_fix_lead', 'Closest text color that passes:');
    fixRow.appendChild(lead);
    targets.forEach(([name, min]) => {
      const hex = C.fixContrast(colors.fg, colors.bg, min);
      if (!hex) {
        const no = document.createElement('span');
        no.className = 'contrast-fix__none';
        no.textContent = tpl('col_fix_none', '{level}: not reachable by changing the text color', { level: name });
        fixRow.appendChild(no);
        return;
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'contrast-fix__btn';
      b.title = t('col_fix_apply', 'Apply to the text color');
      const sq = document.createElement('span');
      sq.className = 'swatch-menu__chip';
      sq.style.background = hex;
      b.append(name + ' ', sq, ' ' + hex.toUpperCase());
      b.addEventListener('click', () => set('fg', hex, true));
      fixRow.appendChild(b);
    });
  }

  function renderRecent() {
    recentEl.innerHTML = '';
    recentEl.parentElement.hidden = !recent.length;
    recent.forEach((hex) => recentEl.appendChild(swatchButton(hex)));
  }

  const HARMONY_NAMES = [
    ['complementary', 'col_harmony_comp', 'Complementary'],
    ['analogous', 'col_harmony_analog', 'Analogous'],
    ['triadic', 'col_harmony_triad', 'Triadic'],
    ['split', 'col_harmony_split', 'Split complementary']
  ];

  function renderScale() {
    const hex = colors[base];
    baseTabs.querySelectorAll('[data-base]').forEach((b) => b.classList.toggle('is-active', b.dataset.base === base));
    shadesEl.innerHTML = '';
    C.shades(hex).forEach((s) => shadesEl.appendChild(swatchButton(s.hex, String(s.step), s.base ? 'is-base' : '')));
    harmoniesEl.innerHTML = '';
    const h = C.harmonies(hex);
    HARMONY_NAMES.forEach(([id, key, label]) => {
      const row = document.createElement('div');
      row.className = 'harmony';
      const name = document.createElement('span');
      name.className = 'harmony__name';
      name.textContent = t(key, label);
      const list = document.createElement('div');
      list.className = 'harmony__colors';
      h[id].forEach((c) => list.appendChild(swatchButton(c, '')));
      row.append(name, list);
      harmoniesEl.appendChild(row);
    });
  }

  function render() {
    renderRow('fg');
    renderRow('bg');
    renderContrast();
    renderScale();
  }

  // ---------- Actions ----------

  async function copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else {
        const input = document.createElement('textarea');
        input.value = text; input.style.position = 'fixed'; input.style.opacity = '0';
        document.body.appendChild(input); input.select();
        const ok = document.execCommand('copy');
        input.remove();
        if (!ok) throw new Error('copy failed');
      }
      showToast(tpl('col_copied_value', 'Copied {value}', { value: text.length > 40 ? text.split('\n').length + ' lines' : text }));
    } catch (e) { showToast(t('toast_copy_fail', 'Copy failed')); }
  }

  async function pickFromScreen(role) {
    if (!eyeDropper) return;
    try { const r = await eyeDropper.open(); set(role, normalizeHex(r.sRGBHex) || parseColor(r.sRGBHex), true); }
    catch (e) { if (e && e.name !== 'AbortError' && e.name !== 'NotAllowedError') showToast(t('col_pick_cancelled', 'Pick cancelled')); }
  }

  Object.keys(rows).forEach((role) => {
    const row = rows[role];
    row.picker.addEventListener('input', e => set(role, e.target.value));
    row.picker.addEventListener('change', e => remember(e.target.value));
    row.swatch.addEventListener('click', () => row.picker.click());
    // Typing applies each valid value at once; leaving the field (or Enter) shows it as HEX.
    row.input.addEventListener('input', () => {
      const h = parseColor(row.input.value);
      row.input.setAttribute('aria-invalid', String(!h && row.input.value.trim() !== ''));
      if (h) set(role, h);
    });
    row.input.addEventListener('keydown', e => { if (e.key === 'Enter') row.input.blur(); });
    row.input.addEventListener('blur', () => {
      if (parseColor(row.input.value)) remember(colors[role]);
      render();
    });
    row.pick.addEventListener('click', () => pickFromScreen(role));
    if (!hasEyeDropper) { row.pick.disabled = true; row.pick.classList.add('is-disabled'); }
  });
  if (!hasEyeDropper) $('pickHint').textContent = t('col_pick_hint', 'Screen picker needs desktop Chrome/Edge. Click a swatch, or type HEX, rgb(), hsl() or a color name.');

  $('swapBtn').addEventListener('click', () => {
    const fg = colors.fg;
    set('fg', colors.bg);
    set('bg', fg);
  });

  baseTabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-base]');
    if (!b) return;
    base = b.dataset.base;
    write('70015-color-base', base);
    renderScale();
  });

  $('copyVars').addEventListener('click', () => {
    copy(C.shades(colors[base]).map(s => '--color-' + s.step + ': ' + s.hex + ';').join('\n'));
  });

  $('clearRecent').addEventListener('click', () => {
    recent = [];
    write('70015-color-recent', recent);
    renderRecent();
  });

  // Tabs: picker & contrast / palette from image (js/palette.js).
  const showTab = initTabs($('colorTabs'));

  // Opened with ?fg=RRGGBB (e.g. from the extension's page picker): use it as the text color.
  const fromUrl = normalizeHex(new URLSearchParams(location.search).get('fg'));
  if (fromUrl) {
    colors.fg = fromUrl;
    write('70015-color-fg', fromUrl);
    remember(fromUrl);
    showTab('contrast');
  }

  // For the palette tab: its swatches open the same menu.
  window.ColorTool = { openMenu: openMenu, remember: remember };

  render();
  renderRecent();
  window.onLangChange = () => { render(); renderRecent(); };
})();
