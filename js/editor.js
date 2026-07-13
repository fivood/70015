/**
 * 70015 SVG Editor
 * Browser-based SVG drawing editor with per-element color control.
 * Tools: select, rectangle, ellipse, line, text, freehand pen.
 * Export SVG/PNG. Import SVG. Undo/redo. No upload.
 */

(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var artboard = document.getElementById('artboard');
  var stage = document.getElementById('stage');
  var overlay = document.getElementById('overlay');
  var selBox = document.getElementById('selBox');
  var handles = overlay.querySelectorAll('.editor__handle');
  var propType = document.getElementById('propType');
  var props = document.getElementById('props');
  var codeView = document.getElementById('codeView');
  var editorHint = document.getElementById('editorHint');
  var toast = document.getElementById('toast');

  var tool = 'select';
  var selected = null;
  var drawing = null;
  var dragging = null;
  var resizing = null;
  var penPoints = [];

  var history = [];
  var historyIdx = -1;
  var maxHistory = 50;

  var uidCounter = 0;
  function uid() { return 'el-' + (++uidCounter); }

  function showToast(msg, dur) { dur = dur || 2000; toast.textContent = msg; toast.classList.add('is-visible'); setTimeout(function () { toast.classList.remove('is-visible'); }, dur); }

  function el(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function snapshot() {
    history = history.slice(0, historyIdx + 1);
    history.push(artboard.innerHTML);
    if (history.length > maxHistory) history.shift();
    historyIdx = history.length - 1;
    updateHistoryButtons();
    syncCode();
  }

  function restore() {
    if (historyIdx < 0 || historyIdx >= history.length) return;
    artboard.innerHTML = history[historyIdx];
    selected = null;
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

  function getMouse(e) {
    var rect = stage.getBoundingClientRect();
    var scaleX = 800 / rect.width;
    var scaleY = 600 / rect.height;
    var scale = Math.max(scaleX, scaleY);
    var renderW = 800 / scale;
    var renderH = 600 / scale;
    var offsetX = (rect.width - renderW) / 2;
    var offsetY = (rect.height - renderH) / 2;
    return {
      x: Math.round((e.clientX - rect.left - offsetX) * scale),
      y: Math.round((e.clientY - rect.top - offsetY) * scale)
    };
  }

  function setTool(t) {
    tool = t;
    stage.dataset.tool = t;
    document.querySelectorAll('.tool').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.tool === t);
    });
    if (t !== 'select') {
      deselect();
    }
  }

  document.querySelectorAll('.tool').forEach(function (b) {
    b.addEventListener('click', function () { setTool(b.dataset.tool); });
  });

  function selectElement(node) {
    selected = node;
    updateSelection();
    updateProps();
    updateLayers();
    syncToolbar();
  }

  function deselect() {
    selected = null;
    updateSelection();
    updateProps();
    updateLayers();
    syncToolbar();
  }

  function updateSelection() {
    if (!selected) {
      selBox.hidden = true;
      handles.forEach(function (h) { h.hidden = true; });
      return;
    }
    var bbox = selected.getBBox();
    var rect = stage.getBoundingClientRect();
    var scale = Math.min(rect.width / 800, rect.height / 600);
    var renderW = 800 * scale;
    var renderH = 600 * scale;
    var offsetX = (rect.width - renderW) / 2;
    var offsetY = (rect.height - renderH) / 2;
    var x = offsetX + bbox.x * scale;
    var y = offsetY + bbox.y * scale;
    var w = bbox.width * scale;
    var h = bbox.height * scale;

    selBox.hidden = false;
    selBox.style.left = x + 'px';
    selBox.style.top = y + 'px';
    selBox.style.width = w + 'px';
    selBox.style.height = h + 'px';

    var pos = {
      nw: [x, y], n: [x + w / 2, y], ne: [x + w, y],
      e: [x + w, y + h / 2], se: [x + w, y + h],
      s: [x + w / 2, y + h], sw: [x, y + h], w: [x, y + h / 2]
    };
    handles.forEach(function (h) {
      var p = pos[h.dataset.h];
      h.hidden = false;
      h.style.left = p[0] + 'px';
      h.style.top = p[1] + 'px';
    });
  }

  function getCurrentFill() { return document.getElementById('fillColor').value; }
  function getCurrentStroke() { return document.getElementById('strokeColor').value; }
  function getCurrentStrokeWidth() { return parseInt(document.getElementById('strokeWidth').value, 10); }

  function syncToolbar() {
    if (!selected) return;
    var fill = selected.getAttribute('fill');
    var stroke = selected.getAttribute('stroke');
    var sw = selected.getAttribute('stroke-width');
    if (fill && fill !== 'none') document.getElementById('fillColor').value = normalizeHex(fill);
    if (stroke && stroke !== 'none') document.getElementById('strokeColor').value = normalizeHex(stroke);
    if (sw) { document.getElementById('strokeWidth').value = sw; document.getElementById('strokeWidthValue').textContent = sw; }
  }

  function normalizeHex(c) {
    if (!c) return '#000000';
    if (c[0] === '#') return c.length === 7 ? c : '#000000';
    var m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) return '#' + [1, 2, 3].map(function (i) { return ('0' + parseInt(m[i], 10).toString(16)).slice(-2); }).join('');
    return '#000000';
  }

  function getElementType(node) {
    return node.tagName.toLowerCase();
  }

  function updateProps() {
    props.innerHTML = '';
    if (!selected) {
      propType.textContent = 'Nothing selected';
      return;
    }

    var type = getElementType(selected);
    propType.textContent = type.charAt(0).toUpperCase() + type.slice(1);

    var fill = selected.getAttribute('fill') || 'none';
    var stroke = selected.getAttribute('stroke') || 'none';
    var sw = selected.getAttribute('stroke-width') || '0';
    var opacity = parseFloat(selected.getAttribute('opacity') || '1');

    var html = '';

    html += '<div class="prop-row prop-row--swatches">';
    html += '<label>Fill</label>';
    html += '<input type="color" id="propFill" value="' + (fill !== 'none' ? normalizeHex(fill) : '#000000') + '">';
    html += '<button class="color-swatch" data-fill="none" title="No fill" style="background: transparent; background-image: linear-gradient(45deg, var(--surface-3) 25%, transparent 25%), linear-gradient(-45deg, var(--surface-3) 25%, transparent 25%); background-size: 8px 8px;"></button>';
    SWATCHES.forEach(function (c) {
      html += '<button class="color-swatch" data-fill="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
    });
    html += '</div>';

    html += '<div class="prop-row prop-row--swatches">';
    html += '<label>Stroke</label>';
    html += '<input type="color" id="propStroke" value="' + (stroke !== 'none' ? normalizeHex(stroke) : '#000000') + '">';
    html += '<button class="color-swatch" data-stroke="none" title="No stroke" style="background: transparent; background-image: linear-gradient(45deg, var(--surface-3) 25%, transparent 25%), linear-gradient(-45deg, var(--surface-3) 25%, transparent 25%); background-size: 8px 8px;"></button>';
    SWATCHES.forEach(function (c) {
      html += '<button class="color-swatch" data-stroke="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
    });
    html += '</div>';

    html += '<div class="prop-row"><label>Width</label><input class="range" type="range" id="propStrokeWidth" min="0" max="40" value="' + sw + '"><span class="prop-value" id="propStrokeWidthVal">' + sw + '</span></div>';

    html += '<div class="prop-row"><label>Opacity</label><input class="range" type="range" id="propOpacity" min="0" max="100" value="' + Math.round(opacity * 100) + '"><span class="prop-value" id="propOpacityVal">' + Math.round(opacity * 100) + '</span></div>';

    if (type === 'text') {
      var ts = selected.textContent || '';
      var fs = selected.getAttribute('font-size') || '16';
      html += '<div class="prop-row"><label>Text</label><input type="text" id="propText" value="' + escapeAttr(ts) + '"></div>';
      html += '<div class="prop-row"><label>Font size</label><input class="range" type="range" id="propFontSize" min="8" max="96" value="' + fs + '"><span class="prop-value" id="propFontSizeVal">' + fs + '</span></div>';
    }

    props.innerHTML = html;
    bindPropEvents();
  }

  var SWATCHES = ['#7dd3fc', '#203848', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#000000', '#ffffff', '#6b7280', '#fbbf24'];

  function bindPropEvents() {
    if (!selected) return;

    var propFill = document.getElementById('propFill');
    if (propFill) propFill.addEventListener('input', function () {
      selected.setAttribute('fill', propFill.value);
      syncToolbar();
      updateLayers();
      syncCode();
    });

    var propStroke = document.getElementById('propStroke');
    if (propStroke) propStroke.addEventListener('input', function () {
      selected.setAttribute('stroke', propStroke.value);
      syncToolbar();
      updateLayers();
      syncCode();
    });

    var propSW = document.getElementById('propStrokeWidth');
    if (propSW) {
      propSW.addEventListener('input', function () {
        selected.setAttribute('stroke-width', propSW.value);
        document.getElementById('propStrokeWidthVal').textContent = propSW.value;
        syncToolbar();
        syncCode();
      });
    }

    var propOp = document.getElementById('propOpacity');
    if (propOp) {
      propOp.addEventListener('input', function () {
        selected.setAttribute('opacity', (propOp.value / 100).toFixed(2));
        document.getElementById('propOpacityVal').textContent = propOp.value;
        syncCode();
      });
    }

    var propText = document.getElementById('propText');
    if (propText) {
      propText.addEventListener('input', function () {
        selected.textContent = propText.value;
        syncCode();
      });
    }

    var propFS = document.getElementById('propFontSize');
    if (propFS) {
      propFS.addEventListener('input', function () {
        selected.setAttribute('font-size', propFS.value);
        document.getElementById('propFontSizeVal').textContent = propFS.value;
        syncCode();
      });
    }

    props.querySelectorAll('[data-fill]').forEach(function (s) {
      s.addEventListener('click', function () {
        selected.setAttribute('fill', s.dataset.fill);
        if (s.dataset.fill !== 'none') {
          propFill.value = normalizeHex(s.dataset.fill);
        }
        syncToolbar();
        updateLayers();
        syncCode();
      });
    });

    props.querySelectorAll('[data-stroke]').forEach(function (s) {
      s.addEventListener('click', function () {
        selected.setAttribute('stroke', s.dataset.stroke);
        if (s.dataset.stroke !== 'none') {
          propStroke.value = normalizeHex(s.dataset.stroke);
        }
        syncToolbar();
        updateLayers();
        syncCode();
      });
    });
  }

  function updateLayers() {
    var panel = document.querySelector('.editor__panel--layers');
    if (!panel) return;
    var list = panel.querySelector('.editor__layers');
    if (!list) return;
    var countEl = panel.querySelector('#layerCount');
    list.innerHTML = '';

    var nodes = Array.from(artboard.children).reverse();
    if (countEl) countEl.textContent = nodes.length + (nodes.length === 1 ? ' element' : ' elements');
    if (nodes.length === 0) {
      list.innerHTML = '<p style="font-size:12px;color:var(--text-dim);padding:8px 0;">No elements yet</p>';
      return;
    }
    nodes.forEach(function (node, i) {
      var type = getElementType(node);
      var fill = node.getAttribute('fill') || 'none';
      var item = document.createElement('div');
      item.className = 'layer-item' + (selected === node ? ' is-active' : '');
      var swatchColor = fill !== 'none' ? fill : 'transparent';
      item.innerHTML = '<span class="layer-item__swatch" style="background:' + swatchColor + '"></span><span class="layer-item__label">' + type + ' ' + (i + 1) + '</span><span class="layer-item__type">' + type + '</span>';
      item.addEventListener('click', function () {
        selectElement(node);
      });
      list.appendChild(item);
    });
  }

  function syncCode() {
    var source = artboard.innerHTML;
    codeView.value = source.replace(/></g, '>\n<');
  }

  function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---- Drawing ---- */

  stage.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.editor__handle')) {
      startResize(e);
      return;
    }
    if (tool === 'select') {
      var node = e.target.closest('[data-id]');
      if (node && node !== artboard) {
        selectElement(node);
        startDrag(e);
      } else {
        deselect();
      }
      return;
    }
    startDraw(e);
  });

  function startDraw(e) {
    var p = getMouse(e);
    drawing = { x: p.x, y: p.y };
    penPoints = [];

    var node;
    var id = uid();

    if (tool === 'rect') {
      node = el('rect', { x: p.x, y: p.y, width: 1, height: 1, rx: 0, fill: getCurrentFill(), stroke: getCurrentStroke(), 'stroke-width': getCurrentStrokeWidth(), 'data-id': id });
    } else if (tool === 'ellipse') {
      node = el('ellipse', { cx: p.x, cy: p.y, rx: 1, ry: 1, fill: getCurrentFill(), stroke: getCurrentStroke(), 'stroke-width': getCurrentStrokeWidth(), 'data-id': id });
    } else if (tool === 'line') {
      node = el('line', { x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: getCurrentStroke(), 'stroke-width': Math.max(1, getCurrentStrokeWidth()), 'data-id': id, fill: 'none' });
    } else if (tool === 'text') {
      node = el('text', { x: p.x, y: p.y, 'font-size': 24, fill: getCurrentFill(), stroke: 'none', 'data-id': id, 'font-family': 'Inter, sans-serif' });
      node.textContent = 'Text';
    } else if (tool === 'pen') {
      penPoints.push(p);
      node = el('path', { d: 'M' + p.x + ' ' + p.y, fill: 'none', stroke: getCurrentStroke(), 'stroke-width': Math.max(1, getCurrentStrokeWidth()), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-id': id });
    }

    if (node) {
      artboard.appendChild(node);
      drawing.node = node;
      drawing.id = id;
    }
  }

  stage.addEventListener('pointermove', function (e) {
    if (drawing) { updateDraw(e); return; }
    if (dragging) { updateDrag(e); return; }
    if (resizing) { updateResize(e); return; }
  });

  function updateDraw(e) {
    var p = getMouse(e);
    var node = drawing.node;
    if (!node) return;

    if (tool === 'rect') {
      var x = Math.min(drawing.x, p.x);
      var y = Math.min(drawing.y, p.y);
      var w = Math.max(1, Math.abs(p.x - drawing.x));
      var h = Math.max(1, Math.abs(p.y - drawing.y));
      node.setAttribute('x', x);
      node.setAttribute('y', y);
      node.setAttribute('width', w);
      node.setAttribute('height', h);
    } else if (tool === 'ellipse') {
      var cx = (drawing.x + p.x) / 2;
      var cy = (drawing.y + p.y) / 2;
      var rx = Math.max(1, Math.abs(p.x - drawing.x) / 2);
      var ry = Math.max(1, Math.abs(p.y - drawing.y) / 2);
      node.setAttribute('cx', cx);
      node.setAttribute('cy', cy);
      node.setAttribute('rx', rx);
      node.setAttribute('ry', ry);
    } else if (tool === 'line') {
      node.setAttribute('x2', p.x);
      node.setAttribute('y2', p.y);
    } else if (tool === 'pen') {
      penPoints.push(p);
      var d = 'M' + penPoints[0].x + ' ' + penPoints[0].y;
      for (var i = 1; i < penPoints.length; i++) {
        d += ' L' + penPoints[i].x + ' ' + penPoints[i].y;
      }
      node.setAttribute('d', d);
    }
  }

  stage.addEventListener('pointerup', function (e) {
    if (drawing) { endDraw(e); return; }
    if (dragging) { endDrag(e); return; }
    if (resizing) { endResize(e); return; }
  });

  function endDraw(e) {
    var node = drawing.node;
    drawing = null;
    penPoints = [];
    if (node) {
      selectElement(node);
      snapshot();
    }
  }

  /* ---- Drag / Move ---- */

  function startDrag(e) {
    if (!selected) return;
    var p = getMouse(e);
    var bbox = selected.getBBox();
    dragging = { sx: p.x, sy: p.y, bx: bbox.x, by: bbox.y };
    stage.setPointerCapture(e.pointerId);
  }

  function updateDrag(e) {
    var p = getMouse(e);
    var dx = p.x - dragging.sx;
    var dy = p.y - dragging.sy;
    moveElement(selected, dragging.bx + dx, dragging.by + dy);
    updateSelection();
  }

  function endDrag(e) {
    dragging = null;
    try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
    snapshot();
  }

  function moveElement(node, x, y) {
    var type = getElementType(node);
    if (type === 'rect') {
      node.setAttribute('x', Math.round(x));
      node.setAttribute('y', Math.round(y));
    } else if (type === 'ellipse') {
      var rx = parseFloat(node.getAttribute('rx'));
      var ry = parseFloat(node.getAttribute('ry'));
      node.setAttribute('cx', Math.round(x + rx));
      node.setAttribute('cy', Math.round(y + ry));
    } else if (type === 'line') {
      var x1 = parseFloat(node.getAttribute('x1'));
      var y1 = parseFloat(node.getAttribute('y1'));
      var x2 = parseFloat(node.getAttribute('x2'));
      var y2 = parseFloat(node.getAttribute('y2'));
      var w = x2 - x1, h = y2 - y1;
      node.setAttribute('x1', Math.round(x));
      node.setAttribute('y1', Math.round(y));
      node.setAttribute('x2', Math.round(x + w));
      node.setAttribute('y2', Math.round(y + h));
    } else if (type === 'text') {
      node.setAttribute('x', Math.round(x));
      node.setAttribute('y', Math.round(y + parseFloat(node.getAttribute('font-size') || 16) * 0.8));
    } else if (type === 'path') {
      var d = node.getAttribute('d');
      var nums = d.match(/-?[\d.]+/g);
      if (nums) {
        var origX = parseFloat(nums[0]);
        var origY = parseFloat(nums[1]);
        var ddx = Math.round(x - origX);
        var ddy = Math.round(y - origY);
        d = d.replace(/(-?[\d.]+)\s+(-?[\d.]+)/g, function (m, a, b) {
          return (parseFloat(a) + ddx) + ' ' + (parseFloat(b) + ddy);
        });
        node.setAttribute('d', d);
      }
    }
  }

  /* ---- Resize ---- */

  function startResize(e) {
    var handle = e.target.closest('.editor__handle');
    if (!handle || !selected) return;
    var dir = handle.dataset.h;
    var p = getMouse(e);
    var bbox = selected.getBBox();
    resizing = { dir: dir, sx: p.x, sy: p.y, bx: bbox.x, by: bbox.y, bw: bbox.width, bh: bbox.height };
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function updateResize(e) {
    var p = getMouse(e);
    var dx = p.x - resizing.sx;
    var dy = p.y - resizing.sy;
    var dir = resizing.dir;
    var type = getElementType(selected);

    var nx = resizing.bx;
    var ny = resizing.by;
    var nw = resizing.bw;
    var nh = resizing.bh;

    if (dir.indexOf('w') >= 0) { nx = resizing.bx + dx; nw = resizing.bw - dx; }
    if (dir.indexOf('e') >= 0) { nw = resizing.bw + dx; }
    if (dir.indexOf('n') >= 0) { ny = resizing.by + dy; nh = resizing.bh - dy; }
    if (dir.indexOf('s') >= 0) { nh = resizing.bh + dy; }

    nw = Math.max(2, nw);
    nh = Math.max(2, nh);

    if (type === 'rect') {
      selected.setAttribute('x', nx);
      selected.setAttribute('y', ny);
      selected.setAttribute('width', nw);
      selected.setAttribute('height', nh);
    } else if (type === 'ellipse') {
      selected.setAttribute('cx', nx + nw / 2);
      selected.setAttribute('cy', ny + nh / 2);
      selected.setAttribute('rx', nw / 2);
      selected.setAttribute('ry', nh / 2);
    } else if (type === 'line') {
      var x1 = parseFloat(selected.getAttribute('x1'));
      var y1 = parseFloat(selected.getAttribute('y1'));
      var x2 = parseFloat(selected.getAttribute('x2'));
      var y2 = parseFloat(selected.getAttribute('y2'));
      if (dir.indexOf('w') >= 0) { selected.setAttribute('x1', resizing.bx + dx); selected.setAttribute('y1', resizing.by + (dir.indexOf('n') >= 0 ? dy : 0)); }
      if (dir.indexOf('e') >= 0) { selected.setAttribute('x2', resizing.bx + resizing.bw + dx); selected.setAttribute('y2', resizing.by + resizing.bh + (dir.indexOf('s') >= 0 ? dy : 0)); }
      if (dir.indexOf('n') >= 0 && dir.indexOf('w') < 0 && dir.indexOf('e') < 0) { selected.setAttribute('y1', resizing.by + dy); }
      if (dir.indexOf('s') >= 0 && dir.indexOf('w') < 0 && dir.indexOf('e') < 0) { selected.setAttribute('y2', resizing.by + resizing.bh + dy); }
    } else if (type === 'text') {
      var fs = parseFloat(selected.getAttribute('font-size') || 16);
      var ratio = dir.indexOf('e') >= 0 || dir.indexOf('w') >= 0 ? nw / resizing.bw : nh / resizing.bh;
      var nfs = Math.max(8, Math.round(fs * ratio));
      selected.setAttribute('font-size', nfs);
      selected.setAttribute('x', nx);
      selected.setAttribute('y', ny + nfs * 0.8);
    } else if (type === 'image') {
      selected.setAttribute('x', nx);
      selected.setAttribute('y', ny);
      selected.setAttribute('width', nw);
      selected.setAttribute('height', nh);
    }
    updateSelection();
  }

  function endResize(e) {
    resizing = null;
    try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
    snapshot();
    updateProps();
  }

  /* ---- Toolbar controls ---- */

  document.getElementById('fillColor').addEventListener('input', function () {
    if (selected) { selected.setAttribute('fill', this.value); updateLayers(); syncCode(); }
  });
  document.getElementById('strokeColor').addEventListener('input', function () {
    if (selected) { selected.setAttribute('stroke', this.value); updateLayers(); syncCode(); }
  });
  document.getElementById('strokeWidth').addEventListener('input', function () {
    document.getElementById('strokeWidthValue').textContent = this.value;
    if (selected) { selected.setAttribute('stroke-width', this.value); syncCode(); }
  });

  /* ---- Actions ---- */

  document.getElementById('deleteBtn').addEventListener('click', function () {
    if (!selected) return;
    selected.remove();
    deselect();
    snapshot();
    showToast('Deleted');
  });

  document.getElementById('duplicateBtn').addEventListener('click', function () {
    if (!selected) return;
    var clone = selected.cloneNode(true);
    var type = getElementType(selected);
    clone.setAttribute('data-id', uid());
    if (type === 'rect' || type === 'ellipse' || type === 'image') {
      var x = parseFloat(clone.getAttribute('x') || clone.getAttribute('cx'));
      var y = parseFloat(clone.getAttribute('y') || clone.getAttribute('cy'));
      if (type === 'rect' || type === 'image') {
        clone.setAttribute('x', x + 20);
        clone.setAttribute('y', y + 20);
      } else {
        clone.setAttribute('cx', x + 20);
        clone.setAttribute('cy', y + 20);
      }
    } else if (type === 'line') {
      clone.setAttribute('x1', parseFloat(clone.getAttribute('x1')) + 20);
      clone.setAttribute('y1', parseFloat(clone.getAttribute('y1')) + 20);
      clone.setAttribute('x2', parseFloat(clone.getAttribute('x2')) + 20);
      clone.setAttribute('y2', parseFloat(clone.getAttribute('y2')) + 20);
    } else if (type === 'text') {
      clone.setAttribute('x', parseFloat(clone.getAttribute('x')) + 20);
      clone.setAttribute('y', parseFloat(clone.getAttribute('y')) + 20);
    } else if (type === 'path') {
      var d = clone.getAttribute('d');
      d = d.replace(/(-?[\d.]+)\s+(-?[\d.]+)/g, function (m, a, b) { return (parseFloat(a) + 20) + ' ' + (parseFloat(b) + 20); });
      clone.setAttribute('d', d);
    }
    artboard.appendChild(clone);
    selectElement(clone);
    snapshot();
    showToast('Duplicated');
  });

  document.getElementById('frontBtn').addEventListener('click', function () {
    if (!selected) return;
    artboard.appendChild(selected);
    snapshot();
    updateLayers();
    showToast('Brought to front');
  });

  document.getElementById('backBtn').addEventListener('click', function () {
    if (!selected) return;
    var first = artboard.firstChild;
    if (first) artboard.insertBefore(selected, first);
    else artboard.appendChild(selected);
    snapshot();
    updateLayers();
    showToast('Sent to back');
  });

  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);

  /* ---- Import ---- */

  var importBtn = document.getElementById('importBtn');
  var importInput = document.getElementById('importInput');
  importBtn.addEventListener('click', function () { importInput.click(); });
  importInput.addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var tmp = document.createElement('div');
        tmp.innerHTML = e.target.result;
        var svg = tmp.querySelector('svg');
        if (!svg) { showToast('No SVG found'); return; }
        artboard.setAttribute('viewBox', svg.getAttribute('viewBox') || '0 0 800 600');
        artboard.innerHTML = '';
        var children = Array.from(svg.children);
        children.forEach(function (child) {
          var imported = document.createElementNS(SVG_NS, child.tagName.toLowerCase());
          for (var i = 0; i < child.attributes.length; i++) {
            imported.setAttribute(child.attributes[i].name, child.attributes[i].value);
          }
          imported.textContent = child.textContent;
          imported.setAttribute('data-id', uid());
          artboard.appendChild(imported);
        });
        deselect();
        snapshot();
        showToast('Imported ' + children.length + ' elements');
      } catch (err) {
        showToast('Import failed');
      }
    };
    reader.readAsText(file);
    importInput.value = '';
  });

  /* ---- Export ---- */

  document.getElementById('exportSvgBtn').addEventListener('click', function () {
    var svg = artboard.cloneNode(true);
    svg.setAttribute('xmlns', SVG_NS);
    var source = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg.outerHTML.replace(/></g, '>\n<');
    var blob = new Blob([source], { type: 'image/svg+xml' });
    downloadBlob(blob, '70015-editor-' + Date.now() + '.svg');
  });

  document.getElementById('exportPngBtn').addEventListener('click', function () {
    var svg = artboard.cloneNode(true);
    svg.setAttribute('xmlns', SVG_NS);
    var source = svg.outerHTML;
    var blob = new Blob([source], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 600);
      ctx.drawImage(img, 0, 0, 800, 600);
      canvas.toBlob(function (pBlob) {
        downloadBlob(pBlob, '70015-editor-' + Date.now() + '.png');
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      showToast('PNG export failed');
    };
    img.src = url;
  });

  function downloadBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---- Copy code ---- */

  document.getElementById('copyCodeBtn').addEventListener('click', function () {
    codeView.select();
    document.execCommand('copy');
    showToast('Copied');
  });

  /* ---- Edit code directly ---- */

  codeView.addEventListener('change', function () {
    try {
      var tmp = document.createElement('div');
      tmp.innerHTML = codeView.value;
      var parsed = tmp.querySelector('svg');
      if (parsed) {
        artboard.innerHTML = parsed.innerHTML;
        Array.from(artboard.children).forEach(function (n) {
          if (!n.getAttribute('data-id')) n.setAttribute('data-id', uid());
        });
        deselect();
        snapshot();
        showToast('Source applied');
      }
    } catch (err) {
      showToast('Invalid SVG');
    }
  });

  /* ---- Clear ---- */

  document.getElementById('clearBtn').addEventListener('click', function () {
    artboard.innerHTML = '';
    deselect();
    snapshot();
    showToast('Canvas cleared');
  });

  /* ---- Keyboard shortcuts ---- */

  document.addEventListener('keydown', function (e) {
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') { e.preventDefault(); undo(); return; }
      if (e.key === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'd' && selected) { e.preventDefault(); document.getElementById('duplicateBtn').click(); return; }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selected) { e.preventDefault(); document.getElementById('deleteBtn').click(); }
    }
    if (e.key === 'Escape') deselect();
    if (e.key === '1') setTool('select');
    if (e.key === '2') setTool('rect');
    if (e.key === '3') setTool('ellipse');
    if (e.key === '4') setTool('line');
    if (e.key === '5') setTool('text');
    if (e.key === '6') setTool('pen');
  });

  /* ---- Layers panel ---- */

  var sidebar = document.querySelector('.editor__sidebar');
  var layersPanel = document.createElement('div');
  layersPanel.className = 'editor__panel editor__panel--layers';
  layersPanel.innerHTML = '<div class="editor__panel-head"><span class="editor__panel-title">Layers</span><span class="editor__panel-sub" id="layerCount">0 elements</span></div><div class="editor__layers" id="layerList"></div>';
  sidebar.insertBefore(layersPanel, sidebar.firstChild);

  /* ---- Init ---- */

  var initRect = el('rect', {
    x: 250, y: 200, width: 300, height: 200, rx: 12,
    fill: '#7dd3fc', stroke: '#203848', 'stroke-width': 3, 'data-id': uid()
  });
  artboard.appendChild(initRect);

  var initText = el('text', {
    x: 300, y: 310, 'font-size': 28, fill: '#203848', stroke: 'none',
    'font-family': 'Inter, sans-serif', 'data-id': uid()
  });
  initText.textContent = 'Hello SVG';
  artboard.appendChild(initText);

  snapshot();
  selectElement(initRect);
  updateLayers();

  window.addEventListener('resize', updateSelection);
})();
