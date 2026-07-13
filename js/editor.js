/**
 * 70015 SVG Editor v2
 * Upgraded: zoom/pan, polygon/star, multi-select, align, grid/snap, rotation, gradients.
 */

(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var XLINK_NS = 'http://www.w3.org/1999/xlink';

  // DOM
  var artboard = document.getElementById('artboard');
  var stage = document.getElementById('stage');
  var overlay = document.getElementById('overlay');
  var selBox = document.getElementById('selBox');
  var handles = overlay.querySelectorAll('.editor__handle');
  var rotateHandle = document.getElementById('rotateHandle');
  var propType = document.getElementById('propType');
  var props = document.getElementById('props');
  var codeView = document.getElementById('codeView');
  var toast = document.getElementById('toast');

  // State
  var tool = 'select';
  var selected = [];
  var drawing = null;
  var dragging = null;
  var resizing = null;
  var rotating = null;
  var panning = null;
  var penPoints = [];
  var polygonPoints = [];
  var polygonPreview = null;
  var spaceDown = false;
  var history = [];
  var historyIdx = -1;
  var maxHistory = 50;
  var uidCounter = 0;

  // Viewport (zoom/pan via viewBox)
  var VB = { x: 0, y: 0, w: 800, h: 600 };
  var GRID = 20;
  var showGrid = false;
  var snapToGrid = false;

  var SWATCHES = ['#7dd3fc', '#203848', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#000000', '#ffffff', '#6b7280', '#fbbf24'];

  function uid() { return 'el-' + (++uidCounter); }
  function showToast(m, d) { d = d || 2000; toast.textContent = m; toast.classList.add('is-visible'); setTimeout(function () { toast.classList.remove('is-visible'); }, d); }

  function el(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function escapeAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function normalizeHex(c) {
    if (!c) return '#000000';
    if (c[0] === '#') { if (c.length === 7) return c; if (c.length === 4) return '#' + c[1]+c[1]+c[2]+c[2]+c[3]+c[3]; return '#000000'; }
    var m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) return '#' + [1,2,3].map(function(i){ return ('0'+parseInt(m[i],10).toString(16)).slice(-2); }).join('');
    return '#000000';
  }

  // ---- Viewport ----
  function applyViewBox() {
    artboard.setAttribute('viewBox', VB.x + ' ' + VB.y + ' ' + VB.w + ' ' + VB.h);
    var zoom = 800 / VB.w;
    document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
    updateSelection();
    updateGrid();
  }

  function getMouse(e) {
    var rect = stage.getBoundingClientRect();
    var scaleX = VB.w / rect.width;
    var scaleY = VB.h / rect.height;
    var scale = Math.max(scaleX, scaleY);
    var renderW = VB.w / scale;
    var renderH = VB.h / scale;
    var offsetX = (rect.width - renderW) / 2;
    var offsetY = (rect.height - renderH) / 2;
    return { x: Math.round((e.clientX - rect.left - offsetX) * scale + VB.x), y: Math.round((e.clientY - rect.top - offsetY) * scale + VB.y) };
  }

  function svgToScreen(x, y) {
    var rect = stage.getBoundingClientRect();
    var scaleX = VB.w / rect.width;
    var scaleY = VB.h / rect.height;
    var scale = Math.max(scaleX, scaleY);
    var renderW = VB.w / scale;
    var renderH = VB.h / scale;
    var offsetX = (rect.width - renderW) / 2;
    var offsetY = (rect.height - renderH) / 2;
    return { x: (x - VB.x) / scale + offsetX, y: (y - VB.y) / scale + offsetY };
  }

  function snapVal(v) { return snapToGrid ? Math.round(v / GRID) * GRID : v; }

  // ---- Grid ----
  var gridPattern = null;
  function initGrid() {
    gridPattern = el('pattern', { id: 'gridPattern', width: GRID, height: GRID, patternUnits: 'userSpaceOnUse' });
    gridPattern.appendChild(el('path', { d: 'M ' + GRID + ' 0 L 0 0 0 ' + GRID, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.5, opacity: 0.3 }));
    var defs = artboard.querySelector('defs') || el('defs');
    if (!artboard.querySelector('defs')) artboard.insertBefore(defs, artboard.firstChild);
    defs.appendChild(gridPattern);
    var rect = el('rect', { id: 'gridRect', width: '100%', height: '100%', fill: 'url(#gridPattern)', opacity: '0', pointerEvents: 'none' });
    artboard.appendChild(rect);
  }

  function updateGrid() {
    var gr = artboard.querySelector('#gridRect');
    if (gr) gr.setAttribute('opacity', showGrid ? '1' : '0');
  }

  // ---- History ----
  function snapshot() {
    history = history.slice(0, historyIdx + 1);
    // Save without grid rect
    var clone = artboard.cloneNode(true);
    var gr = clone.querySelector('#gridRect');
    if (gr) gr.remove();
    var gp = clone.querySelector('#gridPattern');
    if (gp) gp.remove();
    var defs = clone.querySelector('defs');
    if (defs && defs.children.length === 0) defs.remove();
    history.push(clone.innerHTML);
    if (history.length > maxHistory) history.shift();
    historyIdx = history.length - 1;
    updateHistoryButtons();
    syncCode();
  }

  function restore() {
    if (historyIdx < 0 || historyIdx >= history.length) return;
    // Remove all children except defs and grid
    var defs = artboard.querySelector('defs') || el('defs');
    if (!artboard.querySelector('defs')) artboard.insertBefore(defs, artboard.firstChild);
    var toRemove = [];
    Array.from(artboard.children).forEach(function (c) {
      if (c.tagName !== 'defs' && c.id !== 'gridRect' && c.id !== 'gridPattern') toRemove.push(c);
    });
    toRemove.forEach(function (c) { c.remove(); });
    // Parse and insert history
    var tmp = document.createElementNS(SVG_NS, 'svg');
    tmp.innerHTML = history[historyIdx];
    while (tmp.firstChild) {
      var child = tmp.firstChild;
      tmp.removeChild(child);
      if (child.tagName === 'defs') {
        // Merge defs
        while (child.firstChild) { defs.appendChild(child.firstChild); }
      } else {
        artboard.appendChild(child);
      }
    }
    selected = [];
    updateSelection();
    updateProps();
    updateLayers();
    syncCode();
    updateHistoryButtons();
  }

  function undo() { if (historyIdx > 0) { historyIdx--; restore(); } }
  function redo() { if (historyIdx < history.length - 1) { historyIdx++; restore(); } }
  function updateHistoryButtons() {
    document.getElementById('undoBtn').disabled = historyIdx <= 0;
    document.getElementById('redoBtn').disabled = historyIdx >= history.length - 1;
  }

  // ---- Selection ----
  function primary() { return selected.length > 0 ? selected[selected.length - 1] : null; }

  function selectSingle(node) { selected = node ? [node] : []; updateSelection(); updateProps(); updateLayers(); syncToolbar(); updateActionButtons(); }

  function toggleSelect(node) {
    var idx = selected.indexOf(node);
    if (idx >= 0) selected.splice(idx, 1);
    else selected.push(node);
    if (selected.length === 0) { node = null; }
    updateSelection(); updateProps(); updateLayers(); syncToolbar(); updateActionButtons();
  }

  function deselect() { selected = []; updateSelection(); updateProps(); updateLayers(); syncToolbar(); updateActionButtons(); }

  function updateSelection() {
    if (selected.length === 0) {
      selBox.hidden = true;
      handles.forEach(function (h) { h.hidden = true; });
      rotateHandle.hidden = true;
      return;
    }
    // Compute combined bbox
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selected.forEach(function (n) {
      var bb = n.getBBox();
      var tr = getTransform(n);
      var cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
      // For rotated elements, approximate with bbox corners
      [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]].forEach(function (pt) {
        var rx = tr.angle ? rotatePt(pt[0], pt[1], cx, cy, tr.angle) : pt;
        if (rx[0] < minX) minX = rx[0]; if (rx[1] < minY) minY = rx[1];
        if (rx[0] > maxX) maxX = rx[0]; if (rx[1] > maxY) maxY = rx[1];
      });
    });
    if (minX === Infinity) { selBox.hidden = true; return; }
    var bb = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    var s = svgToScreen(bb.x, bb.y);
    var se = svgToScreen(bb.x + bb.width, bb.y + bb.height);

    selBox.hidden = false;
    selBox.style.left = s.x + 'px';
    selBox.style.top = s.y + 'px';
    selBox.style.width = (se.x - s.x) + 'px';
    selBox.style.height = (se.y - s.y) + 'px';

    var x = s.x, y = s.y, w = se.x - s.x, h = se.y - s.y;
    var pos = {
      nw: [x, y], n: [x + w / 2, y], ne: [x + w, y],
      e: [x + w, y + h / 2], se: [x + w, y + h],
      s: [x + w / 2, y + h], sw: [x, y + h], w: [x, y + h / 2]
    };
    handles.forEach(function (hd) {
      var p = pos[hd.dataset.h];
      hd.hidden = false;
      hd.style.left = p[0] + 'px';
      hd.style.top = p[1] + 'px';
    });
    rotateHandle.hidden = selected.length !== 1;
    if (!rotateHandle.hidden) {
      rotateHandle.style.left = (x + w / 2) + 'px';
      rotateHandle.style.top = (y - 28) + 'px';
    }
  }

  function rotatePt(x, y, cx, cy, ang) {
    var r = ang * Math.PI / 180;
    var dx = x - cx, dy = y - cy;
    return [cx + dx * Math.cos(r) - dy * Math.sin(r), cy + dx * Math.sin(r) + dy * Math.cos(r)];
  }

  function getTransform(node) {
    var t = node.getAttribute('transform') || '';
    var rm = t.match(/rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)/);
    var sm = t.match(/scale\(([-\d.]+)\s*,?\s*([-\d.]+)?\)/);
    return {
      angle: rm ? parseFloat(rm[1]) : 0,
      rcx: rm ? parseFloat(rm[2]) : 0,
      rcy: rm ? parseFloat(rm[3]) : 0,
      sx: sm ? parseFloat(sm[1]) : 1,
      sy: sm && sm[2] ? parseFloat(sm[2]) : (sm ? parseFloat(sm[1]) : 1)
    };
  }

  function setTransform(node, tr) {
    var parts = [];
    if (tr.angle) parts.push('rotate(' + tr.angle + ' ' + tr.rcx + ' ' + tr.rcy + ')');
    if (tr.sx !== 1 || tr.sy !== 1) parts.push('scale(' + tr.sx + ' ' + tr.sy + ')');
    if (parts.length) node.setAttribute('transform', parts.join(' '));
    else node.removeAttribute('transform');
  }

  // ---- Toolbar sync ----
  function syncToolbar() {
    var p = primary();
    if (!p) return;
    var fill = p.getAttribute('fill');
    var stroke = p.getAttribute('stroke');
    var sw = p.getAttribute('stroke-width');
    if (fill && fill !== 'none' && fill.indexOf('url') < 0) document.getElementById('fillColor').value = normalizeHex(fill);
    if (stroke && stroke !== 'none') document.getElementById('strokeColor').value = normalizeHex(stroke);
    if (sw) { document.getElementById('strokeWidth').value = sw; document.getElementById('strokeWidthValue').textContent = sw; }
  }

  function updateActionButtons() {
    var has = selected.length > 0;
    var multi = selected.length > 1;
    ['duplicateBtn', 'frontBtn', 'backBtn', 'deleteBtn', 'flipHBtn', 'flipVBtn', 'groupBtn'].forEach(function (id) {
      document.getElementById(id).disabled = !has;
    });
    document.getElementById('ungroupBtn').disabled = !has;
    document.getElementById('alignGroup').hidden = !multi;
    document.getElementById('groupBtn').disabled = !(multi && selected.every(function (n) { return n.parentNode === artboard; }));
    document.getElementById('ungroupBtn').disabled = !selected.some(function (n) { return n.tagName === 'g' || getElementType(n) === 'g'; });
  }

  // ---- Properties panel ----
  function getElementType(node) { return node.tagName.toLowerCase(); }

  function updateProps() {
    props.innerHTML = '';
    var p = primary();
    if (!p) { propType.textContent = 'Nothing selected'; return; }
    var type = getElementType(p);
    propType.textContent = type.charAt(0).toUpperCase() + type.slice(1) + (selected.length > 1 ? ' (' + selected.length + ' selected)' : '');

    var fill = p.getAttribute('fill') || 'none';
    var stroke = p.getAttribute('stroke') || 'none';
    var sw = p.getAttribute('stroke-width') || '0';
    var opacity = parseFloat(p.getAttribute('opacity') || '1');
    var tr = getTransform(p);
    var html = '';

    // Fill
    html += '<div class="prop-row prop-row--swatches"><label>Fill</label>';
    html += '<input type="color" id="propFill" value="' + (fill !== 'none' && fill.indexOf('url') < 0 ? normalizeHex(fill) : '#000000') + '">';
    html += '<button class="color-swatch" data-fill="none" title="No fill" aria-label="No fill" style="background:transparent;background-image:linear-gradient(45deg,var(--surface-3) 25%,transparent 25%),linear-gradient(-45deg,var(--surface-3) 25%,transparent 25%);background-size:8px 8px;"></button>';
    SWATCHES.forEach(function (c) { html += '<button class="color-swatch" data-fill="' + c + '" style="background:' + c + '" title="' + c + '" aria-label="Fill ' + c + '"></button>'; });
    html += '<button class="color-swatch" data-gradient="linear" title="Linear gradient" aria-label="Linear gradient" style="background:linear-gradient(135deg,#7dd3fc,#203848);"></button>';
    html += '<button class="color-swatch" data-gradient="radial" title="Radial gradient" aria-label="Radial gradient" style="background:radial-gradient(circle,#7dd3fc,#203848);"></button>';
    html += '</div>';

    // Gradient editor
    if (fill.indexOf('url') >= 0) {
      var gid = fill.match(/url\(#([^)]+)\)/);
      if (gid) {
        var grad = artboard.querySelector('#' + gid[1]);
        if (grad) {
          var stops = grad.querySelectorAll('stop');
          var s1 = stops[0] ? stops[0].getAttribute('stop-color') : '#7dd3fc';
          var s2 = stops[1] ? stops[1].getAttribute('stop-color') : '#203848';
          html += '<div class="prop-row"><label>Grad 1</label><input type="color" id="propGrad1" value="' + normalizeHex(s1) + '"></div>';
          html += '<div class="prop-row"><label>Grad 2</label><input type="color" id="propGrad2" value="' + normalizeHex(s2) + '"></div>';
          if (grad.tagName === 'linearGradient') {
            html += '<div class="prop-row"><label>Angle</label><input class="range" type="range" id="propGradAngle" min="0" max="360" value="90"><span class="prop-value" id="propGradAngleVal">90</span></div>';
          }
        }
      }
    }

    // Stroke
    html += '<div class="prop-row prop-row--swatches"><label>Stroke</label>';
    html += '<input type="color" id="propStroke" value="' + (stroke !== 'none' ? normalizeHex(stroke) : '#000000') + '">';
    html += '<button class="color-swatch" data-stroke="none" title="No stroke" aria-label="No stroke" style="background:transparent;background-image:linear-gradient(45deg,var(--surface-3) 25%,transparent 25%),linear-gradient(-45deg,var(--surface-3) 25%,transparent 25%);background-size:8px 8px;"></button>';
    SWATCHES.forEach(function (c) { html += '<button class="color-swatch" data-stroke="' + c + '" style="background:' + c + '" title="' + c + '" aria-label="Stroke ' + c + '"></button>'; });
    html += '</div>';

    html += '<div class="prop-row"><label>Width</label><input class="range" type="range" id="propStrokeWidth" min="0" max="40" value="' + sw + '"><span class="prop-value" id="propStrokeWidthVal">' + sw + '</span></div>';
    html += '<div class="prop-row"><label>Opacity</label><input class="range" type="range" id="propOpacity" min="0" max="100" value="' + Math.round(opacity * 100) + '"><span class="prop-value" id="propOpacityVal">' + Math.round(opacity * 100) + '</span></div>';
    html += '<div class="prop-row"><label>Rotation</label><input class="range" type="range" id="propRotation" min="0" max="360" value="' + Math.round(tr.angle) + '"><span class="prop-value" id="propRotationVal">' + Math.round(tr.angle) + '</span></div>';

    if (type === 'rect') {
      var rx = p.getAttribute('rx') || '0';
      html += '<div class="prop-row"><label>Corner</label><input class="range" type="range" id="propRx" min="0" max="100" value="' + rx + '"><span class="prop-value" id="propRxVal">' + rx + '</span></div>';
    }
    if (type === 'star') {
      var pts = p.getAttribute('data-points') || '5';
      html += '<div class="prop-row"><label>Points</label><input class="range" type="range" id="propStarPts" min="3" max="12" value="' + pts + '"><span class="prop-value" id="propStarPtsVal">' + pts + '</span></div>';
    }
    if (type === 'text') {
      var ts = p.textContent || '';
      var fs = p.getAttribute('font-size') || '16';
      html += '<div class="prop-row"><label>Text</label><input type="text" id="propText" value="' + escapeAttr(ts) + '"></div>';
      html += '<div class="prop-row"><label>Font</label><input class="range" type="range" id="propFontSize" min="8" max="96" value="' + fs + '"><span class="prop-value" id="propFontSizeVal">' + fs + '</span></div>';
    }

    props.innerHTML = html;
    bindPropEvents();
  }

  function bindPropEvents() {
    var p = primary();
    if (!p) return;

    function applyToSelected(fn) {
      selected.forEach(fn);
      syncToolbar(); updateLayers(); syncCode(); updateSelection();
    }
    function snapAll(fn) {
      selected.forEach(fn);
      syncToolbar(); updateLayers(); syncCode(); updateSelection();
      snapshot();
    }

    var propFill = document.getElementById('propFill');
    if (propFill) { propFill.addEventListener('input', function () { applyToSelected(function (n) { n.setAttribute('fill', propFill.value); }); }); propFill.addEventListener('change', function () { snapAll(function (n) { n.setAttribute('fill', propFill.value); }); }); }

    var propStroke = document.getElementById('propStroke');
    if (propStroke) { propStroke.addEventListener('input', function () { applyToSelected(function (n) { n.setAttribute('stroke', propStroke.value); }); }); propStroke.addEventListener('change', function () { snapAll(function (n) { n.setAttribute('stroke', propStroke.value); }); }); }

    var propSW = document.getElementById('propStrokeWidth');
    if (propSW) { propSW.addEventListener('input', function () { document.getElementById('propStrokeWidthVal').textContent = propSW.value; applyToSelected(function (n) { n.setAttribute('stroke-width', propSW.value); }); }); propSW.addEventListener('change', function () { snapAll(function () {}); }); }

    var propOp = document.getElementById('propOpacity');
    if (propOp) { propOp.addEventListener('input', function () { document.getElementById('propOpacityVal').textContent = propOp.value; applyToSelected(function (n) { n.setAttribute('opacity', (propOp.value / 100).toFixed(2)); }); }); propOp.addEventListener('change', function () { snapAll(function () {}); }); }

    var propRot = document.getElementById('propRotation');
    if (propRot) {
      propRot.addEventListener('input', function () {
        document.getElementById('propRotationVal').textContent = propRot.value;
        applyToSelected(function (n) {
          var tr = getTransform(n); tr.angle = parseFloat(propRot.value);
          var bb = n.getBBox(); tr.rcx = bb.x + bb.width / 2; tr.rcy = bb.y + bb.height / 2;
          setTransform(n, tr);
        });
      });
      propRot.addEventListener('change', function () { snapAll(function () {}); });
    }

    var propRx = document.getElementById('propRx');
    if (propRx) { propRx.addEventListener('input', function () { document.getElementById('propRxVal').textContent = propRx.value; applyToSelected(function (n) { n.setAttribute('rx', propRx.value); }); }); propRx.addEventListener('change', function () { snapAll(function () {}); }); }

    var propStarPts = document.getElementById('propStarPts');
    if (propStarPts && getElementType(p) === 'star') {
      propStarPts.addEventListener('input', function () {
        document.getElementById('propStarPtsVal').textContent = propStarPts.value;
        p.setAttribute('data-points', propStarPts.value);
        rebuildStar(p, parseInt(propStarPts.value, 10));
        syncCode(); updateSelection();
      });
      propStarPts.addEventListener('change', function () { snapshot(); });
    }

    var propText = document.getElementById('propText');
    if (propText) { propText.addEventListener('input', function () { p.textContent = propText.value; syncCode(); }); propText.addEventListener('change', function () { snapshot(); }); }

    var propFS = document.getElementById('propFontSize');
    if (propFS) { propFS.addEventListener('input', function () { document.getElementById('propFontSizeVal').textContent = propFS.value; p.setAttribute('font-size', propFS.value); syncCode(); }); propFS.addEventListener('change', function () { snapshot(); }); }

    // Gradient editors
    var pg1 = document.getElementById('propGrad1');
    var pg2 = document.getElementById('propGrad2');
    var pgA = document.getElementById('propGradAngle');
    if (pg1) pg1.addEventListener('input', function () { updateGradient(p, pg1.value, null, null); });
    if (pg2) pg2.addEventListener('input', function () { updateGradient(p, null, pg2.value, null); });
    if (pgA) { pgA.addEventListener('input', function () { document.getElementById('propGradAngleVal').textContent = pgA.value; updateGradient(p, null, null, parseInt(pgA.value, 10)); }); pgA.addEventListener('change', function () { snapshot(); }); }

    // Swatches
    props.querySelectorAll('[data-fill]').forEach(function (s) {
      s.addEventListener('click', function () {
        applyToSelected(function (n) { n.setAttribute('fill', s.dataset.fill); });
        if (s.dataset.fill !== 'none' && propFill) propFill.value = normalizeHex(s.dataset.fill);
        snapshot();
      });
    });
    props.querySelectorAll('[data-stroke]').forEach(function (s) {
      s.addEventListener('click', function () {
        applyToSelected(function (n) { n.setAttribute('stroke', s.dataset.stroke); });
        if (s.dataset.stroke !== 'none' && propStroke) propStroke.value = normalizeHex(s.dataset.stroke);
        snapshot();
      });
    });
    // Gradient buttons
    props.querySelectorAll('[data-gradient]').forEach(function (s) {
      s.addEventListener('click', function () {
        var gid = createGradient(s.dataset.gradient);
        p.setAttribute('fill', 'url(#' + gid + ')');
        updateProps();
        syncCode();
        snapshot();
      });
    });
  }

  // ---- Gradients ----
  function createGradient(type) {
    var gid = 'grad-' + (++uidCounter);
    var defs = artboard.querySelector('defs');
    if (!defs) { defs = el('defs'); artboard.insertBefore(defs, artboard.firstChild); }
    var grad;
    if (type === 'radial') {
      grad = el('radialGradient', { id: gid, cx: '50%', cy: '50%', r: '50%' });
    } else {
      grad = el('linearGradient', { id: gid, x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
    }
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': '#7dd3fc' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': '#203848' }));
    defs.appendChild(grad);
    return gid;
  }

  function updateGradient(node, c1, c2, angle) {
    var fill = node.getAttribute('fill') || '';
    var m = fill.match(/url\(#([^)]+)\)/);
    if (!m) return;
    var grad = artboard.querySelector('#' + m[1]);
    if (!grad) return;
    var stops = grad.querySelectorAll('stop');
    if (c1 && stops[0]) stops[0].setAttribute('stop-color', c1);
    if (c2 && stops[1]) stops[1].setAttribute('stop-color', c2);
    if (angle !== null && angle !== undefined && grad.tagName === 'linearGradient') {
      var r = angle * Math.PI / 180;
      grad.setAttribute('x1', Math.round((1 - Math.cos(r)) / 2 * 100) + '%');
      grad.setAttribute('y1', Math.round((1 - Math.sin(r)) / 2 * 100) + '%');
      grad.setAttribute('x2', Math.round((1 + Math.cos(r)) / 2 * 100) + '%');
      grad.setAttribute('y2', Math.round((1 + Math.sin(r)) / 2 * 100) + '%');
    }
    syncCode();
  }

  // ---- Layers panel ----
  function updateLayers() {
    var panel = document.querySelector('.editor__panel--layers');
    if (!panel) return;
    var list = panel.querySelector('.editor__layers');
    if (!list) return;
    var countEl = panel.querySelector('#layerCount');
    list.innerHTML = '';
    var nodes = Array.from(artboard.children).reverse().filter(function (n) { return n.id !== 'gridRect' && n.tagName !== 'defs'; });
    if (countEl) countEl.textContent = nodes.length + (nodes.length === 1 ? ' element' : ' elements');
    if (nodes.length === 0) { list.innerHTML = '<p style="font-size:12px;color:var(--text-dim);padding:8px 0;">No elements yet</p>'; return; }
    nodes.forEach(function (node, i) {
      var type = getElementType(node);
      var fill = node.getAttribute('fill') || 'none';
      var item = document.createElement('div');
      item.className = 'layer-item' + (selected.indexOf(node) >= 0 ? ' is-active' : '');
      var sw = fill !== 'none' && fill.indexOf('url') < 0 ? fill : fill.indexOf('url') >= 0 ? 'transparent' : 'transparent';
      item.innerHTML = '<span class="layer-item__swatch" style="background:' + sw + '"></span><span class="layer-item__label">' + type + ' ' + (i + 1) + '</span><span class="layer-item__type">' + type + '</span>';
      item.addEventListener('click', function (e) {
        if (e.shiftKey) toggleSelect(node); else selectSingle(node);
      });
      list.appendChild(item);
    });
  }

  function syncCode() {
    var clone = artboard.cloneNode(true);
    var gr = clone.querySelector('#gridRect'); if (gr) gr.remove();
    var gp = clone.querySelector('#gridPattern'); if (gp) gp.remove();
    var defs = clone.querySelector('defs'); if (defs && defs.children.length === 0) defs.remove();
    codeView.value = clone.innerHTML.replace(/></g, '>\n<');
  }

  // ---- Tools ----
  function setTool(t) {
    tool = t;
    stage.dataset.tool = t;
    document.querySelectorAll('.tool').forEach(function (b) { b.classList.toggle('is-active', b.dataset.tool === t); });
    if (t !== 'select') deselect();
    polygonPoints = [];
    if (polygonPreview) { polygonPreview.remove(); polygonPreview = null; }
  }

  document.querySelectorAll('.tool').forEach(function (b) { b.addEventListener('click', function () { setTool(b.dataset.tool); }); });

  // ---- Drawing ----
  stage.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.editor__handle') || e.target === rotateHandle) {
      if (e.target === rotateHandle) startRotate(e); else startResize(e);
      return;
    }
    if (spaceDown || e.button === 1) { startPan(e); return; }
    if (tool === 'select') {
      var node = e.target.closest('[data-id]');
      if (node && node !== artboard && node.id !== 'gridRect') {
        if (e.shiftKey) toggleSelect(node); else { if (selected.indexOf(node) < 0) selectSingle(node); }
        startDrag(e);
      } else { deselect(); }
      return;
    }
    if (tool === 'polygon') { handlePolygonClick(e); return; }
    startDraw(e);
  });

  function startDraw(e) {
    var p = getMouse(e);
    p.x = snapVal(p.x); p.y = snapVal(p.y);
    drawing = { x: p.x, y: p.y };
    penPoints = [];
    var node, id = uid();
    var fill = document.getElementById('fillColor').value;
    var stroke = document.getElementById('strokeColor').value;
    var sw = parseInt(document.getElementById('strokeWidth').value, 10);

    if (tool === 'rect') node = el('rect', { x: p.x, y: p.y, width: 1, height: 1, rx: 0, fill: fill, stroke: stroke, 'stroke-width': sw, 'data-id': id });
    else if (tool === 'ellipse') node = el('ellipse', { cx: p.x, cy: p.y, rx: 1, ry: 1, fill: fill, stroke: stroke, 'stroke-width': sw, 'data-id': id });
    else if (tool === 'line') node = el('line', { x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: stroke, 'stroke-width': Math.max(1, sw), 'data-id': id, fill: 'none' });
    else if (tool === 'text') { node = el('text', { x: p.x, y: p.y, 'font-size': 24, fill: fill, stroke: 'none', 'data-id': id, 'font-family': 'Inter, sans-serif' }); node.textContent = 'Text'; }
    else if (tool === 'pen') { penPoints.push(p); node = el('path', { d: 'M' + p.x + ' ' + p.y, fill: 'none', stroke: stroke, 'stroke-width': Math.max(1, sw), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-id': id }); }
    else if (tool === 'star') { node = el('path', { d: '', fill: fill, stroke: stroke, 'stroke-width': sw, 'data-id': id, 'data-points': '5', 'data-cx': p.x, 'data-cy': p.y, 'data-r': 1 }); drawing.isStar = true; }

    if (node) { artboard.appendChild(node); drawing.node = node; drawing.id = id; }
  }

  stage.addEventListener('pointermove', function (e) {
    if (panning) { updatePan(e); return; }
    if (drawing) { updateDraw(e); return; }
    if (dragging) { updateDrag(e); return; }
    if (resizing) { updateResize(e); return; }
    if (rotating) { updateRotate(e); return; }
    if (tool === 'polygon' && polygonPoints.length > 0) { updatePolygonPreview(e); }
  });

  function updateDraw(e) {
    var p = getMouse(e); p.x = snapVal(p.x); p.y = snapVal(p.y);
    var n = drawing.node; if (!n) return;
    if (tool === 'rect') {
      n.setAttribute('x', Math.min(drawing.x, p.x)); n.setAttribute('y', Math.min(drawing.y, p.y));
      n.setAttribute('width', Math.max(1, Math.abs(p.x - drawing.x))); n.setAttribute('height', Math.max(1, Math.abs(p.y - drawing.y)));
    } else if (tool === 'ellipse') {
      n.setAttribute('cx', (drawing.x + p.x) / 2); n.setAttribute('cy', (drawing.y + p.y) / 2);
      n.setAttribute('rx', Math.max(1, Math.abs(p.x - drawing.x) / 2)); n.setAttribute('ry', Math.max(1, Math.abs(p.y - drawing.y) / 2));
    } else if (tool === 'line') { n.setAttribute('x2', p.x); n.setAttribute('y2', p.y); }
    else if (tool === 'pen') { penPoints.push(p); var d = 'M' + penPoints[0].x + ' ' + penPoints[0].y; for (var i = 1; i < penPoints.length; i++) d += ' L' + penPoints[i].x + ' ' + penPoints[i].y; n.setAttribute('d', d); }
    else if (tool === 'star' && drawing.isStar) {
      var cx = parseFloat(n.getAttribute('data-cx')), cy = parseFloat(n.getAttribute('data-cy'));
      var r = Math.max(1, Math.hypot(p.x - cx, p.y - cy));
      n.setAttribute('data-r', r);
      rebuildStar(n, 5);
    }
  }

  stage.addEventListener('pointerup', function (e) {
    if (panning) { endPan(e); return; }
    if (drawing) { endDraw(e); return; }
    if (dragging) { endDrag(e); return; }
    if (resizing) { endResize(e); return; }
    if (rotating) { endRotate(e); return; }
  });

  stage.addEventListener('pointercancel', function (e) {
    drawing = null; dragging = null; resizing = null; rotating = null; panning = null; penPoints = [];
  });

  stage.addEventListener('pointerleave', function (e) { if (!e.buttons) { if (drawing) endDraw(e); if (dragging) endDrag(e); if (resizing) endResize(e); if (rotating) endRotate(e); if (panning) endPan(e); } });

  function endDraw(e) { var n = drawing.node; drawing = null; penPoints = []; if (n) { selectSingle(n); snapshot(); } }

  // ---- Star ----
  function rebuildStar(node, points) {
    var cx = parseFloat(node.getAttribute('data-cx')), cy = parseFloat(node.getAttribute('data-cy'));
    var r = parseFloat(node.getAttribute('data-r'));
    var ri = r * 0.4;
    var d = '';
    for (var i = 0; i < points * 2; i++) {
      var ang = (Math.PI / points) * i - Math.PI / 2;
      var rad = i % 2 === 0 ? r : ri;
      var x = cx + rad * Math.cos(ang), y = cy + rad * Math.sin(ang);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    node.setAttribute('d', d + 'Z');
  }

  // ---- Polygon (click-based) ----
  function handlePolygonClick(e) {
    var p = getMouse(e); p.x = snapVal(p.x); p.y = snapVal(p.y);
    polygonPoints.push(p);
    if (!polygonPreview) {
      polygonPreview = el('path', { fill: 'none', stroke: document.getElementById('strokeColor').value, 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0.5, 'pointer-events': 'none' });
      artboard.appendChild(polygonPreview);
    }
    updatePolygonPreview(e);
  }

  function updatePolygonPreview(e) {
    if (!polygonPreview || polygonPoints.length === 0) return;
    var p = getMouse(e); p.x = snapVal(p.x); p.y = snapVal(p.y);
    var d = 'M' + polygonPoints[0].x + ' ' + polygonPoints[0].y;
    for (var i = 1; i < polygonPoints.length; i++) d += ' L' + polygonPoints[i].x + ' ' + polygonPoints[i].y;
    d += ' L' + p.x + ' ' + p.y;
    polygonPreview.setAttribute('d', d);
  }

  stage.addEventListener('dblclick', function (e) {
    if (tool === 'polygon' && polygonPoints.length >= 3) {
      var d = 'M' + polygonPoints[0].x + ' ' + polygonPoints[0].y;
      for (var i = 1; i < polygonPoints.length; i++) d += ' L' + polygonPoints[i].x + ' ' + polygonPoints[i].y;
      var node = el('path', { d: d + 'Z', fill: document.getElementById('fillColor').value, stroke: document.getElementById('strokeColor').value, 'stroke-width': parseInt(document.getElementById('strokeWidth').value, 10), 'stroke-linejoin': 'round', 'data-id': uid() });
      artboard.appendChild(node);
      if (polygonPreview) { polygonPreview.remove(); polygonPreview = null; }
      polygonPoints = [];
      selectSingle(node);
      snapshot();
      e.preventDefault();
    }
  });

  // ---- Drag / Move ----
  function startDrag(e) {
    if (selected.length === 0) return;
    var p = getMouse(e);
    var bboxes = selected.map(function (n) { return n.getBBox(); });
    dragging = { sx: p.x, sy: p.y, bbs: bboxes };
    stage.setPointerCapture(e.pointerId);
  }

  function updateDrag(e) {
    var p = getMouse(e);
    var dx = snapVal(p.x) - snapVal(dragging.sx);
    var dy = snapVal(p.y) - snapVal(dragging.sy);
    selected.forEach(function (n, i) { moveElement(n, dragging.bbs[i].x + dx, dragging.bbs[i].y + dy); });
    updateSelection();
  }

  function endDrag(e) { dragging = null; try { stage.releasePointerCapture(e.pointerId); } catch (_) {} snapshot(); }

  function moveElement(node, x, y) {
    var type = getElementType(node);
    if (type === 'rect') { node.setAttribute('x', Math.round(x)); node.setAttribute('y', Math.round(y)); }
    else if (type === 'ellipse') { var rx = parseFloat(node.getAttribute('rx')), ry = parseFloat(node.getAttribute('ry')); node.setAttribute('cx', Math.round(x + rx)); node.setAttribute('cy', Math.round(y + ry)); }
    else if (type === 'line') { var x1=parseFloat(node.getAttribute('x1')),y1=parseFloat(node.getAttribute('y1')),x2=parseFloat(node.getAttribute('x2')),y2=parseFloat(node.getAttribute('y2')); node.setAttribute('x1',Math.round(x));node.setAttribute('y1',Math.round(y));node.setAttribute('x2',Math.round(x+x2-x1));node.setAttribute('y2',Math.round(y+y2-y1)); }
    else if (type === 'text') { node.setAttribute('x',Math.round(x));node.setAttribute('y',Math.round(y+parseFloat(node.getAttribute('font-size')||16)*0.8)); }
    else if (type === 'path') {
      var d = node.getAttribute('d');
      var fm = d.match(/[Mm]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/);
      if (!fm) return;
      var ddx = Math.round(x - parseFloat(fm[1])), ddy = Math.round(y - parseFloat(fm[2]));
      d = d.replace(/([MLml])\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g, function(m,cmd,a,b){ return cmd+' '+(parseFloat(a)+ddx)+' '+(parseFloat(b)+ddy); }).replace(/([Hh])\s*(-?[\d.]+)/g, function(m,cmd,a){ return cmd+' '+(parseFloat(a)+ddx); }).replace(/([Vv])\s*(-?[\d.]+)/g, function(m,cmd,a){ return cmd+' '+(parseFloat(a)+ddy); });
      node.setAttribute('d', d);
      if (node.getAttribute('data-cx')) { node.setAttribute('data-cx', parseFloat(node.getAttribute('data-cx')) + ddx); node.setAttribute('data-cy', parseFloat(node.getAttribute('data-cy')) + ddy); }
    }
  }

  // ---- Resize ----
  function startResize(e) {
    var handle = e.target.closest('.editor__handle'); if (!handle || selected.length !== 1) return;
    var dir = handle.dataset.h, p = getMouse(e), node = primary();
    var bb = node.getBBox();
    resizing = { dir: dir, sx: p.x, sy: p.y, bx: bb.x, by: bb.y, bw: bb.width, bh: bb.height };
    stage.setPointerCapture(e.pointerId); e.preventDefault();
  }

  function updateResize(e) {
    var p = getMouse(e); p.x = snapVal(p.x); p.y = snapVal(p.y);
    var dx = p.x - resizing.sx, dy = p.y - resizing.sy, dir = resizing.dir, node = primary();
    var nx = resizing.bx, ny = resizing.by, nw = resizing.bw, nh = resizing.bh;
    if (dir.indexOf('w') >= 0) { nx = resizing.bx + dx; nw = resizing.bw - dx; }
    if (dir.indexOf('e') >= 0) nw = resizing.bw + dx;
    if (dir.indexOf('n') >= 0) { ny = resizing.by + dy; nh = resizing.bh - dy; }
    if (dir.indexOf('s') >= 0) nh = resizing.bh + dy;
    nw = Math.max(2, nw); nh = Math.max(2, nh);
    var type = getElementType(node);
    if (type === 'rect') { node.setAttribute('x',nx);node.setAttribute('y',ny);node.setAttribute('width',nw);node.setAttribute('height',nh); }
    else if (type === 'ellipse') { node.setAttribute('cx',nx+nw/2);node.setAttribute('cy',ny+nh/2);node.setAttribute('rx',nw/2);node.setAttribute('ry',nh/2); }
    else if (type === 'line') {
      if (dir.indexOf('w') >= 0) { node.setAttribute('x1',nx); node.setAttribute('y1',ny); }
      if (dir.indexOf('e') >= 0) { node.setAttribute('x2',nx+nw); node.setAttribute('y2',ny+nh); }
    } else if (type === 'text') {
      var fs = parseFloat(node.getAttribute('font-size')||16);
      var ratio = dir.indexOf('e')>=0||dir.indexOf('w')>=0 ? nw/resizing.bw : nh/resizing.bh;
      node.setAttribute('font-size', Math.max(8, Math.round(fs*ratio)));
      node.setAttribute('x',nx); node.setAttribute('y',ny + Math.max(8,Math.round(fs*ratio))*0.8);
    } else if (type === 'path' || type === 'star') {
      if (type === 'star') {
        var cx = parseFloat(node.getAttribute('data-cx')), cy = parseFloat(node.getAttribute('data-cy'));
        var r = Math.max(nw, nh) / 2;
        node.setAttribute('data-cx', nx + nw / 2); node.setAttribute('data-cy', ny + nh / 2); node.setAttribute('data-r', r);
        rebuildStar(node, parseInt(node.getAttribute('data-points') || '5', 10));
      }
    }
    updateSelection();
  }

  function endResize(e) { resizing = null; try { stage.releasePointerCapture(e.pointerId); } catch (_) {} snapshot(); updateProps(); }

  // ---- Rotation ----
  function startRotate(e) {
    if (selected.length !== 1) return;
    var p = getMouse(e), node = primary(), bb = node.getBBox();
    rotating = { cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2, startAngle: 0 };
    var s = svgToScreen(rotating.cx, rotating.cy);
    rotating.startAngle = Math.atan2(p.y - s.y, p.x - s.x) * 180 / Math.PI;
    stage.setPointerCapture(e.pointerId); e.preventDefault();
  }

  function updateRotate(e) {
    var p = getMouse(e), node = primary();
    var s = svgToScreen(rotating.cx, rotating.cy);
    var ang = Math.atan2(p.y - s.y, p.x - s.x) * 180 / Math.PI - rotating.startAngle;
    ang = Math.round(ang);
    if (e.shiftKey) ang = Math.round(ang / 15) * 15;
    var tr = getTransform(node); tr.angle = ang; tr.rcx = rotating.cx; tr.rcy = rotating.cy;
    setTransform(node, tr);
    updateSelection();
  }

  function endRotate(e) { rotating = null; try { stage.releasePointerCapture(e.pointerId); } catch (_) {} snapshot(); updateProps(); }

  // ---- Pan / Zoom ----
  function startPan(e) { var p = getMouse(e); panning = { sx: e.clientX, sy: e.clientY, vx: VB.x, vy: VB.y }; stage.setPointerCapture(e.pointerId); e.preventDefault(); }
  function updatePan(e) {
    var rect = stage.getBoundingClientRect();
    var scale = Math.max(VB.w / rect.width, VB.h / rect.height);
    VB.x = panning.vx - (e.clientX - panning.sx) * scale;
    VB.y = panning.vy - (e.clientY - panning.sy) * scale;
    applyViewBox();
  }
  function endPan(e) { panning = null; try { stage.releasePointerCapture(e.pointerId); } catch (_) {} }

  stage.addEventListener('wheel', function (e) {
    e.preventDefault();
    var p = getMouse(e), delta = e.deltaY > 0 ? 1.1 : 0.9;
    var newW = VB.w * delta, newH = VB.h * delta;
    if (newW < 50 || newW > 5000) return;
    VB.x = p.x - (p.x - VB.x) * delta;
    VB.y = p.y - (p.y - VB.y) * delta;
    VB.w = newW; VB.h = newH;
    applyViewBox();
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' && !e.target.matches('input, textarea')) { spaceDown = true; stage.style.cursor = 'grab'; e.preventDefault(); }
  });
  document.addEventListener('keyup', function (e) { if (e.key === ' ') { spaceDown = false; stage.style.cursor = ''; } });

  // Zoom buttons
  function zoomBy(factor) { var cx = VB.x + VB.w / 2, cy = VB.y + VB.h / 2; VB.w *= factor; VB.h *= factor; VB.x = cx - VB.w / 2; VB.y = cy - VB.h / 2; applyViewBox(); }
  document.getElementById('zoomInBtn').addEventListener('click', function () { zoomBy(0.8); });
  document.getElementById('zoomOutBtn').addEventListener('click', function () { zoomBy(1.25); });
  document.getElementById('fitBtn').addEventListener('click', function () { VB = { x: 0, y: 0, w: 800, h: 600 }; applyViewBox(); });

  // Grid / Snap
  document.getElementById('gridBtn').addEventListener('click', function () { showGrid = !showGrid; this.classList.toggle('is-toggled', showGrid); updateGrid(); });
  document.getElementById('snapBtn').addEventListener('click', function () { snapToGrid = !snapToGrid; this.classList.toggle('is-toggled', snapToGrid); });

  // ---- Toolbar controls ----
  document.getElementById('fillColor').addEventListener('input', function () { if (selected.length) { selected.forEach(function(n){n.setAttribute('fill',this.value);}.bind(this)); updateLayers(); syncCode(); } });
  document.getElementById('fillColor').addEventListener('change', function () { if (selected.length) snapshot(); });
  document.getElementById('strokeColor').addEventListener('input', function () { if (selected.length) { selected.forEach(function(n){n.setAttribute('stroke',this.value);}.bind(this)); updateLayers(); syncCode(); } });
  document.getElementById('strokeColor').addEventListener('change', function () { if (selected.length) snapshot(); });
  document.getElementById('strokeWidth').addEventListener('input', function () { document.getElementById('strokeWidthValue').textContent = this.value; if (selected.length) { selected.forEach(function(n){n.setAttribute('stroke-width',this.value);}.bind(this)); syncCode(); } });
  document.getElementById('strokeWidth').addEventListener('change', function () { if (selected.length) snapshot(); });

  // ---- Actions ----
  document.getElementById('deleteBtn').addEventListener('click', function () { if (!selected.length) return; selected.forEach(function (n) { n.remove(); }); deselect(); snapshot(); showToast('Deleted'); });
  document.getElementById('duplicateBtn').addEventListener('click', function () { if (!selected.length) return; var clones = []; selected.forEach(function (n) { var c = n.cloneNode(true); c.setAttribute('data-id', uid()); offsetElement(c, 20, 20); artboard.appendChild(c); clones.push(c); }); selectSingle(clones[0]); for (var i = 1; i < clones.length; i++) selected.push(clones[i]); snapshot(); showToast('Duplicated'); });
  document.getElementById('frontBtn').addEventListener('click', function () { if (!selected.length) return; selected.forEach(function (n) { artboard.appendChild(n); }); snapshot(); updateLayers(); });
  document.getElementById('backBtn').addEventListener('click', function () { if (!selected.length) return; var first = artboard.firstChild; selected.forEach(function (n) { if (first) artboard.insertBefore(n, first); else artboard.appendChild(n); }); snapshot(); updateLayers(); });
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);

  // Flip
  document.getElementById('flipHBtn').addEventListener('click', function () { selected.forEach(function (n) { var tr = getTransform(n); tr.sx = -tr.sx; var bb = n.getBBox(); tr.rcx = bb.x + bb.width / 2; tr.rcy = bb.y + bb.height / 2; setTransform(n, tr); }); snapshot(); updateSelection(); updateProps(); });
  document.getElementById('flipVBtn').addEventListener('click', function () { selected.forEach(function (n) { var tr = getTransform(n); tr.sy = -tr.sy; var bb = n.getBBox(); tr.rcx = bb.x + bb.width / 2; tr.rcy = bb.y + bb.height / 2; setTransform(n, tr); }); snapshot(); updateSelection(); updateProps(); });

  // Group / Ungroup
  document.getElementById('groupBtn').addEventListener('click', function () {
    if (selected.length < 2) return;
    var g = el('g', { 'data-id': uid() });
    var parent = selected[0].parentNode;
    parent.insertBefore(g, selected[0]);
    selected.forEach(function (n) { g.appendChild(n); });
    selectSingle(g);
    snapshot();
    showToast('Grouped');
  });
  document.getElementById('ungroupBtn').addEventListener('click', function () {
    var groups = selected.filter(function (n) { return getElementType(n) === 'g'; });
    if (groups.length === 0) return;
    groups.forEach(function (g) {
      var parent = g.parentNode;
      while (g.firstChild) { var child = g.firstChild; g.removeChild(child); parent.insertBefore(child, g); child.setAttribute('data-id', child.getAttribute('data-id') || uid()); }
      parent.removeChild(g);
    });
    deselect();
    snapshot();
    showToast('Ungrouped');
  });

  // Align
  document.getElementById('alignGroup').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-align]'); if (!btn || selected.length < 2) return;
    var bbs = selected.map(function (n) { return n.getBBox(); });
    var type = btn.dataset.align;
    if (type === 'left') bbs.forEach(function (b, i) { moveElement(selected[i], bbs[0].x, b.y); });
    else if (type === 'right') bbs.forEach(function (b, i) { moveElement(selected[i], bbs[0].x + bbs[0].width - b.width, b.y); });
    else if (type === 'ch') { var cx = bbs[0].x + bbs[0].width/2; bbs.forEach(function(b,i){ moveElement(selected[i], cx - b.width/2, b.y); }); }
    else if (type === 'top') bbs.forEach(function (b, i) { moveElement(selected[i], b.x, bbs[0].y); });
    else if (type === 'bottom') bbs.forEach(function (b, i) { moveElement(selected[i], b.x, bbs[0].y + bbs[0].height - b.height); });
    else if (type === 'cv') { var cy = bbs[0].y + bbs[0].height/2; bbs.forEach(function(b,i){ moveElement(selected[i], b.x, cy - b.height/2); }); }
    updateSelection(); snapshot();
  });

  // ---- Import / Export ----
  document.getElementById('importBtn').addEventListener('click', function () { document.getElementById('importInput').click(); });
  document.getElementById('importInput').addEventListener('change', function () {
    var file = this.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var tmp = document.createElement('div'); tmp.innerHTML = e.target.result;
        var svg = tmp.querySelector('svg'); if (!svg) { showToast('No SVG found'); return; }
        sanitizeSvg(svg);
        artboard.setAttribute('viewBox', svg.getAttribute('viewBox') || '0 0 800 600');
        VB.x = parseFloat(artboard.getAttribute('viewBox').split(' ')[0]) || 0;
        VB.y = parseFloat(artboard.getAttribute('viewBox').split(' ')[1]) || 0;
        VB.w = parseFloat(artboard.getAttribute('viewBox').split(' ')[2]) || 800;
        VB.h = parseFloat(artboard.getAttribute('viewBox').split(' ')[3]) || 600;
        artboard.innerHTML = '';
        initGrid();
        var children = Array.from(svg.children);
        children.forEach(function (child) {
          var imported = document.createElementNS(SVG_NS, child.tagName.toLowerCase());
          for (var i = 0; i < child.attributes.length; i++) imported.setAttribute(child.attributes[i].name, child.attributes[i].value);
          imported.textContent = child.textContent;
          imported.setAttribute('data-id', uid());
          artboard.appendChild(imported);
        });
        deselect(); applyViewBox(); snapshot();
        showToast('Imported ' + children.length + ' elements');
      } catch (err) { showToast('Import failed'); }
    };
    reader.readAsText(file); this.value = '';
  });

  function sanitizeSvg(svgEl) {
    svgEl.querySelectorAll('script').forEach(function (s) { s.remove(); });
    svgEl.querySelectorAll('foreignObject').forEach(function (f) { f.remove(); });
    svgEl.querySelectorAll('*').forEach(function (n) {
      Array.from(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name)) n.removeAttribute(a.name);
        if ((a.name === 'href' || a.name === 'xlink:href') && /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
      });
    });
  }

  document.getElementById('exportSvgBtn').addEventListener('click', function () {
    var clone = artboard.cloneNode(true);
    var gr = clone.querySelector('#gridRect'); if (gr) gr.remove();
    var gp = clone.querySelector('#gridPattern'); if (gp) gp.remove();
    clone.setAttribute('xmlns', SVG_NS);
    var source = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone).replace(/></g, '>\n<');
    downloadBlob(new Blob([source], { type: 'image/svg+xml' }), '70015-editor-' + Date.now() + '.svg');
  });

  document.getElementById('exportPngBtn').addEventListener('click', function () {
    var clone = artboard.cloneNode(true);
    var gr = clone.querySelector('#gridRect'); if (gr) gr.remove();
    var gp = clone.querySelector('#gridPattern'); if (gp) gp.remove();
    clone.setAttribute('xmlns', SVG_NS);
    var source = new XMLSerializer().serializeToString(clone);
    var url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = 800; cv.height = 600;
      var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 800, 600);
      cv.toBlob(function (b) { downloadBlob(b, '70015-editor-' + Date.now() + '.png'); URL.revokeObjectURL(url); }, 'image/png');
    };
    img.onerror = function () { URL.revokeObjectURL(url); showToast('PNG export failed'); };
    img.src = url;
  });

  function downloadBlob(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); }

  // ---- Copy code ----
  document.getElementById('copyCodeBtn').addEventListener('click', function () {
    var text = codeView.value;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){showToast('Copied');},function(){showToast('Copy failed');});
    else { codeView.select(); try{document.execCommand('copy');showToast('Copied');}catch(_){showToast('Copy failed');} }
  });

  codeView.addEventListener('change', function () {
    try {
      var tmp = document.createElement('div'); tmp.innerHTML = codeView.value;
      var parsed = tmp.querySelector('svg'); if (!parsed) return;
      sanitizeSvg(parsed);
      var toRemove = Array.from(artboard.children).filter(function (c) { return c.tagName !== 'defs' && c.id !== 'gridRect'; });
      toRemove.forEach(function (c) { c.remove(); });
      var defs = artboard.querySelector('defs') || el('defs');
      if (!artboard.querySelector('defs')) artboard.insertBefore(defs, artboard.firstChild);
      Array.from(parsed.children).forEach(function (child) {
        if (child.tagName === 'defs') { while (child.firstChild) defs.appendChild(child.firstChild); }
        else { var imported = document.createElementNS(SVG_NS, child.tagName.toLowerCase());
          for (var i = 0; i < child.attributes.length; i++) imported.setAttribute(child.attributes[i].name, child.attributes[i].value);
          imported.textContent = child.textContent;
          if (!imported.getAttribute('data-id')) imported.setAttribute('data-id', uid());
          artboard.appendChild(imported);
        }
      });
      deselect(); snapshot(); showToast('Source applied');
    } catch (err) { showToast('Invalid SVG'); }
  });

  // ---- Clear ----
  document.getElementById('clearBtn').addEventListener('click', function () {
    Array.from(artboard.children).forEach(function (c) { if (c.tagName !== 'defs' && c.id !== 'gridRect') c.remove(); });
    var defs = artboard.querySelector('defs'); if (defs) defs.innerHTML = '';
    deselect(); snapshot(); showToast('Canvas cleared');
  });

  // ---- Keyboard ----
  document.addEventListener('keydown', function (e) {
    var tag = e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (e.key === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'd' && selected.length) { e.preventDefault(); document.getElementById('duplicateBtn').click(); return; }
      if (e.key === 'g' && selected.length) { e.preventDefault(); if (e.shiftKey) document.getElementById('ungroupBtn').click(); else document.getElementById('groupBtn').click(); return; }
      if (e.key === 'a') { e.preventDefault(); selected = Array.from(artboard.children).filter(function(n){return n.tagName!=='defs'&&n.id!=='gridRect';}); updateSelection(); updateProps(); updateLayers(); updateActionButtons(); return; }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length) { e.preventDefault(); document.getElementById('deleteBtn').click(); }
    if (e.key === 'Escape') { deselect(); polygonPoints = []; if (polygonPreview) { polygonPreview.remove(); polygonPreview = null; } }
    // Arrow nudge
    if (selected.length && !spaceDown) {
      var step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') { e.preventDefault(); selected.forEach(function(n){ var bb=n.getBBox(); moveElement(n, bb.x - step, bb.y); }); updateSelection(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); selected.forEach(function(n){ var bb=n.getBBox(); moveElement(n, bb.x + step, bb.y); }); updateSelection(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selected.forEach(function(n){ var bb=n.getBBox(); moveElement(n, bb.x, bb.y - step); }); updateSelection(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); selected.forEach(function(n){ var bb=n.getBBox(); moveElement(n, bb.x, bb.y + step); }); updateSelection(); }
    }
    // Tool shortcuts
    if (e.key === '1') setTool('select');
    if (e.key === '2') setTool('rect');
    if (e.key === '3') setTool('ellipse');
    if (e.key === '4') setTool('line');
    if (e.key === '5') setTool('text');
    if (e.key === '6') setTool('pen');
    if (e.key === '7') setTool('polygon');
    if (e.key === '8') setTool('star');
  });

  document.addEventListener('keyup', function (e) {
    if (e.key.startsWith('Arrow') && selected.length) snapshot();
  });

  // ---- Helper: offset element ----
  function offsetElement(node, dx, dy) {
    var type = getElementType(node);
    if (type === 'rect' || type === 'image') { var x=parseFloat(node.getAttribute('x')); var y=parseFloat(node.getAttribute('y')); node.setAttribute('x', x+dx); node.setAttribute('y', y+dy); }
    else if (type === 'ellipse') { node.setAttribute('cx', parseFloat(node.getAttribute('cx'))+dx); node.setAttribute('cy', parseFloat(node.getAttribute('cy'))+dy); }
    else if (type === 'line') { node.setAttribute('x1',parseFloat(node.getAttribute('x1'))+dx);node.setAttribute('y1',parseFloat(node.getAttribute('y1'))+dy);node.setAttribute('x2',parseFloat(node.getAttribute('x2'))+dx);node.setAttribute('y2',parseFloat(node.getAttribute('y2'))+dy); }
    else if (type === 'text') { node.setAttribute('x', parseFloat(node.getAttribute('x'))+dx); node.setAttribute('y', parseFloat(node.getAttribute('y'))+dy); }
    else if (type === 'path') {
      var d = node.getAttribute('d');
      d = d.replace(/([MLml])\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g, function(m,cmd,a,b){ return cmd+' '+(parseFloat(a)+dx)+' '+(parseFloat(b)+dy); }).replace(/([Hh])\s*(-?[\d.]+)/g, function(m,cmd,a){ return cmd+' '+(parseFloat(a)+dx); }).replace(/([Vv])\s*(-?[\d.]+)/g, function(m,cmd,a){ return cmd+' '+(parseFloat(a)+dy); });
      node.setAttribute('d', d);
      if (node.getAttribute('data-cx')) { node.setAttribute('data-cx', parseFloat(node.getAttribute('data-cx'))+dx); node.setAttribute('data-cy', parseFloat(node.getAttribute('data-cy'))+dy); }
    }
  }

  // ---- Layers panel ----
  var sidebar = document.querySelector('.editor__sidebar');
  var layersPanel = document.createElement('div');
  layersPanel.className = 'editor__panel editor__panel--layers';
  layersPanel.innerHTML = '<div class="editor__panel-head"><span class="editor__panel-title">Layers</span><span class="editor__panel-sub" id="layerCount">0 elements</span></div><div class="editor__layers" id="layerList"></div>';
  sidebar.insertBefore(layersPanel, sidebar.firstChild);

  // ---- Init ----
  initGrid();
  applyViewBox();

  var initRect = el('rect', { x: 250, y: 200, width: 300, height: 200, rx: 12, fill: '#7dd3fc', stroke: '#203848', 'stroke-width': 3, 'data-id': uid() });
  artboard.appendChild(initRect);
  var initText = el('text', { x: 300, y: 310, 'font-size': 28, fill: '#203848', stroke: 'none', 'font-family': 'Inter, sans-serif', 'data-id': uid() });
  initText.textContent = 'Hello SVG';
  artboard.appendChild(initText);

  snapshot();
  selectSingle(initRect);
  updateLayers();
  window.addEventListener('resize', updateSelection);
})();
