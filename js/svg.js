(function () {
  'use strict';

  const svgDrop = document.getElementById('svgDrop');
  const svgInput = document.getElementById('svgInput');
  const svgText = document.getElementById('svgText');
  const optComments = document.getElementById('optComments');
  const optEditor = document.getElementById('optEditor');
  const optWs = document.getElementById('optWs');
  const optDecl = document.getElementById('optDecl');
  const svgPreview = document.getElementById('svgPreview');
  const svgPlaceholder = document.getElementById('svgPlaceholder');
  const svgInfo = document.getElementById('svgInfo');
  const svgHint = document.getElementById('svgHint');
  const copyBtn = document.getElementById('copyBtn');
  const downloadSvgBtn = document.getElementById('downloadSvgBtn');
  const exportPngBtn = document.getElementById('exportPngBtn');
  const pngScale = document.getElementById('pngScale');
  const pngScaleValue = document.getElementById('pngScaleValue');
  const toast = document.getElementById('toast');
  const workCanvas = document.getElementById('workCanvas');

  const EDITOR_NS = /inkscape|sodipodi|sketch|corel|adobe/i;

  let currentSvg = '';

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function debounce(fn, wait) {
    let t;
    return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), wait); };
  }

  function byteLength(s) {
    return new Blob([s]).size;
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    return (n / 1024).toFixed(1) + ' KB';
  }

  function parse(text) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return null;
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg') return null;
    return root;
  }

  function clean(root, opts) {
    const remove = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 8) {
        if (opts.comments) remove.push(node);
        continue;
      }
      const ns = node.namespaceURI || '';
      const name = node.nodeName;
      const local = node.localName || name;
      if (opts.editor && (EDITOR_NS.test(ns) || /^(inkscape|sodipodi):/.test(name) || local === 'metadata' || local === 'namedview')) {
        remove.push(node);
        continue;
      }
      if (opts.editor && node.attributes) {
        [...node.attributes].forEach(attr => {
          const ans = attr.namespaceURI || '';
          if (EDITOR_NS.test(ans) || /^(inkscape|sodipodi):/.test(attr.name)) node.removeAttributeNode(attr);
        });
      }
    }
    remove.forEach(n => n.parentNode && n.parentNode.removeChild(n));
  }

  function serialize(root, opts) {
    let xml = new XMLSerializer().serializeToString(root);
    if (opts.ws) xml = xml.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
    if (opts.decl) xml = xml.replace(/^\s*<\?xml[^>]*\?>\s*/i, '');
    return xml;
  }

  function optimize(text, opts) {
    const root = parse(text);
    if (!root) return null;
    clean(root, opts);
    return serialize(root, opts);
  }

  function getDims(root) {
    const w = root.getAttribute('width');
    const h = root.getAttribute('height');
    if (w && h && !/%$/.test(w) && !/%$/.test(h)) return { w: parseFloat(w), h: parseFloat(h) };
    const vb = root.getAttribute('viewBox');
    if (vb) {
      const m = vb.trim().split(/[\s,]+/).map(Number);
      if (m.length === 4 && m[2] > 0 && m[3] > 0) return { w: m[2], h: m[3] };
    }
    return { w: 512, h: 512 };
  }

  function previewUrl(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function render() {
    const text = svgText.value.trim();
    if (!text) {
      svgPreview.innerHTML = '<span class="svg__placeholder">Preview will appear here</span>';
      svgInfo.textContent = '\u2014';
      svgHint.textContent = 'Paste or upload an SVG to begin.';
      currentSvg = '';
      return;
    }
    const opts = {
      comments: optComments.checked,
      editor: optEditor.checked,
      ws: optWs.checked,
      decl: optDecl.checked
    };
    const root = parse(text);
    if (!root) {
      svgPreview.innerHTML = '<span class="svg__placeholder svg__placeholder--err">Invalid SVG markup</span>';
      svgInfo.textContent = '\u2014';
      svgHint.textContent = 'Could not parse this SVG. Check the markup.';
      currentSvg = '';
      return;
    }
    const original = byteLength(text);
    const optimized = optimize(text, opts);
    currentSvg = optimized;
    svgPreview.innerHTML = '<img src="' + previewUrl(optimized) + '" alt="SVG preview">';
    const optBytes = byteLength(optimized);
    const saved = original > 0 ? Math.round((1 - optBytes / original) * 100) : 0;
    svgInfo.textContent = formatBytes(original) + ' \u2192 ' + formatBytes(optBytes) + (saved > 0 ? ' (\u2212' + saved + '%)' : '');
    svgHint.textContent = 'Optimized output is ready. Copy, download, or export PNG.';
  }

  async function copy() {
    if (!currentSvg) { showToast('Nothing to copy'); return; }
    try { await navigator.clipboard.writeText(currentSvg); showToast('Copied SVG'); }
    catch (e) { showToast('Copy failed'); }
  }

  function downloadSvg() {
    if (!currentSvg) { showToast('Nothing to download'); return; }
    const blob = new Blob([currentSvg], { type: 'image/svg+xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'graphic-' + Date.now() + '.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportPng() {
    if (!currentSvg) { showToast('Nothing to export'); return; }
    const root = parse(currentSvg);
    if (!root) { showToast('Invalid SVG'); return; }
    const { w, h } = getDims(root);
    const scale = parseFloat(pngScale.value);
    const img = new Image();
    img.onload = () => {
      try {
        workCanvas.width = Math.round(w * scale);
        workCanvas.height = Math.round(h * scale);
        const ctx = workCanvas.getContext('2d');
        ctx.clearRect(0, 0, workCanvas.width, workCanvas.height);
        ctx.drawImage(img, 0, 0, workCanvas.width, workCanvas.height);
        workCanvas.toBlob((blob) => {
          if (!blob) { showToast('Export failed'); return; }
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'graphic-' + Date.now() + '.png';
          a.click();
          URL.revokeObjectURL(a.href);
        }, 'image/png');
      } catch (e) {
        showToast('SVG has external resources \u2014 can\'t export');
      }
    };
    img.onerror = () => showToast('Could not render SVG');
    img.src = previewUrl(currentSvg);
  }

  [optComments, optEditor, optWs, optDecl].forEach(el => el.addEventListener('change', render));
  pngScale.addEventListener('input', e => pngScaleValue.textContent = (parseFloat(e.target.value)) + '\u00d7');
  svgText.addEventListener('input', debounce(render, 300));
  copyBtn.addEventListener('click', copy);
  downloadSvgBtn.addEventListener('click', downloadSvg);
  exportPngBtn.addEventListener('click', exportPng);

  svgInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) readFile(f);
    svgInput.value = '';
  });
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => svgDrop.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); }));
  ['dragenter', 'dragover'].forEach(evt => svgDrop.addEventListener(evt, () => svgDrop.classList.add('is-dragover')));
  ['dragleave', 'drop'].forEach(evt => svgDrop.addEventListener(evt, () => svgDrop.classList.remove('is-dragover')));
  svgDrop.addEventListener('drop', e => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readFile(f);
  });

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => { svgText.value = reader.result; render(); };
    reader.onerror = () => showToast('Could not read ' + file.name);
    reader.readAsText(file);
  }

  render();
})();
