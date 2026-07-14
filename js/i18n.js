/**
 * 70015 i18n -- Chinese/English language toggle
 * Auto-creates a toggle button in the header.
 * Exposes window.t(key) for JS-generated text.
 */
(function () {
  'use strict';

  var STRINGS = {
    en: {
      // Common -- header, footer, menu
      'brand': 'TOOLS',
      'footer': '@70015',
      'lang_btn': '\u4e2d\u6587',
      'theme': 'Toggle theme',
      'menu_open': 'Open menu',
      'menu_close': 'Close menu',
      'menu_title': '70015',

      // Home
      'home_title': '70015 \u2014 Online image tools',
      'home_og_desc': 'Browser-based image tools. Convert, edit, and export images locally. No upload.',
      'home_tools': 'Tools',
      'home_count': '9 tools',
      'home_intro': 'A small set of browser-based image tools. Everything runs locally \u2014 no uploads, no servers.',
      't_converter': 'Image Converter',
      'd_converter': 'Batch convert to WebP / AVIF / JPEG / PNG / ICO. Resize, compress, zip.',
      't_palette': 'Color Palette',
      'd_palette': 'Extract dominant colors from images. Copy HEX, export JSON.',
      't_base64': 'Base64 Swap',
      'd_base64': 'Image \u2192 Base64 Data URL, or paste Base64 to get the image back.',
      't_snapshot': 'Web Snapshot',
      'd_snapshot': 'Screenshot a web page or PDF region. Screen share or open a PDF, drag to select, export PNG.',
      't_color': 'Color & Contrast',
      'd_color': 'Pick colors from the screen and check WCAG AA/AAA contrast.',
      't_qr': 'QR Code',
      'd_qr': 'Turn a link or text into a QR. Pick size, margin, colors, export PNG or SVG.',
      't_svg': 'SVG Tools',
      'd_svg': 'Optimize SVG markup and convert SVG to PNG. Strip cruft, minify.',
      't_annotate': 'Screenshot Annotate',
      'd_annotate': 'Mark up images with arrows, boxes, text, highlights, and mosaic. Export PNG.',
      't_editor': 'SVG Editor',
      'd_editor': 'Draw shapes, text, and freehand paths. Zoom, pan, grid, multi-select, gradients, rotation. Export SVG or PNG.',

      // Converter
      'conv_title': 'Image Converter \u2014 70015',
      'conv_hero': 'Image Converter',
      'conv_desc': 'Batch convert to WebP, AVIF, JPEG, PNG, or ICO. Resize, compress, and download as ZIP.',
      'conv_drop': 'Drop images here or click to upload',
      'conv_hint': 'Multiple images and folders supported',
      'conv_presets': 'Presets auto-fill format, size, and fit.',
      'conv_format': 'Output format',
      'conv_quality': 'Quality',
      'conv_resize': 'Resize',
      'conv_ico_sizes': 'ICO sizes',
      'conv_non_square': 'Non-square images',
      'conv_cover': 'Cover',
      'conv_contain': 'Contain',
      'conv_cover_note': 'Cover crops to fill; Contain scales with transparent padding.',
      'conv_fit': 'Fit',
      'conv_clear': 'Clear',
      'conv_zip': 'Download ZIP',
      'conv_download': 'Download',
      'conv_remove': 'Remove',
      'conv_original': 'Original',
      'conv_width': 'By width',
      'conv_height': 'By height',
      'conv_max': 'Max edge',
      'conv_custom': 'Custom',
      'conv_target_w': 'Target width px',
      'conv_target_h': 'Target height px',
      'conv_max_edge': 'Max edge px',
      'conv_w_px': 'Width px',
      'conv_h_px': 'Height px',
      'conv_n_images': '0 images',
      'conv_note_webp': 'WebP offers the best size-to-compatibility ratio.',
      'conv_note_avif': 'AVIF has the highest compression, but export requires a supported browser; otherwise falls back to WebP.',
      'conv_note_jpeg': 'JPEG is the most compatible format for photos; transparent areas become white.',
      'conv_note_png': 'PNG is lossless and keeps transparency, but files are usually larger.',
      'conv_note_ico': 'ICO is used for favicons. Include 32\u00d732 and 256\u00d7256 for best coverage.',
      'conv_p_custom': 'Custom',
      'conv_p_webp': 'WebP only',
      'conv_p_blog': 'Blog cover 1200\u00d7630',
      'conv_p_thumb': 'Thumbnail 300\u00d7300',
      'conv_p_social': 'Social 1080\u00d71080',
      'conv_p_favicon': 'Favicon ICO',
      'conv_s_converting': 'Converting',
      'conv_s_failed': 'Failed',
      'conv_s_done': 'Done',
      'conv_s_pending': 'Pending',

      // Base64
      'b64_title': 'Base64 Swap \u2014 70015',
      'b64_hero': 'Base64 Swap',
      'b64_desc': 'Convert images to Base64 Data URLs or decode Base64 back to images. Runs in your browser.',
      'b64_drop': 'Drop images here or click to upload',
      'b64_hint': 'Multiple images supported',
      'b64_img2b64': 'Image \u2192 Base64',
      'b64_b642img': 'Base64 \u2192 Image',
      'b64_prefix': 'Include data:image/xxx;base64, prefix',
      'b64_placeholder': 'Supports data:image/...;base64,xxx or raw Base64',
      'b64_preview_hint': 'Preview updates automatically.',
      'b64_parsed': 'Parsed. Click the button to download the image.',
      'b64_parse_fail': 'Could not parse this Base64 content.',
      'b64_copy': 'Copy',
      'b64_dl_txt': 'Download .txt',
      'b64_remove': 'Remove',
      'b64_dl_img': 'Download image',
      'b64_len': 'Base64 length',

      // Palette
      'pal_title': 'Color Palette \u2014 70015',
      'pal_hero': 'Color Palette',
      'pal_desc': 'Extract dominant colors from images. Copy HEX values, export as JSON.',
      'pal_drop': 'Drop images here or click to upload',
      'pal_hint': 'Multiple images supported',
      'pal_count': 'Color count',
      'pal_precision': 'Sample precision',
      'pal_export': 'Export JSON',
      'pal_clear': 'Clear',
      'pal_copy_css': 'Copy CSS',
      'pal_remove': 'Remove',

      // Color & Contrast
      'col_title': 'Color & Contrast \u2014 70015',
      'col_hero': 'Color & Contrast',
      'col_desc': 'Pick colors from the screen with EyeDropper and check WCAG AA/AAA contrast.',
      'col_fg': 'Foreground',
      'col_bg': 'Background',
      'col_ratio': 'Contrast ratio',
      'col_swap': 'Swap FG \u2194 BG',
      'col_pick_fg': 'Pick from screen',
      'col_pick_bg': 'Pick from screen',
      'col_wcag': 'WCAG Compliance',
      'col_aa_n': 'AA normal',
      'col_aa_l': 'AA large',
      'col_aaa_n': 'AAA normal',
      'col_aaa_l': 'AAA large',
      'col_pick_hint': 'Screen picker needs desktop Chrome/Edge. Click a swatch or HEX to choose colors.',

      // QR
      'qr_title': 'QR Code \u2014 70015',
      'qr_hero': 'QR Code',
      'qr_desc': 'Turn a link or text into a QR code. Adjustable size, margin, and colors. Export PNG or SVG.',
      'qr_text': 'Text or URL',
      'qr_ecl': 'Error correction',
      'qr_cell': 'Cell size',
      'qr_margin': 'Margin',
      'qr_dark': 'Dark',
      'qr_light': 'Light',
      'qr_transparent': 'Transparent background',
      'qr_png': 'Download PNG',
      'qr_svg': 'Download SVG',
      'qr_placeholder': 'Enter a URL or text to generate a QR code',

      // SVG Tools
      'svg_title': 'SVG Tools \u2014 70015',
      'svg_hero': 'SVG Tools',
      'svg_desc': 'Optimize SVG markup (strip cruft, minify) and convert SVG to PNG.',
      'svg_paste': 'Paste SVG markup or upload an .svg file',
      'svg_strip_comments': 'Strip comments',
      'svg_strip_editor': 'Strip editor metadata',
      'svg_collapse_ws': 'Collapse whitespace',
      'svg_remove_decl': 'Remove XML declaration',
      'svg_copy': 'Copy',
      'svg_download': 'Download SVG',
      'svg_export_png': 'Export PNG',
      'svg_scale': 'PNG scale',
      'svg_preview': 'Preview will appear here',
      'svg_invalid': 'Invalid SVG markup',
      'svg_paste_hint': 'Paste or upload an SVG to begin.',

      // Annotate
      'ann_title': 'Screenshot Annotate \u2014 70015',
      'ann_hero': 'Screenshot Annotate',
      'ann_desc': 'Mark up images with arrows, boxes, text, highlights, and mosaic. Export PNG.',
      'ann_drop': 'Drop an image here or click to upload',
      'ann_hint': 'Or paste from clipboard (Ctrl+V)',
      'ann_rect': 'Rectangle',
      'ann_arrow': 'Arrow',
      'ann_line': 'Line',
      'ann_pen': 'Pen',
      'ann_highlight': 'Highlight',
      'ann_text': 'Text',
      'ann_mosaic': 'Mosaic',
      'ann_color': 'Color',
      'ann_width': 'Width',
      'ann_font': 'Font',
      'ann_undo': 'Undo',
      'ann_redo': 'Redo',
      'ann_clear': 'Clear all',
      'ann_replace': 'Replace image',
      'ann_export': 'Export PNG',
      'ann_hint_rect': 'Drag to draw a rectangle outline.',
      'ann_hint_arrow': 'Drag from tail to head of the arrow.',
      'ann_hint_line': 'Drag to draw a straight line.',
      'ann_hint_pen': 'Draw freehand strokes.',
      'ann_hint_highlight': 'Semi-transparent strokes. Pick a bright color.',
      'ann_hint_text': 'Click where you want text, then type and press Enter.',
      'ann_hint_mosaic': 'Drag a box to pixelate the area underneath.',

      // Snapshot
      'snp_title': 'Web Snapshot \u2014 70015',
      'snp_hero': 'Web Snapshot',
      'snp_desc': 'Capture a region of any web page via screen sharing. Drag to select, export PNG.',
      'snp_start': 'Start capture',
      'snp_stop': 'Stop sharing',
      'snp_full': 'Capture full frame',
      'snp_screen': 'Screen',
      'snp_pdf': 'PDF',
      'snp_screen_note': 'Share a tab or screen for live capture.',
      'snp_pdf_note': 'Open a local PDF (or print-to-PDF a long page) to capture or stitch pages.',
      'snp_pdf_drop': 'Drop a PDF here or click to upload',
      'snp_pdf_hint': 'Rendered locally with PDF.js \u2014 nothing is uploaded',
      'snp_stitch': 'Stitch all pages',
      'snp_pdf_clear': 'Clear',
      'snp_prev': 'Prev',
      'snp_next': 'Next',
      'snp_region': 'Selected region',
      'snp_copy': 'Copy',
      'snp_download': 'Download PNG',
      'snp_add_stitch': '+ Stitch',
      'snp_stitched': 'Stitched image',
      'snp_segments': '0 segments',
      'snp_dl_stitch': 'Download stitched PNG',
      'snp_clear_stitch': 'Clear stitch',
      'snp_hint': 'Click "Start capture" and pick a tab or window to share.',
      'snp_drag_hint': 'Drag on the preview to select a region. Release to capture.',
      'snp_result_note': 'Drag on the preview above to capture a different region. Click "+ Stitch" to append, then scroll and capture again.',
      'snp_pdf_tip': "Tip: for long web pages, use your browser's Print \u2192 Save as PDF, then open it here to capture or stitch all pages.",

      // Editor
      'ed_title': 'SVG Editor \u2014 70015',
      'ed_hero': 'SVG Editor',
      'ed_desc': 'Draw and edit SVG in your browser. Shapes, text, freehand paths, gradients, multi-select, align, grid, zoom. Export SVG or PNG. No upload.',
      'ed_hint': 'Pick a tool and drag on the canvas. Scroll to zoom, Space+drag to pan. Use Properties to adjust fill, stroke, opacity, and gradients per element. Shortcuts: 1-8 switch tools.',
      'ed_props': 'Properties',
      'ed_no_select': 'Nothing selected',
      'ed_source': 'Source',
      'ed_copy_code': 'Copy',
      'ed_import': 'Import',
      'ed_clear': 'Clear',
      'ed_svg': 'SVG',
      'ed_png': 'PNG',
      'ed_layers': 'Layers',
      'ed_no_elements': 'No elements yet',

      // Menu labels (for menu-data.js)
      'm_home': 'Home',
      'm_converter': 'Image Converter',
      'm_palette': 'Color Palette',
      'm_color': 'Color & Contrast',
      'm_base64': 'Base64 Swap',
      'm_svg': 'SVG Tools',
      'm_qr': 'QR Code',
      'm_annotate': 'Screenshot Annotate',
      'm_snapshot': 'Web Snapshot',
      'm_editor': 'SVG Editor',

      // Toast messages
      'toast_copied': 'Copied',
      'toast_copy_fail': 'Copy failed',
      'toast_deleted': 'Deleted',
      'toast_cleared': 'Cleared',
      'toast_exported': 'Exported',
      'toast_imported': 'Imported',
      'toast_applied': 'Source applied',
      'toast_invalid': 'Invalid SVG',
      'toast_grouped': 'Grouped',
      'toast_ungrouped': 'Ungrouped',
      'toast_duplicated': 'Duplicated'
    },

    zh: {
      'brand': '\u5de5\u5177',
      'footer': '@70015',
      'lang_btn': 'EN',
      'theme': '\u5207\u6362\u4e3b\u9898',
      'menu_open': '\u6253\u5f00\u83dc\u5355',
      'menu_close': '\u5173\u95ed\u83dc\u5355',
      'menu_title': '70015',

      'home_title': '70015 \u2014 \u5728\u7ebf\u56fe\u7247\u5de5\u5177',
      'home_og_desc': '\u6d4f\u89c8\u5668\u7aef\u56fe\u7247\u5de5\u5177\u3002\u8f6c\u6362\u3001\u7f16\u8f91\u3001\u5bfc\u51fa\u56fe\u7247\uff0c\u5168\u90e8\u672c\u5730\u8fd0\u884c\uff0c\u65e0\u4e0a\u4f20\u3002',
      'home_tools': '\u5de5\u5177',
      'home_count': '9 \u4e2a\u5de5\u5177',
      'home_intro': '\u4e00\u5957\u57fa\u4e8e\u6d4f\u89c8\u5668\u7684\u56fe\u7247\u5de5\u5177\u3002\u5168\u90e8\u672c\u5730\u8fd0\u884c\uff0c\u65e0\u4e0a\u4f20\uff0c\u65e0\u670d\u52a1\u5668\u3002',

      't_converter': '\u56fe\u7247\u8f6c\u6362',
      'd_converter': '\u6279\u91cf\u8f6c\u6362\u4e3a WebP / AVIF / JPEG / PNG / ICO\u3002\u8c03\u6574\u5c3a\u5bf8\u3001\u538b\u7f29\u3001\u6253\u5305\u4e0b\u8f7d\u3002',
      't_palette': '\u8c03\u8272\u677f',
      'd_palette': '\u4ece\u56fe\u7247\u4e2d\u63d0\u53d6\u4e3b\u8272\u3002\u590d\u5236 HEX\uff0c\u5bfc\u51fa JSON\u3002',
      't_base64': 'Base64 \u8f6c\u6362',
      'd_base64': '\u56fe\u7247 \u2192 Base64\uff0c\u6216\u7c98\u8d34 Base64 \u8fd8\u539f\u56fe\u7247\u3002',
      't_snapshot': '\u7f51\u9875\u622a\u56fe',
      'd_snapshot': '\u622a\u53d6\u7f51\u9875\u6216 PDF \u533a\u57df\u3002\u5c4f\u5e55\u5171\u4eab\u6216\u6253\u5f00 PDF\uff0c\u62d6\u62fd\u9009\u533a\uff0c\u5bfc\u51fa PNG\u3002',
      't_color': '\u989c\u8272\u5bf9\u6bd4',
      'd_color': '\u4ece\u5c4f\u5e55\u53d6\u8272\u5e76\u68c0\u67e5 WCAG AA/AAA \u5bf9\u6bd4\u5ea6\u3002',
      't_qr': '\u4e8c\u7ef4\u7801',
      'd_qr': '\u5c06\u94fe\u63a5\u6216\u6587\u672c\u751f\u6210\u4e8c\u7ef4\u7801\u3002\u53ef\u8c03\u5c3a\u5bf8\u3001\u8fb9\u8ddd\u3001\u989c\u8272\uff0c\u5bfc\u51fa PNG \u6216 SVG\u3002',
      't_svg': 'SVG \u5de5\u5177',
      'd_svg': '\u4f18\u5316 SVG \u4ee3\u7801\uff08\u53bb\u9664\u5197\u4f59\u3001\u538b\u7f29\uff09\u5e76\u8f6c\u6362\u4e3a PNG\u3002',
      't_annotate': '\u622a\u56fe\u6807\u6ce8',
      'd_annotate': '\u7528\u7bad\u5934\u3001\u77e9\u5f62\u3001\u6587\u5b57\u3001\u9ad8\u4eae\u3001\u9a6c\u8d5b\u514b\u6807\u6ce8\u56fe\u7247\u3002\u5bfc\u51fa PNG\u3002',
      't_editor': 'SVG \u7f16\u8f91\u5668',
      'd_editor': '\u7ed8\u5236\u56fe\u5f62\u3001\u6587\u5b57\u3001\u624b\u7ed8\u8def\u5f84\u3002\u7f29\u653e\u3001\u5e73\u79fb\u3001\u7f51\u683c\u3001\u591a\u9009\u3001\u6e10\u53d8\u3001\u65cb\u8f6c\u3002\u5bfc\u51fa SVG \u6216 PNG\u3002',

      'conv_title': '\u56fe\u7247\u8f6c\u6362 \u2014 70015',
      'conv_hero': '\u56fe\u7247\u8f6c\u6362',
      'conv_desc': '\u6279\u91cf\u8f6c\u6362\u4e3a WebP\u3001AVIF\u3001JPEG\u3001PNG \u6216 ICO\u3002\u8c03\u6574\u5c3a\u5bf8\u3001\u538b\u7f29\uff0c\u6253\u5305\u4e0b\u8f7d\u3002',
      'conv_drop': '\u62d6\u62fd\u56fe\u7247\u5230\u6b64\u5904\u6216\u70b9\u51fb\u4e0a\u4f20',
      'conv_hint': '\u652f\u6301\u591a\u5f20\u56fe\u7247\u548c\u6587\u4ef6\u5939',
      'conv_presets': '\u9884\u8bbe\u81ea\u52a8\u586b\u5199\u683c\u5f0f\u3001\u5c3a\u5bf8\u548c\u62df\u5408\u65b9\u5f0f\u3002',
      'conv_format': '\u8f93\u51fa\u683c\u5f0f',
      'conv_quality': '\u8d28\u91cf',
      'conv_resize': '\u8c03\u6574\u5c3a\u5bf8',
      'conv_ico_sizes': 'ICO \u5c3a\u5bf8',
      'conv_non_square': '\u975e\u65b9\u5f62\u56fe\u7247',
      'conv_cover': '\u88c1\u526a',
      'conv_contain': '\u7f29\u653e',
      'conv_cover_note': '\u88c1\u526a\u586b\u5145\u753b\u5e03\uff1b\u7f29\u653e\u4fdd\u6301\u6bd4\u4f8b\u5e76\u900f\u660e\u586b\u5145\u3002',
      'conv_fit': '\u62df\u5408',
      'conv_clear': '\u6e05\u9664',
      'conv_zip': '\u4e0b\u8f7d ZIP',
      'conv_download': '\u4e0b\u8f7d',
      'conv_remove': '\u5220\u9664',
      'conv_original': '\u539f\u59cb',
      'conv_width': '\u6309\u5bbd\u5ea6',
      'conv_height': '\u6309\u9ad8\u5ea6',
      'conv_max': '\u6700\u5927\u8fb9',
      'conv_custom': '\u81ea\u5b9a\u4e49',
      'conv_target_w': '\u76ee\u6807\u5bbd\u5ea6 px',
      'conv_target_h': '\u76ee\u6807\u9ad8\u5ea6 px',
      'conv_max_edge': '\u6700\u5927\u8fb9 px',
      'conv_w_px': '\u5bbd\u5ea6 px',
      'conv_h_px': '\u9ad8\u5ea6 px',
      'conv_n_images': '0 \u5f20\u56fe\u7247',
      'conv_note_webp': 'WebP \u5728\u538b\u7f29\u7387\u548c\u517c\u5bb9\u6027\u4e4b\u95f4\u5e73\u8861\u6700\u4f73\u3002',
      'conv_note_avif': 'AVIF \u538b\u7f29\u7387\u6700\u9ad8\uff0c\u4f46\u9700\u6d4f\u89c8\u5668\u652f\u6301\uff1b\u4e0d\u652f\u6301\u65f6\u81ea\u52a8\u964d\u7ea7\u4e3a WebP\u3002',
      'conv_note_jpeg': 'JPEG \u662f\u7167\u7247\u6700\u517c\u5bb9\u7684\u683c\u5f0f\uff1b\u900f\u660e\u533a\u57df\u4f1a\u53d8\u6210\u767d\u8272\u3002',
      'conv_note_png': 'PNG \u65e0\u635f\u4e14\u4fdd\u7559\u900f\u660e\u901a\u9053\uff0c\u4f46\u6587\u4ef6\u8f83\u5927\u3002',
      'conv_note_ico': 'ICO \u7528\u4e8e\u7f51\u7ad9 favicon\u3002\u5efa\u8bae\u540c\u65f6\u5305\u542b 32\u00d732 \u548c 256\u00d7256\u3002',
      'conv_p_custom': '\u81ea\u5b9a\u4e49',
      'conv_p_webp': '\u4ec5 WebP',
      'conv_p_blog': '\u535a\u5ba2\u5c01\u9762 1200\u00d7630',
      'conv_p_thumb': '\u7f29\u7565\u56fe 300\u00d7300',
      'conv_p_social': '\u793e\u4ea4\u56fe 1080\u00d71080',
      'conv_p_favicon': 'Favicon ICO',
      'conv_s_converting': '\u8f6c\u6362\u4e2d',
      'conv_s_failed': '\u5931\u8d25',
      'conv_s_done': '\u5b8c\u6210',
      'conv_s_pending': '\u7b49\u5f85',

      'b64_title': 'Base64 \u8f6c\u6362 \u2014 70015',
      'b64_hero': 'Base64 \u8f6c\u6362',
      'b64_desc': '\u5c06\u56fe\u7247\u8f6c\u4e3a Base64 \u6216\u5c06 Base64 \u8fd8\u539f\u4e3a\u56fe\u7247\u3002\u5168\u90e8\u5728\u6d4f\u89c8\u5668\u4e2d\u5b8c\u6210\u3002',
      'b64_drop': '\u62d6\u62fd\u56fe\u7247\u5230\u6b64\u5904\u6216\u70b9\u51fb\u4e0a\u4f20',
      'b64_hint': '\u652f\u6301\u591a\u5f20\u56fe\u7247',
      'b64_img2b64': '\u56fe\u7247 \u2192 Base64',
      'b64_b642img': 'Base64 \u2192 \u56fe\u7247',
      'b64_prefix': '\u5305\u542b data:image/xxx;base64, \u524d\u7f00',
      'b64_placeholder': '\u652f\u6301 data:image/...;base64,xxx \u6216\u7eaf Base64',
      'b64_preview_hint': '\u9884\u89c8\u81ea\u52a8\u66f4\u65b0\u3002',
      'b64_parsed': '\u5df2\u89e3\u6790\u3002\u70b9\u51fb\u6309\u94ae\u4e0b\u8f7d\u56fe\u7247\u3002',
      'b64_parse_fail': '\u65e0\u6cd5\u89e3\u6790\u6b64 Base64 \u5185\u5bb9\u3002',
      'b64_copy': '\u590d\u5236',
      'b64_dl_txt': '\u4e0b\u8f7d .txt',
      'b64_remove': '\u5220\u9664',
      'b64_dl_img': '\u4e0b\u8f7d\u56fe\u7247',
      'b64_len': 'Base64 \u957f\u5ea6',

      'pal_title': '\u8c03\u8272\u677f \u2014 70015',
      'pal_hero': '\u8c03\u8272\u677f',
      'pal_desc': '\u4ece\u56fe\u7247\u4e2d\u63d0\u53d6\u4e3b\u8272\u3002\u590d\u5236 HEX \u503c\uff0c\u5bfc\u51fa JSON\u3002',
      'pal_drop': '\u62d6\u62fd\u56fe\u7247\u5230\u6b64\u5904\u6216\u70b9\u51fb\u4e0a\u4f20',
      'pal_hint': '\u652f\u6301\u591a\u5f20\u56fe\u7247',
      'pal_count': '\u989c\u8272\u6570\u91cf',
      'pal_precision': '\u91c7\u6837\u7cbe\u5ea6',
      'pal_export': '\u5bfc\u51fa JSON',
      'pal_clear': '\u6e05\u9664',
      'pal_copy_css': '\u590d\u5236 CSS',
      'pal_remove': '\u5220\u9664',

      'col_title': '\u989c\u8272\u5bf9\u6bd4 \u2014 70015',
      'col_hero': '\u989c\u8272\u5bf9\u6bd4',
      'col_desc': '\u4ece\u5c4f\u5e55\u53d6\u8272\u5e76\u68c0\u67e5 WCAG AA/AAA \u5bf9\u6bd4\u5ea6\u3002',
      'col_fg': '\u524d\u666f',
      'col_bg': '\u80cc\u666f',
      'col_ratio': '\u5bf9\u6bd4\u5ea6',
      'col_swap': '\u4ea4\u6362\u524d\u540e\u666f \u2194',
      'col_pick_fg': '\u5c4f\u5e55\u53d6\u8272',
      'col_pick_bg': '\u5c4f\u5e55\u53d6\u8272',
      'col_wcag': 'WCAG \u5408\u89c4',
      'col_aa_n': 'AA \u6b63\u5e38',
      'col_aa_l': 'AA \u5927\u5b57',
      'col_aaa_n': 'AAA \u6b63\u5e38',
      'col_aaa_l': 'AAA \u5927\u5b57',
      'col_pick_hint': '\u5c4f\u5e55\u53d6\u8272\u9700\u8981\u684c\u9762\u7248 Chrome/Edge\u3002\u70b9\u51fb\u8272\u5757\u6216 HEX \u6765\u9009\u8272\u3002',

      'qr_title': '\u4e8c\u7ef4\u7801 \u2014 70015',
      'qr_hero': '\u4e8c\u7ef4\u7801',
      'qr_desc': '\u5c06\u94fe\u63a5\u6216\u6587\u672c\u751f\u6210\u4e8c\u7ef4\u7801\u3002\u53ef\u8c03\u5c3a\u5bf8\u3001\u8fb9\u8ddd\u3001\u989c\u8272\uff0c\u5bfc\u51fa PNG \u6216 SVG\u3002',
      'qr_text': '\u6587\u672c\u6216\u94fe\u63a5',
      'qr_ecl': '\u7ea0\u9519\u7b49\u7ea7',
      'qr_cell': '\u5355\u5143\u5c3a\u5bf8',
      'qr_margin': '\u8fb9\u8ddd',
      'qr_dark': '\u6df1\u8272',
      'qr_light': '\u6d45\u8272',
      'qr_transparent': '\u900f\u660e\u80cc\u666f',
      'qr_png': '\u4e0b\u8f7d PNG',
      'qr_svg': '\u4e0b\u8f7d SVG',
      'qr_placeholder': '\u8f93\u5165\u94fe\u63a5\u6216\u6587\u672c\u751f\u6210\u4e8c\u7ef4\u7801',

      'svg_title': 'SVG \u5de5\u5177 \u2014 70015',
      'svg_hero': 'SVG \u5de5\u5177',
      'svg_desc': '\u4f18\u5316 SVG \u4ee3\u7801\uff08\u53bb\u9664\u5197\u4f59\u3001\u538b\u7f29\uff09\u5e76\u8f6c\u6362\u4e3a PNG\u3002',
      'svg_paste': '\u7c98\u8d34 SVG \u4ee3\u7801\u6216\u4e0a\u4f20 .svg \u6587\u4ef6',
      'svg_strip_comments': '\u53bb\u9664\u6ce8\u91ca',
      'svg_strip_editor': '\u53bb\u9664\u7f16\u8f91\u5668\u5143\u6570\u636e',
      'svg_collapse_ws': '\u538b\u7f29\u7a7a\u683c',
      'svg_remove_decl': '\u53bb\u9664 XML \u58f0\u660e',
      'svg_copy': '\u590d\u5236',
      'svg_download': '\u4e0b\u8f7d SVG',
      'svg_export_png': '\u5bfc\u51fa PNG',
      'svg_scale': 'PNG \u500d\u7387',
      'svg_preview': '\u9884\u89c8\u5c06\u663e\u793a\u5728\u6b64',
      'svg_invalid': 'SVG \u4ee3\u7801\u65e0\u6548',
      'svg_paste_hint': '\u7c98\u8d34\u6216\u4e0a\u4f20 SVG \u5f00\u59cb\u3002',

      'ann_title': '\u622a\u56fe\u6807\u6ce8 \u2014 70015',
      'ann_hero': '\u622a\u56fe\u6807\u6ce8',
      'ann_desc': '\u7528\u7bad\u5934\u3001\u77e9\u5f62\u3001\u6587\u5b57\u3001\u9ad8\u4eae\u3001\u9a6c\u8d5b\u514b\u6807\u6ce8\u56fe\u7247\u3002\u5bfc\u51fa PNG\u3002',
      'ann_drop': '\u62d6\u62fd\u56fe\u7247\u5230\u6b64\u5904\u6216\u70b9\u51fb\u4e0a\u4f20',
      'ann_hint': '\u6216\u4ece\u526a\u8d34\u677f\u7c98\u8d34 (Ctrl+V)',
      'ann_rect': '\u77e9\u5f62',
      'ann_arrow': '\u7bad\u5934',
      'ann_line': '\u76f4\u7ebf',
      'ann_pen': '\u753b\u7b14',
      'ann_highlight': '\u9ad8\u4eae',
      'ann_text': '\u6587\u5b57',
      'ann_mosaic': '\u9a6c\u8d5b\u514b',
      'ann_color': '\u989c\u8272',
      'ann_width': '\u5bbd\u5ea6',
      'ann_font': '\u5b57\u53f7',
      'ann_undo': '\u64a4\u9500',
      'ann_redo': '\u91cd\u505a',
      'ann_clear': '\u6e05\u9664\u5168\u90e8',
      'ann_replace': '\u66ff\u6362\u56fe\u7247',
      'ann_export': '\u5bfc\u51fa PNG',
      'ann_hint_rect': '\u62d6\u62fd\u7ed8\u5236\u77e9\u5f62\u8f6e\u5ed3\u3002',
      'ann_hint_arrow': '\u4ece\u7bad\u5c3e\u62d6\u5230\u7bad\u5934\u3002',
      'ann_hint_line': '\u62d6\u62fd\u7ed8\u5236\u76f4\u7ebf\u3002',
      'ann_hint_pen': '\u81ea\u7531\u7ed8\u5236\u7ebf\u6761\u3002',
      'ann_hint_highlight': '\u534a\u900f\u660e\u7ebf\u6761\uff0c\u9009\u62e9\u4eae\u8272\u3002',
      'ann_hint_text': '\u70b9\u51fb\u8981\u63d2\u5165\u6587\u5b57\u7684\u4f4d\u7f6e\uff0c\u8f93\u5165\u540e\u6309 Enter\u3002',
      'ann_hint_mosaic': '\u62d6\u62fd\u9009\u533a\u8fdb\u884c\u9a6c\u8d5b\u514b\u5904\u7406\u3002',

      'snp_title': '\u7f51\u9875\u622a\u56fe \u2014 70015',
      'snp_hero': '\u7f51\u9875\u622a\u56fe',
      'snp_desc': '\u901a\u8fc7\u5c4f\u5e55\u5171\u4eab\u622a\u53d6\u7f51\u9875\u533a\u57df\u3002\u62d6\u62fd\u9009\u533a\uff0c\u5bfc\u51fa PNG\u3002',
      'snp_start': '\u5f00\u59cb\u622a\u53d6',
      'snp_stop': '\u505c\u6b62\u5171\u4eab',
      'snp_full': '\u622a\u53d6\u5168\u5e4f',
      'snp_screen': '\u5c4f\u5e55',
      'snp_pdf': 'PDF',
      'snp_screen_note': '\u5171\u4eab\u6807\u7b7e\u9875\u6216\u5c4f\u5e55\u8fdb\u884c\u5b9e\u65f6\u622a\u53d6\u3002',
      'snp_pdf_note': '\u6253\u5f00\u672c\u5730 PDF\uff08\u6216\u6253\u5370\u4e3a PDF\uff09\u6765\u622a\u53d6\u6216\u62fc\u63a5\u9875\u9762\u3002',
      'snp_pdf_drop': '\u62d6\u62fd PDF \u5230\u6b64\u5904\u6216\u70b9\u51fb\u4e0a\u4f20',
      'snp_pdf_hint': '\u4f7f\u7528 PDF.js \u672c\u5730\u6e32\u67d3 \u2014 \u65e0\u4e0a\u4f20',
      'snp_stitch': '\u62fc\u63a5\u6240\u6709\u9875',
      'snp_pdf_clear': '\u6e05\u9664',
      'snp_prev': '\u4e0a\u4e00\u9875',
      'snp_next': '\u4e0b\u4e00\u9875',
      'snp_region': '\u5df2\u9009\u533a\u57df',
      'snp_copy': '\u590d\u5236',
      'snp_download': '\u4e0b\u8f7d PNG',
      'snp_add_stitch': '+ \u62fc\u63a5',
      'snp_stitched': '\u62fc\u63a5\u56fe\u7247',
      'snp_segments': '0 \u6bb5',
      'snp_dl_stitch': '\u4e0b\u8f7d\u62fc\u63a5 PNG',
      'snp_clear_stitch': '\u6e05\u9664\u62fc\u63a5',
      'snp_hint': '\u70b9\u51fb\u201c\u5f00\u59cb\u622a\u53d6\u201d\u5e76\u9009\u62e9\u8981\u5171\u4eab\u7684\u6807\u7b7e\u9875\u3002',
      'snp_drag_hint': '\u5728\u9884\u89c8\u4e0a\u62d6\u62fd\u9009\u533a\u3002\u677e\u5f00\u540e\u81ea\u52a8\u622a\u53d6\u3002',
      'snp_result_note': '\u5728\u4e0a\u65b9\u9884\u89c8\u4e2d\u62d6\u62fd\u622a\u53d6\u4e0d\u540c\u533a\u57df\u3002\u70b9\u51fb\u201c+ \u62fc\u63a5\u201d\u8ffd\u52a0\uff0c\u6eda\u52a8\u540e\u518d\u622a\u3002',
      'snp_pdf_tip': '\u63d0\u793a\uff1a\u5bf9\u4e8e\u8d85\u957f\u7f51\u9875\uff0c\u4f7f\u7528\u6d4f\u89c8\u5668\u7684\u6253\u5370 \u2192 \u53e6\u5b58\u4e3a PDF\uff0c\u7136\u540e\u5728\u6b64\u6253\u5f00\u6765\u622a\u53d6\u6216\u62fc\u63a5\u6240\u6709\u9875\u3002',

      'ed_title': 'SVG \u7f16\u8f91\u5668 \u2014 70015',
      'ed_hero': 'SVG \u7f16\u8f91\u5668',
      'ed_desc': '\u5728\u6d4f\u89c8\u5668\u4e2d\u7ed8\u5236\u548c\u7f16\u8f91 SVG\u3002\u56fe\u5f62\u3001\u6587\u5b57\u3001\u624b\u7ed8\u3001\u6e10\u53d8\u3001\u591a\u9009\u3001\u5bf9\u9f50\u3001\u7f51\u683c\u3001\u7f29\u653e\u3002\u5bfc\u51fa SVG \u6216 PNG\u3002',
      'ed_hint': '\u9009\u62e9\u5de5\u5177\u5e76\u5728\u753b\u5e03\u4e0a\u62d6\u62fd\u3002\u6eda\u8f6e\u7f29\u653e\uff0c\u7a7a\u683c+\u62d6\u62fd\u5e73\u79fb\u3002\u5728\u5c5e\u6027\u9762\u677f\u8c03\u6574\u586b\u5145\u3001\u63cf\u8fb9\u3001\u900f\u660e\u5ea6\u548c\u6e10\u53d8\u3002\u5feb\u6377\u952e 1-8 \u5207\u6362\u5de5\u5177\u3002',
      'ed_props': '\u5c5e\u6027',
      'ed_no_select': '\u672a\u9009\u4e2d',
      'ed_source': '\u6e90\u4ee3\u7801',
      'ed_copy_code': '\u590d\u5236',
      'ed_import': '\u5bfc\u5165',
      'ed_clear': '\u6e05\u9664',
      'ed_svg': 'SVG',
      'ed_png': 'PNG',
      'ed_layers': '\u56fe\u5c42',
      'ed_no_elements': '\u8fd8\u6ca1\u6709\u5143\u7d20',

      'm_home': '\u9996\u9875',
      'm_converter': '\u56fe\u7247\u8f6c\u6362',
      'm_palette': '\u8c03\u8272\u677f',
      'm_color': '\u989c\u8272\u5bf9\u6bd4',
      'm_base64': 'Base64 \u8f6c\u6362',
      'm_svg': 'SVG \u5de5\u5177',
      'm_qr': '\u4e8c\u7ef4\u7801',
      'm_annotate': '\u622a\u56fe\u6807\u6ce8',
      'm_snapshot': '\u7f51\u9875\u622a\u56fe',
      'm_editor': 'SVG \u7f16\u8f91\u5668',

      'toast_copied': '\u5df2\u590d\u5236',
      'toast_copy_fail': '\u590d\u5236\u5931\u8d25',
      'toast_deleted': '\u5df2\u5220\u9664',
      'toast_cleared': '\u5df2\u6e05\u9664',
      'toast_exported': '\u5df2\u5bfc\u51fa',
      'toast_imported': '\u5df2\u5bfc\u5165',
      'toast_applied': '\u6e90\u4ee3\u7801\u5df2\u5e94\u7528',
      'toast_invalid': 'SVG \u65e0\u6548',
      'toast_grouped': '\u5df2\u7f16\u7ec4',
      'toast_ungrouped': '\u5df2\u53d6\u6d88\u7f16\u7ec4',
      'toast_duplicated': '\u5df2\u590d\u5236'
    }
  };

  function currentLang() {
    return document.documentElement.getAttribute('data-lang') === 'zh' ? 'zh' : 'en';
  }

  function t(key) {
    var lang = currentLang();
    var dict = STRINGS[lang] || STRINGS.en;
    return dict[key] || STRINGS.en[key] || key;
  }

  function applyLang(lang) {
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    try { localStorage.setItem('70015-lang', lang); } catch (e) {}

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = (STRINGS[lang] || STRINGS.en)[key] || STRINGS.en[key];
      if (val) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var val = (STRINGS[lang] || STRINGS.en)[key] || STRINGS.en[key];
      if (val) el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      var val = (STRINGS[lang] || STRINGS.en)[key] || STRINGS.en[key];
      if (val) el.title = val;
    });

    updateToggleButton(lang);
    
    // Re-render menu if menu-data.js is loaded
    if (typeof window.renderMenu === 'function') window.renderMenu();
  }

  function updateToggleButton(lang) {
    var btn = document.getElementById('langToggle');
    if (btn) {
      btn.textContent = lang === 'zh' ? 'EN' : '\u4e2d\u6587';
      btn.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '\u5207\u6362\u4e3a\u4e2d\u6587');
    }
  }

  function toggleLang() {
    applyLang(currentLang() === 'zh' ? 'en' : 'zh');
  }

  // Create and insert toggle button
  function initToggleButton() {
    if (document.getElementById('langToggle')) return;
    var actions = document.querySelector('.header__actions');
    if (!actions) return;
    var btn = document.createElement('button');
    btn.className = 'lang-toggle';
    btn.id = 'langToggle';
    btn.type = 'button';
    btn.style.cssText = 'min-width:42px;height:42px;display:grid;place-items:center;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-size:12px;font-weight:700;cursor:pointer;transition:background 0.2s,transform 0.1s;';
    btn.addEventListener('mouseenter', function () { btn.style.background = 'var(--surface-3)'; });
    btn.addEventListener('mouseleave', function () { btn.style.background = 'var(--surface-2)'; });
    btn.addEventListener('click', toggleLang);
    // Insert before theme toggle
    var themeToggle = document.getElementById('themeToggle');
    if (themeToggle) actions.insertBefore(btn, themeToggle);
    else actions.appendChild(btn);
    updateToggleButton(currentLang());
  }

  // Expose globals
  window.t = t;
  window.applyLang = applyLang;
  window.currentLang = currentLang;
  window.toggleLang = toggleLang;
  window.i18nStrings = STRINGS;

  // Init
  function init() {
    initToggleButton();
    applyLang(currentLang());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
