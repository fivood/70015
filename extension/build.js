// Assemble the browser extension: the site's tool pages + extension files.
//   dist/extension/  Chrome and Edge (Chromium)
//   dist/firefox/    Firefox
// Usage: node extension/build.js [--zip]
//   --zip writes the Chromium zip into downloads/ (the site deploys it and links it
//   from /install) and the Firefox zip into dist/ for local testing.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.src.json'), 'utf8'));

// Only the manifest differs between browsers.
const TARGETS = {
  extension: (m) => m, // Chromium: service worker background
  firefox: (m) => {
    // Firefox runs MV3 backgrounds as event pages, not service workers, so the
    // shared export.js is listed here instead of importScripts().
    m.background = { scripts: ['js/export.js', 'background/background.js'] };
    m.browser_specific_settings = {
      gecko: {
        id: '70015-image-tools@70015.net',
        strict_min_version: '140.0',
        data_collection_permissions: { required: ['none'] }
      },
      // data_collection_permissions needs 142 on Android (lint warns otherwise).
      gecko_android: { strict_min_version: '142.0' }
    };
    return m;
  }
};

const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
const names = pages.map((f) => f.slice(0, -5));
const linkRe = new RegExp('href="(\\./|' + names.join('|') + ')"', 'g');

function build(target) {
  const out = path.join(root, 'dist', target);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const copy = (from, to) => fs.cpSync(path.join(root, from), path.join(out, to || from), { recursive: true });

  // Site assets shared with the extension pages.
  ['css', 'js', 'vendor', 'icons', 'logo.svg', 'favicon.ico'].forEach((p) => copy(p));
  // Extension-only files (its icons merge into icons/).
  ['background', 'content', 'popup', 'result', '_locales', 'icons'].forEach((p) => copy('extension/' + p, p));

  // The source folder deliberately has no manifest.json, so a browser refuses to load it
  // (it would half-work without the shared js/ files); only dist/* is loadable.
  const manifest = TARGETS[target](JSON.parse(JSON.stringify(source)));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  // Tool pages: extension URLs need the .html suffix Cloudflare adds for the site.
  for (const file of pages) {
    const html = fs.readFileSync(path.join(root, file), 'utf8')
      .replace(linkRe, (m, name) => 'href="' + (name === './' ? 'index' : name) + '.html"')
      .replace(/\s*<link rel="manifest"[^>]*>/, '') // PWA manifest is meaningless inside an extension
      // The download page states the version the zip was built from.
      .replace(/\{\{VERSION\}\}/g, manifest.version);
    fs.writeFileSync(path.join(out, file), html);
  }
  console.log('Built dist/' + target + ' (v' + manifest.version + ', ' + pages.length + ' pages)');
  return out;
}

function listFiles(dir, base) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? base + '/' + e.name : e.name;
    return e.isDirectory() ? listFiles(path.join(dir, e.name), rel) : [rel];
  });
}

// Minimal zip writer (deflate). Entry names always use '/', which the stores require.
function zipDir(dir, zipPath) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const name of listFiles(dir)) {
    const data = fs.readFileSync(path.join(dir, name));
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(data);
    // version, flags (bit 11 = UTF-8 names), method 8 = deflate, time, date (1980-01-01), crc, sizes, name length
    const common = [[20, 2], [0x0800, 2], [8, 2], [0, 2], [0x21, 2], [crc, 4], [packed.length, 4], [data.length, 4], [nameBuf.length, 2]];
    const fields = (list) => Buffer.concat(list.map(([v, n]) => { const b = Buffer.alloc(n); n === 2 ? b.writeUInt16LE(v) : b.writeUInt32LE(v >>> 0); return b; }));
    const local = Buffer.concat([fields([[0x04034b50, 4]].concat(common, [[0, 2]])), nameBuf, packed]);
    centrals.push(Buffer.concat([fields([[0x02014b50, 4], [20, 2]].concat(common, [[0, 2], [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]])), nameBuf]));
    locals.push(local);
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  fs.writeFileSync(zipPath, Buffer.concat(locals.concat([central, end])));
  console.log('Zipped ' + path.relative(root, zipPath) + ' (' + centrals.length + ' files)');
}

for (const target of Object.keys(TARGETS)) {
  const out = build(target);
  if (process.argv.includes('--zip')) {
    // The Chromium build is what the site offers, so it gets a stable, version-free
    // name under downloads/: the /install page can link it directly.
    const dest = target === 'extension'
      ? path.join(root, 'downloads', '70015-chromium.zip')
      : path.join(root, 'dist', '70015-firefox-' + source.version + '.zip');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    zipDir(out, dest);
  }
}
