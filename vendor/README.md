# Vendored libraries

Unmodified files from the npm registry (`npm pack`), self-hosted so the site
needs no CDN and the Chrome extension (which forbids remote scripts) can reuse them.

| File | Package | License |
| --- | --- | --- |
| jszip.min.js | jszip@3.10.1 `dist/` | MIT or GPL-3.0 |
| FileSaver.min.js | file-saver@2.0.5 `dist/` | MIT |
| exifr.full.umd.js | exifr@7.1.3 `dist/full.umd.js` | MIT |
| jsQR.js | jsqr@1.4.0 `dist/` | Apache-2.0 |
| pdf.min.js, pdf.worker.min.js | pdfjs-dist@3.11.174 `build/` | Apache-2.0 |
| qrcode.js | qrcode-generator@1.4.4 | MIT |

To upgrade: `npm pack <pkg>@<version>`, extract, copy the same file over, and
bump the version here.
