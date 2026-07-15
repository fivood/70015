# 70015

A small set of browser-based image tools. Everything runs locally; no files are uploaded.

## Tools

- **[Image Converter](https://70015.net/converter)** — convert to WebP / AVIF / JPEG / PNG / ICO, resize, compress, and download as ZIP.
- **[Image Size](https://70015.net/resize)** — crop a single image to a size or ratio, stitch multiple images together, or scale by exact dimensions.
- **[Color Palette](https://70015.net/palette)** — extract dominant colors from images or folders. Copy HEX, export JSON.
- **[Base64 Swap](https://70015.net/base64)** — encode images to Base64 Data URLs, or decode Base64 back to images.
- **[Web Snapshot](https://70015.net/snapshot)** — capture a region of any web page or PDF via screen sharing or PDF.js. Drag to select, stitch pages, export PNG.
- **[Color & Contrast](https://70015.net/color)** — pick colors from the screen with EyeDropper and check WCAG AA/AAA contrast.
- **[QR Code](https://70015.net/qr)** — turn a link or text into a QR. Adjustable size, margin, colors. Export PNG or SVG.
- **[SVG Tools](https://70015.net/svg)** — optimize SVG markup (strip cruft, minify) and convert SVG to PNG.
- **[Screenshot Annotate](https://70015.net/annotate)** — mark up images with arrows, boxes, text, highlights, and mosaic. Export PNG.
- **[SVG Editor](https://70015.net/editor)** — draw shapes, text, and freehand paths. Zoom/pan, grid, multi-select, alignment, gradients, rotation, flip. Undo/redo, import, export SVG or PNG.

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

## License

MIT © fivood
