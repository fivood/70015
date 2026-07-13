(function () {
  'use strict';

  const fgSwatch = document.getElementById('fgSwatch');
  const fgPicker = document.getElementById('fgPicker');
  const fgHex = document.getElementById('fgHex');
  const fgPick = document.getElementById('fgPick');
  const fgValues = document.getElementById('fgValues');
  const bgSwatch = document.getElementById('bgSwatch');
  const bgPicker = document.getElementById('bgPicker');
  const bgHex = document.getElementById('bgHex');
  const bgPick = document.getElementById('bgPick');
  const bgValues = document.getElementById('bgValues');
  const ratioNumber = document.getElementById('ratioNumber');
  const badges = document.getElementById('badges');
  const preview = document.getElementById('preview');
  const swapBtn = document.getElementById('swapBtn');
  const pickHint = document.getElementById('pickHint');
  const toast = document.getElementById('toast');

  const hasEyeDropper = typeof window.EyeDropper === 'function';
  const eyeDropper = hasEyeDropper ? new EyeDropper() : null;

  let fg = '#203848';
  let bg = '#ffffff';

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2000);
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function normalizeHex(input) {
    if (!input) return null;
    let h = input.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return '#' + h.toLowerCase();
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function relLuminance({ r, g, b }) {
    const a = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function contrastRatio(c1, c2) {
    const L1 = relLuminance(c1), L2 = relLuminance(c2);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function colorInfo(hex) {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return {
      hex,
      rgb,
      hsl,
      strings: {
        hex: hex.toUpperCase(),
        rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
        hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
      }
    };
  }

  function renderRow(role, hex, swatchEl, pickerEl, hexInput, valuesEl) {
    const info = colorInfo(hex);
    swatchEl.style.background = hex;
    pickerEl.value = hex;
    if (document.activeElement !== hexInput) hexInput.value = info.strings.hex;
    valuesEl.innerHTML = ['hex', 'rgb', 'hsl'].map(k =>
      `<button class="value-chip" data-copy="${k}" type="button"><span>${k.toUpperCase()}</span><code>${info.strings[k]}</code></button>`
    ).join('');
    valuesEl.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => copy(info.strings[btn.dataset.copy]));
    });
  }

  function badge(label, pass) {
    return `<span class="badge ${pass ? 'badge--pass' : 'badge--fail'}">${pass ? '✓' : '✕'} ${label}</span>`;
  }

  function render() {
    renderRow('fg', fg, fgSwatch, fgPicker, fgHex, fgValues);
    renderRow('bg', bg, bgSwatch, bgPicker, bgHex, bgValues);
    const ratio = contrastRatio(hexToRgb(fg), hexToRgb(bg));
    ratioNumber.textContent = (Math.round(ratio * 100) / 100).toFixed(2);
    badges.innerHTML =
      badge('AA normal', ratio >= 4.5) +
      badge('AA large', ratio >= 3) +
      badge('AAA normal', ratio >= 7) +
      badge('AAA large', ratio >= 4.5);
    preview.style.color = fg;
    preview.style.background = bg;
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); showToast('Copied ' + text); }
    catch (e) { showToast('Copy failed'); }
  }

  function setFg(hex) { if (hex) { fg = hex; render(); } }
  function setBg(hex) { if (hex) { bg = hex; render(); } }

  async function pickFromScreen(setter) {
    if (!eyeDropper) return;
    try { const r = await eyeDropper.open(); setter(r.sRGBHex); }
    catch (e) { if (e && e.name !== 'NotAllowedError') showToast('Pick cancelled'); }
  }

  fgPicker.addEventListener('input', e => setFg(e.target.value));
  bgPicker.addEventListener('input', e => setBg(e.target.value));
  fgSwatch.addEventListener('click', () => fgPicker.click());
  bgSwatch.addEventListener('click', () => bgPicker.click());

  fgHex.addEventListener('input', e => { const h = normalizeHex(e.target.value); if (h) setFg(h); });
  bgHex.addEventListener('input', e => { const h = normalizeHex(e.target.value); if (h) setBg(h); });

  fgPick.addEventListener('click', () => pickFromScreen(setFg));
  bgPick.addEventListener('click', () => pickFromScreen(setBg));

  swapBtn.addEventListener('click', () => { const t = fg; fg = bg; bg = t; render(); });

  if (!hasEyeDropper) {
    fgPick.disabled = true; fgPick.classList.add('is-disabled');
    bgPick.disabled = true; bgPick.classList.add('is-disabled');
    pickHint.textContent = 'Screen picker needs desktop Chrome/Edge. Click a swatch or HEX to choose colors.';
  }

  render();
})();
