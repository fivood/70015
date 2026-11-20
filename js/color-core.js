/**
 * Color math for the color tool (js/color.js): formats, OKLCH, WCAG contrast,
 * contrast fixes, shade scales and harmonies. No DOM; checked by .verify/color-core.test.js.
 * Colors are '#rrggbb' strings or { r, g, b } with 0-255 channels.
 */
(function (root) {
  'use strict';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }

  function rgbToHex(c) {
    return '#' + [c.r, c.g, c.b].map(function (v) { return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); }).join('');
  }

  function rgbToHsl(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  // HSB (= HSV), the model Figma, Photoshop and Sketch pickers use.
  function rgbToHsb(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var max = Math.max(r, g, b), d = max - Math.min(r, g, b), h = 0;
    if (d) h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: Math.round(h * 60) % 360, s: Math.round(max ? d / max * 100 : 0), b: Math.round(max * 100) };
  }

  // Naive CMYK without a color profile: a starting point for print, not a proof.
  function rgbToCmyk(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255, k = 1 - Math.max(r, g, b);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
    return { c: Math.round((1 - r - k) / (1 - k) * 100), m: Math.round((1 - g - k) / (1 - k) * 100), y: Math.round((1 - b - k) / (1 - k) * 100), k: Math.round(k * 100) };
  }

  // ---------- OKLab / OKLCH (Björn Ottosson) ----------

  function toLinear(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function fromLinear(v) { return (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255; }

  function rgbToOklch(c) {
    var r = toLinear(c.r), g = toLinear(c.g), b = toLinear(c.b);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    var L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    var A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    var B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    var C = Math.sqrt(A * A + B * B), H = Math.atan2(B, A) * 180 / Math.PI;
    return { l: L, c: C, h: C < 1e-4 ? 0 : (H + 360) % 360 };
  }

  // Linear sRGB channels of an OKLCH color (may fall outside 0..1).
  function oklchToLinear(L, C, H) {
    var a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    var s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
  }

  function inGamut(L, C, H) {
    return oklchToLinear(L, C, H).every(function (v) { return v >= -1e-4 && v <= 1 + 1e-4; });
  }

  // OKLCH to sRGB hex; out-of-gamut colors keep lightness and hue and lose chroma.
  function oklchToHex(L, C, H) {
    L = clamp(L, 0, 1);
    if (!inGamut(L, C, H)) {
      var lo = 0, hi = C;
      for (var i = 0; i < 24; i++) { var mid = (lo + hi) / 2; if (inGamut(L, mid, H)) lo = mid; else hi = mid; }
      C = lo;
    }
    var lin = oklchToLinear(L, C, H);
    return rgbToHex({ r: fromLinear(clamp(lin[0], 0, 1)), g: fromLinear(clamp(lin[1], 0, 1)), b: fromLinear(clamp(lin[2], 0, 1)) });
  }

  // ---------- WCAG 2 contrast ----------

  function luminance(c) {
    return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
  }

  function contrast(hexA, hexB) {
    var a = luminance(hexToRgb(hexA)), b = luminance(hexToRgb(hexB));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  // The color closest to `fg` (same hue and chroma, only OKLCH lightness moves) that reaches
  // `target` contrast against `bg`, or null when no lightness can.
  function fixContrast(fg, bg, target) {
    if (contrast(fg, bg) >= target) return fg;
    var o = rgbToOklch(hexToRgb(fg)), best = null;
    [[0, o.l], [o.l, 1]].forEach(function (range, side) {
      var end = side ? 1 : 0;
      if (contrast(oklchToHex(end, o.c, o.h), bg) < target) return;
      // Contrast grows toward `end`: find the lightness nearest the original that passes.
      var pass = end, fail = o.l;
      for (var i = 0; i < 30; i++) {
        var mid = (pass + fail) / 2;
        if (contrast(oklchToHex(mid, o.c, o.h), bg) >= target) pass = mid; else fail = mid;
      }
      var hex = oklchToHex(pass, o.c, o.h);
      // Rounding to 8-bit can land just under the target: step on until it passes.
      for (var k = 0; k < 50 && contrast(hex, bg) < target; k++) { pass += side ? 0.002 : -0.002; hex = oklchToHex(pass, o.c, o.h); }
      if (contrast(hex, bg) >= target && (!best || Math.abs(pass - o.l) < best.d)) best = { hex: hex, d: Math.abs(pass - o.l) };
    });
    return best && best.hex;
  }

  // ---------- Shades and harmonies ----------

  // 50…950 like Tailwind: OKLCH lightness per step, chroma eased toward the light and dark ends.
  var STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  var STEP_L = [0.971, 0.936, 0.885, 0.808, 0.711, 0.623, 0.543, 0.468, 0.396, 0.338, 0.256];
  var STEP_C = [0.12, 0.25, 0.45, 0.7, 0.9, 1, 1, 0.92, 0.8, 0.68, 0.55];

  // The step nearest the base color in lightness is the base color itself (flagged base: true).
  function shades(hex) {
    var o = rgbToOklch(hexToRgb(hex)), nearest = 0;
    STEP_L.forEach(function (l, i) { if (Math.abs(l - o.l) < Math.abs(STEP_L[nearest] - o.l)) nearest = i; });
    return STEPS.map(function (step, i) {
      return i === nearest ? { step: step, hex: hex, base: true } : { step: step, hex: oklchToHex(STEP_L[i], o.c * STEP_C[i], o.h), base: false };
    });
  }

  // Hue turns (degrees, OKLCH) per scheme; lightness and chroma stay, the base comes first.
  var HARMONIES = { complementary: [180], analogous: [-30, 30], triadic: [120, 240], split: [150, 210] };

  function harmonies(hex) {
    var o = rgbToOklch(hexToRgb(hex)), out = {};
    Object.keys(HARMONIES).forEach(function (k) {
      out[k] = [hex].concat(HARMONIES[k].map(function (d) { return oklchToHex(o.l, o.c, (o.h + d + 360) % 360); }));
    });
    return out;
  }

  // Display strings for every format, keyed by format id.
  function formats(hex) {
    var c = hexToRgb(hex), hsl = rgbToHsl(c), hsb = rgbToHsb(c), k = rgbToCmyk(c), o = rgbToOklch(c);
    return {
      hex: hex.toUpperCase(),
      rgb: 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')',
      hsl: 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)',
      hsb: 'hsb(' + hsb.h + ', ' + hsb.s + '%, ' + hsb.b + '%)',
      oklch: 'oklch(' + (o.l * 100).toFixed(1) + '% ' + o.c.toFixed(3) + ' ' + o.h.toFixed(1) + ')',
      cmyk: 'cmyk(' + k.c + '%, ' + k.m + '%, ' + k.y + '%, ' + k.k + '%)'
    };
  }

  var api = {
    hexToRgb: hexToRgb, rgbToHex: rgbToHex, rgbToHsl: rgbToHsl, rgbToHsb: rgbToHsb, rgbToCmyk: rgbToCmyk,
    rgbToOklch: rgbToOklch, oklchToHex: oklchToHex, contrast: contrast, fixContrast: fixContrast,
    shades: shades, harmonies: harmonies, formats: formats
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ColorCore = api;
})(this);
