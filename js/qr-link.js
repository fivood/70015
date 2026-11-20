/**
 * What a decoded QR code holds, and what to warn about before opening it.
 * Purely local: the URL is never fetched. Used by the screenshot result page
 * (extension/result/result.js); checked by .verify/qr-link.test.js.
 *
 * check(text) -> { kind: 'link' | 'text' | 'blocked', text, url?, host?, scheme?, file?, ext?,
 *                  warnings: [{ code, vars }], confirm: bool }
 *   link:    http(s) address that may be opened after a click
 *   text:    anything else harmless to show (plain text, Wi-Fi config, mailto:, tel: …)
 *   blocked: schemes that could run code or reach local files; shown, never opened
 *   confirm: true when opening needs a second click (programs and installers)
 */
(function (root) {
  'use strict';

  var BLOCKED = /^(javascript|data|vbscript|file|blob|filesystem|about|chrome|chrome-extension|moz-extension|edge|opera|brave|view-source|intent|ms-[a-z-]+|search-ms|jar):$/i;

  // Programs, installers, scripts and disk images: opening one can run code.
  var EXEC = ['exe', 'msi', 'msix', 'msixbundle', 'appx', 'appxbundle', 'appinstaller', 'bat', 'cmd', 'com', 'scr', 'pif',
    'cpl', 'msc', 'hta', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'ps1', 'psm1', 'reg', 'lnk', 'dll', 'jar',
    'apk', 'xapk', 'apks', 'aab', 'ipa', 'dmg', 'pkg', 'mpkg', 'app', 'deb', 'rpm', 'sh', 'run', 'bin', 'command',
    'iso', 'img', 'vhd', 'vhdx'];
  var MACRO = ['docm', 'dotm', 'xlsm', 'xltm', 'xlam', 'pptm', 'potm', 'ppam', 'ppsm'];
  var ARCHIVE = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'cab', 'arj', 'lzh'];

  // Common link shorteners: the real destination is hidden until the link is followed.
  var SHORTENERS = ['bit.ly', 'bitly.com', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'v.gd', 'buff.ly', 'cutt.ly',
    'rebrand.ly', 'rb.gy', 'shorturl.at', 'tiny.cc', 's.id', 't.ly', 'bl.ink', 'lnkd.in', 'qrco.de', 'qr.net', 'qrs.ly',
    't.cn', 'dwz.cn', 'url.cn', 'suo.im', 'sohu.gg', 'reurl.cc', '0rz.tw', 'pse.is', 'u.nu', 'x.gd', 'shorturl.asia'];

  function extOf(name) {
    var m = /\.([a-z0-9]{1,12})$/i.exec(name);
    return m ? m[1].toLowerCase() : '';
  }

  function check(raw) {
    var text = String(raw == null ? '' : raw).trim();
    var out = { kind: 'text', text: text, warnings: [], confirm: false };
    // Only something that already reads as "scheme:" is treated as a link; bare domains stay text.
    var m = /^([a-z][a-z0-9+.-]*):/i.exec(text);
    if (!m) return out;
    var scheme = m[1].toLowerCase() + ':';
    out.scheme = scheme;
    if (BLOCKED.test(scheme)) { out.kind = 'blocked'; return out; }
    if (scheme !== 'http:' && scheme !== 'https:') return out; // mailto:, tel:, WIFI:, otpauth: … shown as text
    var url;
    try { url = new URL(text); } catch (e) { return out; }
    if (/[\s<>"]/.test(text)) return out; // spaces or markup inside: not a clean address
    out.kind = 'link';
    out.url = url.href;
    out.host = url.hostname; // already punycode (xn--) for internationalized names
    var w = out.warnings;
    if (url.protocol === 'http:') w.push({ code: 'http' });
    if (url.username || url.password) w.push({ code: 'userinfo', vars: { host: url.hostname } });
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) || url.hostname.charAt(0) === '[') w.push({ code: 'ip' });
    if (url.hostname.split('.').some(function (p) { return p.indexOf('xn--') === 0; })) w.push({ code: 'punycode' });
    if (url.port) w.push({ code: 'port', vars: { port: url.port } });
    var bare = url.hostname.replace(/^www\./, '');
    if (SHORTENERS.indexOf(bare) >= 0) w.push({ code: 'short' });
    var last = '';
    try { last = decodeURIComponent(url.pathname.split('/').pop() || ''); } catch (e) { last = url.pathname.split('/').pop() || ''; }
    // Right-to-left override characters make "photo‮gpj.exe" display as "photoexe.jpg".
    if (/[‪-‮⁦-⁩‎‏]/.test(last)) {
      w.push({ code: 'bidi' });
      out.confirm = true;
      last = last.replace(/[‪-‮⁦-⁩‎‏]/g, '');
    }
    var ext = extOf(last);
    if (ext) {
      out.file = last;
      out.ext = ext;
      if (EXEC.indexOf(ext) >= 0) { w.push({ code: 'exec', vars: { ext: ext } }); out.confirm = true; }
      else if (MACRO.indexOf(ext) >= 0) { w.push({ code: 'macro', vars: { ext: ext } }); out.confirm = true; }
      else if (ARCHIVE.indexOf(ext) >= 0) w.push({ code: 'archive', vars: { ext: ext } });
    }
    return out;
  }

  var api = { check: check };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QrLink = api;
})(this);
