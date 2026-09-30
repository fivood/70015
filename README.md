# 70015

A small set of browser-based image tools. Everything runs locally; no files are uploaded.

## Tools

- **[Image Metadata](https://70015.net/metadata)** — view EXIF details and remove embedded metadata locally before sharing.
- **[Quick Image Editor](https://70015.net/image-editor)** — rotate, flip, crop, style, blur, mosaic, and watermark images locally.

- **[Image Converter](https://70015.net/converter)** — convert to WebP / AVIF / JPEG / PNG / ICO, resize, compress, and download as ZIP.
- **[Image Size](https://70015.net/resize)** — crop a single image to a size or ratio, stitch multiple images together, or scale by exact dimensions.
- **[Web Snapshot](https://70015.net/snapshot)** — capture a region of any web page or PDF via screen sharing or PDF.js. Drag to select, stitch pages, export PNG.
- **[Screenshot Annotation](https://70015.net/annotate)** — mark up images with arrows, boxes, text, highlights, and mosaic. Export PNG.
- **[Color & Contrast](https://70015.net/color)** — pick colors from the screen with EyeDropper and check WCAG AA/AAA contrast.
- **[Color Palette](https://70015.net/palette)** — extract dominant colors from images or folders. Copy HEX, export JSON.
- **[Base64 Converter](https://70015.net/base64)** — encode images to Base64 Data URLs, or decode Base64 back to images.
- **[QR Code](https://70015.net/qr)** — turn a link or text into a QR. Adjustable size, margin, colors. Export PNG or SVG.
- **[SVG Tools](https://70015.net/svg)** — optimize SVG markup, remove editor metadata, minify, and convert SVG to PNG.
- **[SVG Editor](https://70015.net/editor)** — draw shapes, text, and freehand paths. Zoom/pan, grid, multi-select, alignment, gradients, rotation, flip. Undo/redo, import, export SVG or PNG.
- **[Isometric Studio](https://70015.net/isometric)** — 2.5D isometric room modeling, 3D box extrusion, plane drawing, 3D surface texture brush, and 2D floorplan extrusion. No upload.

## Why

Most image tools upload your files to a server. These tools don't. They use the HTML5 Canvas API and run entirely in your browser.

## Live

- https://70015.net
- https://70015.pages.dev
- https://fivood.github.io/70015/

## Run locally

```bash
git clone https://github.com/fivood/70015.git
cd 70015
npx serve .
```

## Browser extension (Chrome, Edge, Firefox)

The extension bundles every tool page plus visible / full-page / scrolling-selection screenshots.
Tool pages are shared with the site; `extension/` holds only the extension-specific parts.

```bash
node extension/build.js         # builds dist/extension (Chrome, Edge) and dist/firefox
node extension/build.js --zip   # also writes store-ready zips into dist/
```

| Browser | Load for testing | Store upload |
| --- | --- | --- |
| Chrome / Edge | `chrome://extensions` → Developer mode → **Load unpacked** → the extracted folder | `downloads/70015-chromium.zip`, offered at <https://70015.net/install> |
| Edge | `edge://extensions` → Developer mode → **Load unpacked** → `dist/extension` | same zip as Chrome |
| Firefox 140+ | `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `dist/firefox/manifest.json` | `dist/70015-firefox-<version>.zip` |

Rebuild and reload the extension after every change. The source `extension/` folder has no
`manifest.json` on purpose (only `manifest.src.json`), so it can't be loaded by mistake; the build
writes a per-browser manifest (Firefox gets an event-page background and a gecko id).
Check the Firefox build with `npx web-ext lint --source-dir dist/firefox`.

Third-party libraries are self-hosted in `vendor/` (see `vendor/README.md`), since extensions can't load remote scripts.

## License

MIT © fivood
