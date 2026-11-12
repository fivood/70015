/**
 * 70015 — Bead Pattern
 * Image -> bead grid (pixel art / AI pixel art / any image) -> bead colors -> edit -> chart.
 * The algorithms live in beads-core.js; this file is the page.
 */
(function () {
  'use strict';

  var C = window.BeadsCore;
  var MAX_SIDE = 200; // beads per side; also keeps the exported chart within canvas limits
  var MM = 72 / 25.4; // PDF points per mm
  var PRINT_DPI = 300;
  var PAPERS = [[210, 297], [297, 210], [297, 420], [420, 297]]; // A4, A4 landscape, A3, A3 landscape (mm)

  function t(key, fallback) {
    var v = typeof window.t === 'function' ? window.t(key) : key;
    return v && v !== key ? v : fallback;
  }
  function tpl(key, fallback, vars) {
    return t(key, fallback).replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; });
  }
  function $(id) { return document.getElementById(id); }

  // Browser storage is a convenience: private windows or blocked storage just start empty.
  function readStore(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* not saved */ }
  }

  var toast = $('toast');
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-visible');
    setTimeout(function () { toast.classList.remove('is-visible'); }, 2200);
  }

  var el = {
    drop: $('bdDrop'), input: $('bdInput'),
    mode: $('bdMode'), modeNote: $('bdModeNote'),
    cellField: $('bdCellField'), cell: $('bdCell'), redetectWrap: $('bdRedetectWrap'), redetect: $('bdRedetect'),
    w: $('bdW'), h: $('bdH'), cmW: $('bdCmW'), cmH: $('bdCmH'),
    pitch: $('bdPitch'), pitchPreset: $('bdPitchPreset'), sizeNote: $('bdSizeNote'),
    palette: $('bdPalette'), paletteInput: $('bdPaletteInput'), paletteNote: $('bdPaletteNote'),
    ownedOnly: $('bdOwnedOnly'), ownedNote: $('bdOwnedNote'),
    pickMode: $('bdPickMode'), ownAll: $('bdOwnAll'), ownNone: $('bdOwnNone'), paletteGrid: $('bdPaletteGrid'),
    max: $('bdMax'), maxValue: $('bdMaxValue'), bg: $('bdBg'),
    result: $('bdResult'), status: $('bdStatus'), stats: $('bdStats'), progress: $('bdProgress'),
    tool: $('bdTool'), brushSwatch: $('bdBrushSwatch'), brushCode: $('bdBrushCode'),
    undo: $('bdUndo'), codes: $('bdCodes'), focus: $('bdFocus'), strays: $('bdStrays'),
    stage: $('bdStage'), canvas: $('bdCanvas'),
    usedNote: $('bdUsedNote'), legend: $('bdLegend'),
    board: $('bdBoard'), boardPdf: $('bdBoardPdf'),
    actions: $('bdActions'),
    settings: document.querySelector('.bd-settings'),
    newW: $('bdNewW'), newH: $('bdNewH'), newBtn: $('bdNewBtn'),
    works: $('bdWorks'), worksList: $('bdWorksList'),
    strip: $('bdStrip'), zoomIn: $('bdZoomIn'), zoomOut: $('bdZoomOut'), zoomFit: $('bdZoomFit')
  };

  var builtIn = {};
  Object.keys(window.BEAD_PALETTES).forEach(function (id) { builtIn[id] = C.parsePalette(window.BEAD_PALETTES[id]); });

  var state = {
    src: null,        // { data, w, h, img, name }
    mode: 'pixel',
    cell: 1,          // pixel / AI modes: source pixels per bead
    grid: null,       // AI mode: detected grid
    paletteId: 'mard',
    custom: null,     // { name, colors }
    palette: builtIn.mard,
    owned: new Set(), // codes the user has, per palette family
    pickMode: 'brush',
    w: 0, h: 0,
    pattern: null,    // Int16Array of palette indexes, -1 = no bead
    tool: 'brush',
    brush: 0,
    cs: 16,           // preview cell size in px
    undo: [],
    focus: false,     // one-color-at-a-time view
    focusColor: -1,
    done: new Set(),  // palette indexes placed already (one-color mode)
    progressKey: '',
    name: 'beads',    // used for file names and chart titles
    workId: '',       // the saved work this pattern belongs to
    zoom: 0           // preview cell size the user zoomed to; 0 = fit the screen
  };

  // ---------- Small UI helpers ----------

  function setSegmented(group, value) {
    [].forEach.call(group.querySelectorAll('.segmented__btn'), function (b) { b.classList.toggle('is-active', b.dataset.value === value); });
  }

  function onSegmented(group, fn) {
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-value]');
      if (btn) fn(btn.dataset.value);
    });
  }

  function setStatus(text) {
    el.status.hidden = !text;
    el.status.textContent = text || '';
  }

  function textColor(c) { return c.lab[0] > 60 ? '#000000' : '#ffffff'; }

  function numberIn(input, min, max, fallback) {
    var v = parseFloat(input.value);
    return v >= min && v <= max ? v : fallback;
  }

  // ---------- Source image ----------

  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      var name = file.name && file.name !== 'image.png' ? file.name.replace(/\.[^.]+$/, '') : 'beads';
      state.src = { data: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, img: img, name: name, jpeg: /jpe?g/.test(file.type) };
      state.name = name;
      state.workId = newWorkId();
      state.zoom = 0;
      el.w.value = el.h.value = ''; // a new image starts at its own size
      document.body.classList.add('is-working');
      el.settings.classList.remove('is-blank');
      autoMode();
      build();
    };
    img.onerror = function () { URL.revokeObjectURL(url); showToast(t('aip_load_fail', 'Could not read this image.')); };
    img.src = url;
  }

  // Small or cleanly upscaled images are pixel art; a strong regular edge grid means AI pixel art.
  function autoMode() {
    var s = state.src;
    var scale = C.detectScale(s.data, s.w, s.h);
    if (scale > 1 || (s.w <= MAX_SIDE && s.h <= MAX_SIDE)) {
      setMode('pixel', scale);
      return;
    }
    state.grid = C.detectGrid(s.data, s.w, s.h);
    // ponytail: strength threshold picked from test images; tune if photos get misread as AI art.
    if (state.grid && state.grid.x.strength > 2 && state.grid.x.p >= 4 && s.w / state.grid.x.p <= MAX_SIDE) {
      setMode('ai', state.grid.x.p);
    } else {
      setMode('photo');
    }
  }

  function setMode(mode, cell) {
    state.mode = mode;
    setSegmented(el.mode, mode);
    if (cell) state.cell = cell;
    el.cellField.hidden = mode === 'photo';
    el.redetectWrap.hidden = mode !== 'ai';
    el.cell.step = mode === 'ai' ? '0.1' : '1';
    el.cell.value = state.cell;
    renderModeNote();
  }

  function renderModeNote() {
    var notes = {
      pixel: t('bd_note_pixel', '1 pixel = 1 bead. Images exported at 2×, 3×… are scaled back automatically.'),
      ai: t('bd_note_ai', 'Finds the hidden pixel grid in AI-made pixel art and takes each cell\'s main color. If the grid looks off, change the cell size.'),
      photo: t('bd_note_photo', 'Shrinks the picture to the bead size you set. Leave height empty to keep the proportions.')
    };
    el.modeNote.textContent = notes[state.mode];
  }

  function pitch() { return numberIn(el.pitch, 1, 20, 2.6); }

  // Bead count from the width/height fields; an empty one follows the other's proportions.
  // Both empty: the natural size (nw x nh), or fallbackW wide for photos.
  // When the side that follows would pass MAX_SIDE, both shrink together to fit (never stretch);
  // capped: true tells the size note to say so. Two typed sides are used as typed.
  function targetSize(nw, nh, fallbackW) {
    var w = parseInt(el.w.value, 10) || 0, h = parseInt(el.h.value, 10) || 0;
    if (!w && !h) {
      if (!fallbackW) return { w: nw, h: nh };
      w = fallbackW;
    }
    var follows = !w || !h;
    if (!h) h = Math.max(1, Math.round(w * nh / nw));
    if (!w) w = Math.max(1, Math.round(h * nw / nh));
    if (follows && Math.max(w, h) > MAX_SIDE) {
      var k = MAX_SIDE / Math.max(w, h);
      return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), capped: true };
    }
    return { w: w, h: h };
  }

  // Source -> one RGBA cell per bead.
  function sampleCells() {
    var s = state.src, size;
    if (state.mode === 'photo') {
      state.natural = null;
      size = targetSize(s.w, s.h, Math.min(50, s.w));
      state.capped = !!size.capped;
      if (size.w > MAX_SIDE || size.h > MAX_SIDE) return { w: size.w, h: size.h };
      var c = document.createElement('canvas');
      c.width = size.w;
      c.height = size.h;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(s.img, 0, 0, size.w, size.h);
      return { w: size.w, h: size.h, data: ctx.getImageData(0, 0, size.w, size.h).data };
    }
    var g;
    if (state.mode === 'ai') {
      if (!state.grid || state.grid.x.p !== state.cell) state.grid = C.detectGrid(s.data, s.w, s.h, state.cell);
      g = state.grid;
    } else {
      g = { x: { p: state.cell, o: 0 }, y: { p: state.cell, o: 0 } };
    }
    var cells = C.sampleGrid(s.data, s.w, s.h, g.x, g.y);
    state.natural = { w: cells.w, h: cells.h };
    // A different bead count resamples the art's own grid, one median per new cell.
    size = targetSize(cells.w, cells.h);
    state.capped = !!size.capped;
    if (size.w === cells.w && size.h === cells.h) return cells;
    if (size.w > MAX_SIDE || size.h > MAX_SIDE) return { w: size.w, h: size.h };
    return C.sampleGrid(cells.data, cells.w, cells.h, { p: cells.w / size.w, o: 0 }, { p: cells.h / size.h, o: 0 }, true);
  }

  // Size fields after a build: bead counts as placeholders, centimetres from the bead size.
  function renderSize() {
    if (!state.pattern) return;
    var mm = pitch();
    el.w.placeholder = String(state.w);
    el.h.placeholder = String(state.h);
    if (document.activeElement !== el.cmW) el.cmW.value = (state.w * mm / 10).toFixed(1);
    if (document.activeElement !== el.cmH) el.cmH.value = (state.h * mm / 10).toFixed(1);
    var note = tpl('bd_size_note', '{w} × {h} beads of {mm} mm ≈ {cw} × {ch} cm. Type a size in cm to get the bead count; leave a bead field empty to keep the proportions.', {
      w: state.w, h: state.h, mm: mm, cw: (state.w * mm / 10).toFixed(1), ch: (state.h * mm / 10).toFixed(1)
    });
    var n = state.natural;
    if (n && (state.w !== n.w || state.h !== n.h)) {
      note += ' ' + tpl(state.w < n.w ? 'bd_size_down' : 'bd_size_up', state.w < n.w
        ? 'Shrunk from the art\'s {w} × {h}: thin lines and 1-pixel details may disappear.'
        : 'Enlarged from the art\'s {w} × {h}: each pixel becomes a block of beads.', { w: n.w, h: n.h });
    }
    if (state.capped) {
      note += ' ' + tpl('bd_size_capped', 'Kept within {max} beads per side, so both sides were scaled down together.', { max: MAX_SIDE });
    }
    el.sizeNote.textContent = note;
  }

  // FNV-1a over the generated pattern: the same image and settings give the same key,
  // so one-color progress comes back after a reload.
  function patternKey() {
    var h = 2166136261;
    function mix(v) { h = Math.imul(h ^ (v & 0xffff), 16777619) >>> 0; }
    mix(state.w); mix(state.h);
    for (var i = 0; i < state.pattern.length; i++) mix(state.pattern[i] + 1);
    state.palette.forEach(function (c) { for (var k = 0; k < c.code.length; k++) mix(c.code.charCodeAt(k)); });
    return '70015-beads-progress:' + h.toString(36);
  }

  // Rebuilding from settings starts over, so manual edits are dropped.
  // Without a source image (blank canvas, reopened work) there is nothing to rebuild from.
  function build() {
    if (!state.src) return;
    var cells = sampleCells();
    el.result.hidden = false;
    if (cells.w > MAX_SIDE || cells.h > MAX_SIDE) {
      state.pattern = null;
      setStatus(tpl('bd_too_big', 'That makes {w} × {h} beads, more than {max} per side. Set a smaller width or height under "Finished size" (beads or cm), or raise the pixels per bead.', { w: cells.w, h: cells.h, max: MAX_SIDE }));
      render();
      return;
    }
    // AI art and JPGs carry noise that would split one color across neighbouring bead shades.
    // Photos keep their gradients (and stay fast), so "Any image" is left alone.
    if (state.mode === 'ai' || (state.src.jpeg && state.mode === 'pixel')) C.mergeSimilar(cells.data, 5);
    var pattern = C.mapColors(cells.data, state.palette, allowedColors());
    pattern = C.limitColors(pattern, state.palette, parseInt(el.max.value, 10));
    // Tolerance 6 takes a JPG white's near-white shades along, but not skin or cream tones.
    if (el.bg.checked) C.removeBackground(pattern, cells.w, cells.h, state.palette, 6);
    state.w = cells.w;
    state.h = cells.h;
    state.pattern = pattern;
    state.undo = [];
    state.progressKey = patternKey();
    state.done = new Set();
    var doneCodes = readStore(state.progressKey, []);
    state.palette.forEach(function (c, i) { if (doneCodes.indexOf(c.code) >= 0) state.done.add(i); });
    var weak = state.mode === 'ai' && state.grid && state.grid.x.strength < 1.5;
    setStatus(weak ? t('bd_weak_grid', 'No clear pixel grid found. Check the result, change the cell size, or use "Any image".') : '');
    var counts = C.countColors(pattern, state.palette.length);
    if (state.brush >= 0 && !counts[state.brush]) state.brush = counts.indexOf(Math.max.apply(null, counts));
    if (state.focus) pickNextFocus();
    render();
  }

  // ---------- Drawing ----------

  function wholeGrid() { return { x0: 0, y0: 0, x1: state.w, y1: state.h }; }

  // Draw the beads of `region` (default: all) with its top-left at (ox, oy), cells cs px.
  // opts.codes: write color codes; opts.dim: fade every color except state.focusColor.
  function drawGrid(ctx, ox, oy, cs, opts) {
    var r = opts.region || wholeGrid();
    for (var y = r.y0; y < r.y1; y++) {
      for (var x = r.x0; x < r.x1; x++) drawCell(ctx, ox - r.x0 * cs, oy - r.y0 * cs, cs, y * state.w + x, opts);
    }
    drawMajorLines(ctx, ox, oy, cs, r);
  }

  // (ox, oy) is where bead (0, 0) would be drawn.
  function drawCell(ctx, ox, oy, cs, i, opts) {
    var x = i % state.w, y = (i - x) / state.w, v = state.pattern[i];
    var px = ox + x * cs, py = oy + y * cs;
    var c = v >= 0 ? state.palette[v] : null;
    var faded = opts.dim && v !== state.focusColor;
    ctx.fillStyle = c ? c.hex : '#ffffff';
    ctx.fillRect(px, py, cs, cs);
    if (faded && c) {
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillRect(px, py, cs, cs);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, cs - 1, cs - 1);
    if (c && !faded && opts.codes && cs >= 14) {
      ctx.fillStyle = textColor(c);
      ctx.font = '600 ' + Math.floor(Math.min(cs * 0.42, cs * 1.5 / c.code.length)) + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.code, px + cs / 2, py + cs / 2 + 0.5);
    }
  }

  // Thick lines every 10 beads (counted from the pattern's corner) plus the region outline.
  function drawMajorLines(ctx, ox, oy, cs, r) {
    var right = ox + (r.x1 - r.x0) * cs, bottom = oy + (r.y1 - r.y0) * cs;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = Math.max(1.5, cs / 12);
    ctx.beginPath();
    for (var x = Math.ceil(r.x0 / 10) * 10; x <= r.x1; x += 10) { var lx = ox + (x - r.x0) * cs; ctx.moveTo(lx, oy); ctx.lineTo(lx, bottom); }
    for (var y = Math.ceil(r.y0 / 10) * 10; y <= r.y1; y += 10) { var ly = oy + (y - r.y0) * cs; ctx.moveTo(ox, ly); ctx.lineTo(right, ly); }
    ctx.rect(ox, oy, right - ox, bottom - oy);
    ctx.stroke();
  }

  function previewOpts() { return { codes: el.codes.checked, dim: state.focus && state.focusColor >= 0 }; }

  // Largest cell size whose canvas stays within ~16 M pixels, iOS Safari's canvas limit.
  function maxCs() { return Math.max(4, Math.floor(Math.sqrt(16e6 / (state.w * state.h)))); }

  // Cell size that fits the stage (its width, and its max-height from the CSS), so the
  // whole pattern is visible without scrolling.
  function fitCs() {
    var availW = el.stage.clientWidth - 20;
    var mh = parseFloat(getComputedStyle(el.stage).maxHeight);
    var availH = (mh > 0 ? mh : window.innerHeight - 190) - 20;
    return Math.max(4, Math.min(32, Math.floor(Math.min(availW / state.w, availH / state.h))));
  }

  function renderCanvas() {
    state.cs = Math.max(4, Math.min(maxCs(), state.zoom || fitCs()));
    el.canvas.width = state.w * state.cs;
    el.canvas.height = state.h * state.cs;
    el.canvas.style.width = el.canvas.width + 'px';
    el.canvas.style.height = el.canvas.height + 'px';
    drawGrid(el.canvas.getContext('2d'), 0, 0, state.cs, previewOpts());
  }

  // Zoom to cell size cs, keeping the pattern point under (cx, cy) on screen where it was.
  function setZoom(cs, cx, cy) {
    var r = el.canvas.getBoundingClientRect();
    if (cx === undefined) {
      var s = el.stage.getBoundingClientRect();
      cx = Math.max(r.left, Math.min(r.right, s.left + s.width / 2));
      cy = Math.max(r.top, Math.min(r.bottom, s.top + s.height / 2));
    }
    var fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;
    state.zoom = Math.max(4, Math.min(maxCs(), Math.round(cs)));
    renderCanvas();
    keepPoint(fx, fy, cx, cy);
  }

  // Scroll the stage so the canvas fraction (fx, fy) sits at screen point (cx, cy).
  function keepPoint(fx, fy, cx, cy) {
    var r = el.canvas.getBoundingClientRect();
    el.stage.scrollLeft += r.left + fx * r.width - cx;
    el.stage.scrollTop += r.top + fy * r.height - cy;
  }

  el.zoomIn.addEventListener('click', function () { if (state.pattern) setZoom(Math.max(state.cs + 1, state.cs * 1.25)); });
  el.zoomOut.addEventListener('click', function () { if (state.pattern) setZoom(Math.min(state.cs - 1, state.cs / 1.25)); });
  el.zoomFit.addEventListener('click', function () { if (state.pattern) { state.zoom = 0; renderCanvas(); } });
  // Ctrl/⌘ + wheel (and trackpad pinch, which browsers report the same way) zooms.
  el.stage.addEventListener('wheel', function (e) {
    if (!state.pattern || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(state.cs * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
  }, { passive: false });

  function usedColors() {
    var counts = C.countColors(state.pattern, state.palette.length), used = [];
    counts.forEach(function (n, i) { if (n) used.push({ i: i, n: n }); });
    used.sort(function (a, b) { return b.n - a.n || a.i - b.i; });
    return used;
  }

  function statsText(used) {
    var total = used.reduce(function (s, u) { return s + u.n; }, 0);
    var mm = pitch();
    return tpl('bd_stats', '{w} × {h} beads · {colors} colors · {total} beads in total', { w: state.w, h: state.h, colors: used.length, total: total }) +
      ' · ' + tpl('bd_size_cm', '≈ {w} × {h} cm', { w: (state.w * mm / 10).toFixed(1), h: (state.h * mm / 10).toFixed(1) });
  }

  function renderInfo() {
    var used = usedColors();
    el.stats.textContent = statsText(used);
    el.usedNote.textContent = state.focus
      ? t('bd_used_note_focus', 'Click a color to show only that color. Tick ✓ when its beads are placed; progress is saved in this browser.')
      : t('bd_used_note', 'Click a color to paint with it; "Empty" erases, and with Fill clears a whole area. ⇄ replaces every bead of that color with the brush color (with "Empty" as the brush, it removes them).');
    renderProgress(used);
    el.legend.innerHTML = '';
    // "Empty" (no bead) comes first: as the brush it erases, with Fill it clears an area,
    // and its ⇄ fills every empty cell with the brush color.
    var entries = used.slice();
    if (!state.focus) {
      var placed = used.reduce(function (s, u) { return s + u.n; }, 0);
      entries.unshift({ i: -1, n: state.pattern.length - placed });
    }
    entries.forEach(function (u) {
      var c = state.palette[u.i];
      var row = document.createElement('div');
      row.className = 'bd-color' + (u.i === (state.focus ? state.focusColor : state.brush) ? ' is-active' : '') + (state.focus && state.done.has(u.i) ? ' is-done' : '');
      var pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'bd-color__pick';
      pick.innerHTML = '<span class="bd-swatch"></span><span class="bd-color__code"></span><span class="bd-color__count"></span>';
      if (c) pick.firstChild.style.background = c.hex;
      else pick.firstChild.classList.add('bd-swatch--empty');
      pick.children[1].textContent = c ? c.code : t('bd_empty_row', 'Empty (no bead)');
      pick.children[2].textContent = '× ' + u.n;
      pick.addEventListener('click', function () {
        if (state.focus) { state.focusColor = u.i; renderCanvas(); }
        setBrush(u.i);
        setTool('brush');
      });
      var side = document.createElement('button');
      side.type = 'button';
      side.className = 'bd-color__swap';
      if (state.focus) {
        side.textContent = '✓';
        side.title = t('bd_mark_done', 'Placed');
        side.setAttribute('aria-pressed', String(state.done.has(u.i)));
        side.addEventListener('click', function () { toggleDone(u.i); });
      } else {
        side.textContent = '⇄';
        side.title = tpl('bd_replace', 'Replace all {code} with {brush}', { code: codeOf(u.i), brush: codeOf(state.brush) });
        side.disabled = u.i === state.brush || !u.n;
        side.addEventListener('click', function () { replaceAll(u.i, state.brush); });
      }
      side.setAttribute('aria-label', side.title);
      row.appendChild(pick);
      row.appendChild(side);
      el.legend.appendChild(row);
    });
    var b = state.palette[state.brush];
    el.brushSwatch.style.background = b ? b.hex : '';
    el.brushSwatch.classList.toggle('bd-swatch--empty', !b);
    el.brushCode.textContent = codeOf(state.brush);
    renderPaletteMarks();
    renderStrip(used);
    el.undo.disabled = !state.undo.length;
    scheduleSave();
  }

  // Color strip for the phone dock: "empty", the colors in use (most used first), then the
  // rest of the palette, so every color is one swipe away from the canvas.
  function renderStrip(used) {
    var order = [-1].concat(used.map(function (u) { return u.i; }));
    var inUse = new Set(order);
    state.palette.forEach(function (c, i) { if (!inUse.has(i)) order.push(i); });
    el.strip.innerHTML = '';
    order.forEach(function (i, k) {
      var c = state.palette[i];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bd-strip__item' + (i === state.brush ? ' is-active' : '') + (k === used.length + 1 ? ' bd-strip__item--rest' : '');
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(i === state.brush));
      btn.innerHTML = '<span class="bd-swatch"></span><span class="bd-strip__code"></span>';
      if (c) btn.firstChild.style.background = c.hex;
      else btn.firstChild.classList.add('bd-swatch--empty');
      btn.lastChild.textContent = codeOf(i);
      btn.addEventListener('click', function () {
        if (state.focus && i >= 0) { state.focusColor = i; renderCanvas(); }
        setBrush(i);
        if (state.tool !== 'fill') setTool('brush');
      });
      el.strip.appendChild(btn);
    });
  }

  function renderProgress(used) {
    el.progress.hidden = !state.focus;
    if (!state.focus) return;
    var doneColors = 0, doneBeads = 0, total = 0;
    used.forEach(function (u) {
      total += u.n;
      if (state.done.has(u.i)) { doneColors++; doneBeads += u.n; }
    });
    el.progress.textContent = tpl('bd_progress', 'Placed: {dc} / {c} colors · {db} / {b} beads', { dc: doneColors, c: used.length, db: doneBeads, b: total });
  }

  // ---------- Bead colors and owned colors ----------

  function ownedKey() {
    return '70015-beads-owned:' + (state.paletteId === 'custom' ? 'custom:' + state.custom.name : 'mard');
  }

  function loadOwned() {
    state.owned = new Set(readStore(ownedKey(), []));
  }

  // Palette indexes the user marked as owned, or null to use every color.
  function allowedColors() {
    if (!el.ownedOnly.checked) return null;
    var list = [];
    state.palette.forEach(function (c, i) { if (state.owned.has(c.code)) list.push(i); });
    return list.length ? list : null;
  }

  function renderOwnedNote() {
    var n = state.palette.filter(function (c) { return state.owned.has(c.code); }).length;
    el.ownedNote.textContent = el.ownedOnly.checked && !n
      ? t('bd_owned_none', 'No colors marked yet, so all colors are used. Open "All bead colors" below and choose "Click to mark owned".')
      : tpl('bd_owned_note', '{n} colors marked as owned. Mark them under "All bead colors" with "Click to mark owned"; the list is saved in this browser.', { n: n });
  }

  function renderPaletteGrid() {
    el.paletteGrid.innerHTML = '';
    state.palette.forEach(function (c, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.style.background = c.hex;
      btn.style.color = textColor(c);
      btn.title = c.code + ' ' + c.hex;
      btn.setAttribute('aria-label', c.code);
      btn.addEventListener('click', function () { onPaletteClick(i); });
      el.paletteGrid.appendChild(btn);
    });
    renderPaletteMarks();
  }

  function renderPaletteMarks() {
    el.paletteGrid.classList.toggle('is-owned-only', el.ownedOnly.checked);
    [].forEach.call(el.paletteGrid.children, function (btn, i) {
      var owned = state.owned.has(state.palette[i].code);
      btn.classList.toggle('is-active', state.pickMode === 'brush' && i === state.brush);
      btn.classList.toggle('is-owned', owned);
      if (state.pickMode === 'owned') btn.setAttribute('aria-pressed', String(owned));
      else btn.removeAttribute('aria-pressed');
    });
  }

  function onPaletteClick(i) {
    if (state.pickMode === 'brush') {
      setBrush(i);
      setTool('brush');
      return;
    }
    var code = state.palette[i].code;
    if (state.owned.has(code)) state.owned.delete(code); else state.owned.add(code);
    ownedChanged();
  }

  function ownedChanged() {
    writeStore(ownedKey(), Array.from(state.owned));
    renderPaletteMarks();
    renderOwnedNote();
    if (el.ownedOnly.checked) build();
  }

  onSegmented(el.pickMode, function (mode) {
    state.pickMode = mode;
    setSegmented(el.pickMode, mode);
    el.paletteGrid.classList.toggle('is-marking', mode === 'owned');
    renderPaletteMarks();
  });
  el.ownAll.addEventListener('click', function () {
    state.palette.forEach(function (c) { state.owned.add(c.code); });
    ownedChanged();
  });
  el.ownNone.addEventListener('click', function () {
    state.palette.forEach(function (c) { state.owned.delete(c.code); });
    ownedChanged();
  });
  el.ownedOnly.addEventListener('change', function () {
    writeStore('70015-beads-owned-only', el.ownedOnly.checked);
    renderPaletteMarks();
    renderOwnedNote();
    build();
  });

  function render() {
    if (!state.pattern) {
      el.stats.textContent = '';
      el.progress.hidden = true;
      el.legend.innerHTML = '';
      el.canvas.width = el.canvas.height = 0;
      return;
    }
    renderCanvas();
    renderInfo();
    renderSize();
  }

  // ---------- Editing ----------

  // Brush -1 is "empty": painting or filling with it removes beads.
  function setBrush(i) { state.brush = i; renderInfo(); }

  function codeOf(i) { return i >= 0 && state.palette[i] ? state.palette[i].code : t('bd_empty', 'Empty'); }

  function setTool(tool) {
    state.tool = tool;
    setSegmented(el.tool, tool);
  }

  // Snapshots carry the size too: resizing a canvas is undoable like any edit.
  function pushUndo() {
    state.undo.push({ p: state.pattern.slice(), w: state.w, h: state.h });
    if (state.undo.length > 50) state.undo.shift();
  }

  function restore(snap) {
    state.pattern = snap.p;
    state.w = snap.w;
    state.h = snap.h;
  }

  function replaceAll(from, to) {
    if (from === to || (to >= 0 && !state.palette[to])) return;
    pushUndo();
    for (var i = 0; i < state.pattern.length; i++) if (state.pattern[i] === from) state.pattern[i] = to;
    render();
  }

  function cellAt(e) {
    var r = el.canvas.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left) / r.width * state.w);
    var y = Math.floor((e.clientY - r.top) / r.height * state.h);
    return x >= 0 && y >= 0 && x < state.w && y < state.h ? y * state.w + x : -1;
  }

  var painting = false;

  function paint(i) {
    var v = state.tool === 'eraser' ? -1 : state.brush;
    if (state.pattern[i] === v) return;
    state.pattern[i] = v;
    var ctx = el.canvas.getContext('2d');
    drawCell(ctx, 0, 0, state.cs, i, previewOpts());
    drawMajorLines(ctx, 0, 0, state.cs, wholeGrid());
  }

  // One finger (or the mouse) draws, or drags the view with the Move tool. Two fingers pinch
  // to zoom and drag to pan; if the second finger lands mid-stroke, that stroke is undone so a
  // pinch never leaves stray beads.
  var pointers = new Map(); // pointerId -> { x, y }
  var stroke = false;       // an edit started by the current touch, undone if it turns into a pinch
  var panning = null;       // Move tool: { x, y, left, top }
  var pinch = null;         // { dist, fx, fy, w, h, scale, mid }

  function pinchInfo() {
    var p = Array.from(pointers.values());
    return { dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, mid: { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } };
  }

  el.canvas.addEventListener('pointerdown', function (e) {
    if (!state.pattern || (e.pointerType === 'mouse' && e.button > 0)) return;
    try { el.canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      if (stroke) { restore(state.undo.pop()); stroke = false; render(); }
      painting = false;
      panning = null;
      var info = pinchInfo(), r = el.canvas.getBoundingClientRect();
      pinch = { dist: info.dist, fx: (info.mid.x - r.left) / r.width, fy: (info.mid.y - r.top) / r.height, w: r.width, h: r.height, scale: 1, mid: info.mid };
      return;
    }
    if (pointers.size > 2 || pinch) return;
    if (state.tool === 'pan') {
      panning = { x: e.clientX, y: e.clientY, left: el.stage.scrollLeft, top: el.stage.scrollTop };
      return;
    }
    var i = cellAt(e);
    if (i < 0) return;
    if (state.tool === 'pick') {
      setBrush(state.pattern[i]); // an empty cell picks the "empty" brush
      setTool('brush');
      return;
    }
    pushUndo();
    stroke = true;
    if (state.tool === 'fill') {
      C.floodFill(state.pattern, state.w, state.h, i % state.w, Math.floor(i / state.w), state.brush);
      render();
      return;
    }
    painting = true;
    paint(i);
  });

  el.canvas.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      // Scale the canvas with CSS while the fingers move; it is redrawn sharp on release.
      var info = pinchInfo();
      var scale = info.dist / pinch.dist;
      var cs = state.cs * scale;
      scale = Math.max(4, Math.min(maxCs(), cs)) / state.cs;
      el.canvas.style.width = pinch.w * scale + 'px';
      el.canvas.style.height = pinch.h * scale + 'px';
      keepPoint(pinch.fx, pinch.fy, info.mid.x, info.mid.y);
      pinch.scale = scale;
      pinch.mid = info.mid;
      return;
    }
    if (panning) {
      el.stage.scrollLeft = panning.left - (e.clientX - panning.x);
      el.stage.scrollTop = panning.top - (e.clientY - panning.y);
      return;
    }
    if (!painting) return;
    var i = cellAt(e);
    if (i >= 0) paint(i);
  });

  function endPointer(e) {
    if (!pointers.delete(e.pointerId)) return;
    if (pinch && pointers.size < 2) {
      var done = pinch;
      pinch = null;
      // Redraw at the new cell size; the point between the fingers stays put.
      var r = el.canvas.getBoundingClientRect();
      setZoom(state.cs * done.scale, r.left + done.fx * r.width, r.top + done.fy * r.height);
    }
    if (pointers.size) return;
    panning = null;
    stroke = false;
    if (painting) {
      painting = false;
      renderInfo();
    }
  }
  el.canvas.addEventListener('pointerup', endPointer);
  el.canvas.addEventListener('pointercancel', endPointer);

  function undo() {
    if (!state.undo.length) return;
    restore(state.undo.pop());
    render();
  }
  el.undo.addEventListener('click', undo);
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      undo();
    }
  });

  el.strays.addEventListener('click', function () {
    if (!state.pattern) return;
    pushUndo();
    var n = C.removeStrays(state.pattern, state.w, state.h);
    if (!n) state.undo.pop(); // nothing changed, so drop the snapshot
    showToast(n ? tpl('bd_strays_done', 'Cleaned up {n} stray beads. Undo brings them back.', { n: n }) : t('bd_strays_none', 'No stray beads found.'));
    render();
  });

  // ---------- One color at a time ----------

  function pickNextFocus() {
    if (!state.pattern) return;
    var used = usedColors();
    if (used.some(function (u) { return u.i === state.focusColor; })) return;
    var next = used.filter(function (u) { return !state.done.has(u.i); })[0] || used[0];
    state.focusColor = next ? next.i : -1;
  }

  function toggleDone(i) {
    if (state.done.has(i)) state.done.delete(i);
    else {
      state.done.add(i);
      // Move on to the next color still to place.
      if (state.focusColor === i) {
        var next = usedColors().filter(function (u) { return !state.done.has(u.i); })[0];
        if (next) state.focusColor = next.i;
      }
    }
    writeStore(state.progressKey, Array.from(state.done).map(function (k) { return state.palette[k].code; }));
    renderCanvas();
    renderInfo();
  }

  el.focus.addEventListener('change', function () {
    state.focus = el.focus.checked;
    if (state.focus) { state.focusColor = -1; pickNextFocus(); }
    if (state.pattern) render();
  });

  // ---------- Export ----------

  // Printable chart: title line, column/row numbers, grid with codes, color list with counts.
  // With `board`, red outlines and numbers show how the pattern splits onto pegboards.
  function chartCanvas(board) {
    if (!state.pattern) return null;
    var cs = Math.max(12, Math.min(32, Math.floor(4000 / Math.max(state.w, state.h))));
    var axis = Math.round(cs * 1.4), pad = cs, head = cs * 2;
    var used = usedColors();
    var gridW = state.w * cs, width = Math.max(pad * 2 + axis + gridW, 480);
    var itemW = cs * 5.5, perRow = Math.max(1, Math.floor((width - pad * 2) / itemW));
    var legendH = Math.ceil(used.length / perRow) * (cs * 1.5) + cs;
    var height = head + axis + state.h * cs + pad + legendH + pad;

    var c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    var font = 'Inter, system-ui, sans-serif';

    ctx.fillStyle = '#111827';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + Math.round(cs * 0.6) + 'px ' + font;
    ctx.fillText(state.name + ' · ' + statsText(used), pad, head / 2 + pad / 2);

    var ox = pad + axis, oy = head + axis;
    drawAxes(ctx, ox, oy, cs, axis, wholeGrid(), font);
    drawGrid(ctx, ox, oy, cs, { codes: true });

    if (board) {
      var cols = Math.ceil(state.w / board), rows = Math.ceil(state.h / board);
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = Math.max(2, cs / 6);
      ctx.font = '800 ' + Math.round(cs * 1.2) + 'px ' + font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (var r = 0; r < rows; r++) {
        for (var k = 0; k < cols; k++) {
          var bx = ox + k * board * cs, by = oy + r * board * cs;
          ctx.strokeRect(bx, by, Math.min(board, state.w - k * board) * cs, Math.min(board, state.h - r * board) * cs);
          var label = String(r * cols + k + 1);
          ctx.lineWidth = Math.max(3, cs / 5);
          ctx.strokeStyle = '#ffffff';
          ctx.strokeText(label, bx + cs * 0.3, by + cs * 0.3);
          ctx.fillStyle = '#e11d48';
          ctx.fillText(label, bx + cs * 0.3, by + cs * 0.3);
          ctx.strokeStyle = '#e11d48';
          ctx.lineWidth = Math.max(2, cs / 6);
        }
      }
    }

    var ly = oy + state.h * cs + pad + cs / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '600 ' + Math.round(cs * 0.5) + 'px ' + font;
    used.forEach(function (u, k) {
      var col = state.palette[u.i];
      var lx = pad + (k % perRow) * itemW, yy = ly + Math.floor(k / perRow) * cs * 1.5;
      ctx.fillStyle = col.hex;
      ctx.fillRect(lx, yy, cs, cs);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(lx + 0.5, yy + 0.5, cs - 1, cs - 1);
      ctx.fillStyle = '#111827';
      ctx.fillText(col.code + ' × ' + u.n, lx + cs * 1.3, yy + cs / 2);
    });
    return c;
  }

  // Column numbers above and row numbers left of the grid, counted across the whole pattern.
  function drawAxes(ctx, ox, oy, cs, axis, r, font) {
    ctx.font = '500 ' + Math.round(cs * 0.4) + 'px ' + font;
    ctx.fillStyle = '#4b5563';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var step = cs >= 16 ? 1 : 5;
    for (var x = r.x0 + 1; x <= r.x1; x++) if (x % step === 0 || x === r.x0 + 1) ctx.fillText(String(x), ox + (x - r.x0 - 0.5) * cs, oy - axis / 2);
    ctx.textAlign = 'right';
    for (var y = r.y0 + 1; y <= r.y1; y++) if (y % step === 0 || y === r.y0 + 1) ctx.fillText(String(y), ox - cs * 0.3, oy + (y - r.y0 - 0.5) * cs);
  }

  // One pegboard at PRINT_DPI with a title line and pattern-wide coordinates.
  function boardCanvas(region, cs, title) {
    var pxmm = PRINT_DPI / 25.4;
    var head = 9 * pxmm, axis = 6 * pxmm;
    var c = document.createElement('canvas');
    c.width = Math.ceil(axis + (region.x1 - region.x0) * cs + 4);
    c.height = Math.ceil(head + axis + (region.y1 - region.y0) * cs + 4);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    var font = 'Inter, system-ui, sans-serif';
    ctx.fillStyle = '#111827';
    ctx.font = '700 ' + Math.round(3.2 * pxmm) + 'px ' + font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 0, head / 2);
    drawAxes(ctx, axis, head + axis, cs, axis, region, font);
    drawGrid(ctx, axis, head + axis, cs, { codes: true, region: region });
    return c;
  }

  // Overview page, then one page per pegboard with the grid at real size (bead size in mm).
  function boardPdf() {
    if (!state.pattern) return Promise.resolve();
    var board = Math.round(numberIn(el.board, 5, 200, 29));
    var pitch = numberIn(el.pitch, 1, 20, 2.6);
    var margin = 10, pxmm = PRINT_DPI / 25.4, cs = pitch * pxmm;
    var bw = Math.min(board, state.w), bh = Math.min(board, state.h);
    var needW = 6 + bw * pitch + margin * 2, needH = 15 + bh * pitch + margin * 2;
    var paper = PAPERS.filter(function (p) { return p[0] >= needW && p[1] >= needH; })[0];
    if (!paper) {
      showToast(tpl('bd_board_too_big', 'A {n}-bead pegboard of {mm} mm beads is bigger than A3. Use a smaller pegboard size.', { n: board, mm: pitch }));
      return Promise.resolve();
    }
    var cols = Math.ceil(state.w / board), rows = Math.ceil(state.h / board), total = cols * rows;

    var ov = chartCanvas(board);
    var s = Math.min((210 - margin * 2) / ov.width, (297 - margin * 2) / ov.height); // mm per px
    var pages = [{ canvas: ov, pageW: 210 * MM, pageH: 297 * MM, x: margin * MM, y: (297 - margin - ov.height * s) * MM, w: ov.width * s * MM, h: ov.height * s * MM }];

    for (var r = 0; r < rows; r++) {
      for (var k = 0; k < cols; k++) {
        var region = { x0: k * board, y0: r * board, x1: Math.min(state.w, (k + 1) * board), y1: Math.min(state.h, (r + 1) * board) };
        var title = tpl('bd_board_title', '{name} · Board {n} of {total} (row {r}, column {c}) · columns {x0}–{x1}, rows {y0}–{y1} · {mm} mm beads', {
          name: state.name, n: r * cols + k + 1, total: total, r: r + 1, c: k + 1,
          x0: region.x0 + 1, x1: region.x1, y0: region.y0 + 1, y1: region.y1, mm: pitch
        });
        var bc = boardCanvas(region, cs, title);
        var wmm = bc.width / pxmm, hmm = bc.height / pxmm;
        pages.push({ canvas: bc, pageW: paper[0] * MM, pageH: paper[1] * MM, x: margin * MM, y: (paper[1] - margin - hmm) * MM, w: wmm * MM, h: hmm * MM });
      }
    }
    return window.pagesToPdf(pages, 0.88).then(function (blob) {
      ImageExport.download(blob, ImageExport.fileName(state.name + '-boards', 'pdf'));
    });
  }

  el.boardPdf.addEventListener('click', function () {
    var btn = el.boardPdf, label = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('exp_working', '…');
    // Let the button repaint before the heavy drawing starts.
    setTimeout(function () {
      boardPdf().catch(function (err) {
        console.error(err);
        showToast(t('exp_failed', 'Failed'));
      }).then(function () {
        btn.disabled = false;
        btn.textContent = label;
      });
    }, 30);
  });
  el.board.addEventListener('change', function () { writeStore('70015-beads-board', el.board.value); });

  // One pixel per bead, for opening the result back in Aseprite or another pixel editor.
  function pixelCanvas() {
    var c = document.createElement('canvas');
    c.width = state.w;
    c.height = state.h;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(state.w, state.h);
    for (var i = 0; i < state.pattern.length; i++) {
      var v = state.pattern[i];
      if (v < 0) continue;
      var rgb = state.palette[v].rgb;
      img.data[i * 4] = rgb[0]; img.data[i * 4 + 1] = rgb[1]; img.data[i * 4 + 2] = rgb[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  ImageExport.mountActions(el.actions, function () { return chartCanvas(0); }, {
    name: function () { return state.name + '-beads'; },
    skip: ['annotate']
  });
  var pixelBtn = document.createElement('button');
  pixelBtn.type = 'button';
  pixelBtn.className = 'btn btn--sm btn--secondary';
  pixelBtn.setAttribute('data-i18n', 'bd_export_pixel');
  pixelBtn.textContent = t('bd_export_pixel', 'Pixel PNG (1 bead = 1 px)');
  pixelBtn.addEventListener('click', function () {
    if (!state.pattern) return;
    ImageExport.toBlob(pixelCanvas(), 'image/png').then(function (b) {
      ImageExport.download(b, ImageExport.fileName(state.name + '-pixels', 'png'));
    });
  });
  el.actions.appendChild(pixelBtn);

  // ---------- Saved work ----------
  // Each pattern is saved in localStorage a moment after every change; the newest
  // MAX_WORKS stay. The source image is not kept, so a reopened work edits like a blank canvas.
  // ponytail: localStorage (~5 MB); a 200 × 200 work is ~110 KB, move to IndexedDB if people keep many big ones.

  var WORKS_KEY = '70015-beads-works', MAX_WORKS = 12;

  function newWorkId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function encodePattern(p) {
    var bytes = new Uint8Array(p.buffer, p.byteOffset, p.byteLength), s = '';
    for (var i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(s);
  }

  function decodePattern(b64) {
    var s = atob(b64), bytes = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return new Int16Array(bytes.buffer);
  }

  function thumbnail() {
    var px = pixelCanvas(), k = Math.max(1, Math.floor(72 / Math.max(state.w, state.h)));
    var c = document.createElement('canvas');
    c.width = state.w * k;
    c.height = state.h * k;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(px, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  function readWorks() {
    var works = readStore(WORKS_KEY, []);
    return Array.isArray(works) ? works : [];
  }

  function saveWork() {
    if (!state.pattern || !state.workId) return;
    var works = readWorks().filter(function (w) { return w.id !== state.workId; });
    works.unshift({
      id: state.workId,
      name: state.name,
      w: state.w,
      h: state.h,
      paletteId: state.paletteId,
      custom: state.paletteId === 'custom'
        ? { name: state.custom.name, text: state.custom.colors.map(function (c) { return c.code + ',' + c.hex; }).join('\n') }
        : null,
      pattern: encodePattern(state.pattern),
      done: Array.from(state.done).map(function (k) { return state.palette[k] ? state.palette[k].code : ''; }),
      updated: Date.now(),
      thumb: thumbnail()
    });
    works = works.slice(0, MAX_WORKS);
    // When storage is full, keep dropping the oldest until it fits (the current one always stays).
    while (works.length) {
      try { localStorage.setItem(WORKS_KEY, JSON.stringify(works)); break; } catch (e) {
        if (works.length === 1) break;
        works.pop();
      }
    }
    renderWorks();
  }

  var saveTimer;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWork, 800);
  }

  function openWork(id) {
    var w = readWorks().filter(function (x) { return x.id === id; })[0];
    if (!w) return;
    if (w.paletteId === 'custom' && w.custom) {
      state.custom = { name: w.custom.name, colors: C.parsePaletteText(w.custom.text) };
      state.paletteId = 'custom';
      state.palette = state.custom.colors;
    } else {
      state.paletteId = builtIn[w.paletteId] ? w.paletteId : 'mard';
      state.palette = builtIn[state.paletteId];
    }
    setSegmented(el.palette, state.paletteId);
    loadOwned();
    renderPaletteNote();
    renderOwnedNote();
    renderPaletteGrid();
    state.src = null;
    state.natural = null;
    state.capped = false;
    state.name = w.name || 'beads';
    state.workId = w.id;
    state.w = w.w;
    state.h = w.h;
    state.pattern = decodePattern(w.pattern);
    state.undo = [];
    state.zoom = 0;
    state.progressKey = '70015-beads-progress:work-' + w.id;
    state.done = new Set();
    state.palette.forEach(function (c, i) { if ((w.done || []).indexOf(c.code) >= 0) state.done.add(i); });
    if (!state.palette[state.brush]) state.brush = 0;
    el.w.value = el.h.value = '';
    setStatus('');
    enterEditor();
    render();
    el.result.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function deleteWork(id) {
    if (!window.confirm(t('bd_work_delete_confirm', 'Delete this saved work? This cannot be undone.'))) return;
    writeStore(WORKS_KEY, readWorks().filter(function (w) { return w.id !== id; }));
    if (state.workId === id) state.workId = ''; // keep editing, but stop saving it back
    renderWorks();
  }

  function renderWorks() {
    var works = readWorks();
    el.works.hidden = !works.length;
    el.worksList.innerHTML = '';
    works.forEach(function (w) {
      var item = document.createElement('div');
      item.className = 'bd-work' + (w.id === state.workId ? ' is-active' : '');
      var open = document.createElement('button');
      open.type = 'button';
      open.className = 'bd-work__open';
      open.innerHTML = '<img alt=""><span class="bd-work__name"></span><span class="bd-work__meta"></span>';
      open.firstChild.src = w.thumb || '';
      var name = w.name && w.name !== 'beads' ? w.name : t('bd_untitled', 'Untitled');
      open.children[1].textContent = name;
      open.children[2].textContent = w.w + ' × ' + w.h + ' · ' + new Date(w.updated).toLocaleDateString();
      open.setAttribute('aria-label', tpl('bd_work_open', 'Open {name}', { name: name }));
      open.addEventListener('click', function () { openWork(w.id); });
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'bd-work__delete';
      del.textContent = '×';
      del.title = t('bd_work_delete', 'Delete');
      del.setAttribute('aria-label', del.title + ' ' + name);
      del.addEventListener('click', function () { deleteWork(w.id); });
      item.appendChild(open);
      item.appendChild(del);
      el.worksList.appendChild(item);
    });
  }

  // ---------- Settings ----------

  onSegmented(el.mode, function (mode) {
    if (!state.src) { setMode(mode); return; }
    if (mode === 'pixel') setMode(mode, C.detectScale(state.src.data, state.src.w, state.src.h));
    else if (mode === 'ai') {
      state.grid = C.detectGrid(state.src.data, state.src.w, state.src.h);
      setMode(mode, state.grid ? state.grid.x.p : 8);
    } else setMode(mode);
    build();
  });

  el.cell.addEventListener('change', function () {
    var v = parseFloat(el.cell.value);
    if (!(v >= 1)) { el.cell.value = state.cell; return; }
    state.cell = state.mode === 'ai' ? Math.round(v * 10) / 10 : Math.round(v);
    el.cell.value = state.cell;
    build();
  });

  el.redetect.addEventListener('click', function () {
    if (!state.src) return;
    state.grid = C.detectGrid(state.src.data, state.src.w, state.src.h);
    if (state.grid) setMode('ai', state.grid.x.p);
    build();
  });

  // ---------- Blank canvas ----------

  // Show the editor; image-only settings hide when there is no source image.
  function enterEditor() {
    document.body.classList.add('is-working');
    el.settings.classList.toggle('is-blank', !state.src);
    el.result.hidden = false;
  }

  function newCanvas(w, h) {
    w = Math.max(1, Math.min(MAX_SIDE, parseInt(w, 10) || 29));
    h = Math.max(1, Math.min(MAX_SIDE, parseInt(h, 10) || 29));
    state.src = null;
    state.natural = null;
    state.capped = false;
    state.name = 'beads';
    state.workId = newWorkId();
    state.zoom = 0;
    state.w = w;
    state.h = h;
    state.pattern = new Int16Array(w * h).fill(-1);
    state.undo = [];
    state.done = new Set();
    state.progressKey = '70015-beads-progress:work-' + state.workId;
    el.w.value = el.h.value = '';
    // Start with black, the usual first outline color, when the palette has it.
    var black = state.palette.findIndex(function (c) { return c.hex === '#000000'; });
    state.brush = black >= 0 ? black : 0;
    setTool('brush');
    setStatus('');
    enterEditor();
    render();
  }
  el.newBtn.addEventListener('click', function () { newCanvas(el.newW.value, el.newH.value); });

  // Without a source image, new width/height resize the canvas itself; beads keep their
  // place from the top-left corner. Undoable.
  function resizeCanvas() {
    var size = targetSize(state.w, state.h);
    if (size.w === state.w && size.h === state.h) return;
    if (size.w > MAX_SIDE || size.h > MAX_SIDE) {
      setStatus(tpl('bd_too_big', 'That makes {w} × {h} beads, more than {max} per side.', { w: size.w, h: size.h, max: MAX_SIDE }));
      return;
    }
    pushUndo();
    var next = new Int16Array(size.w * size.h).fill(-1);
    for (var y = 0; y < Math.min(state.h, size.h); y++) {
      for (var x = 0; x < Math.min(state.w, size.w); x++) next[y * size.w + x] = state.pattern[y * state.w + x];
    }
    state.w = size.w;
    state.h = size.h;
    state.pattern = next;
    state.zoom = 0;
    setStatus('');
    render();
  }

  function sizeChanged() {
    if (state.src) build();
    else if (state.pattern) resizeCanvas();
  }
  el.w.addEventListener('change', sizeChanged);
  el.h.addEventListener('change', sizeChanged);

  // Without a source image, switching palettes moves each bead to its closest new color.
  function remapPattern(from, to) {
    var map = new Map();
    for (var i = 0; i < state.pattern.length; i++) {
      var v = state.pattern[i];
      if (v < 0) continue;
      if (!map.has(v)) map.set(v, from[v] ? C.nearest(from[v].lab, to) : 0);
      state.pattern[i] = map.get(v);
    }
  }

  // Bead size only changes the centimetres, not the pattern. Remembered for next time.
  function setPitch(mm) {
    el.pitch.value = mm;
    setSegmented(el.pitchPreset, String(numberIn(el.pitch, 1, 20, 2.6)));
    writeStore('70015-beads-pitch', el.pitch.value);
    if (state.pattern) { renderInfo(); renderSize(); }
  }
  el.pitch.addEventListener('change', function () { setPitch(el.pitch.value); });
  onSegmented(el.pitchPreset, setPitch);

  // Centimetres -> bead count for that side; the other side follows the proportions.
  function fromCm(input, beadField, otherField) {
    var cm = parseFloat(input.value);
    if (!(cm > 0)) return;
    beadField.value = Math.max(1, Math.round(cm * 10 / pitch()));
    otherField.value = '';
    sizeChanged();
  }
  el.cmW.addEventListener('change', function () { fromCm(el.cmW, el.w, el.h); });
  el.cmH.addEventListener('change', function () { fromCm(el.cmH, el.h, el.w); });

  function usePalette(id) {
    var before = state.palette;
    state.paletteId = id;
    state.palette = id === 'custom' ? state.custom.colors : builtIn[id];
    state.brush = 0;
    setSegmented(el.palette, id);
    loadOwned();
    renderPaletteNote();
    renderOwnedNote();
    renderPaletteGrid();
    if (state.src) build();
    else if (state.pattern) {
      remapPattern(before, state.palette);
      state.undo = []; // older snapshots hold the old palette's indexes
      render();
    }
  }

  function renderPaletteNote() {
    el.paletteNote.textContent = state.paletteId === 'custom'
      ? tpl('bd_pal_loaded', 'Using {name}: {n} colors.', { name: state.custom.name, n: state.custom.colors.length })
      : t('bd_pal_note', 'Import a .gpl or .hex palette (Aseprite, Lospec), or a text file with one "code,#RRGGBB" per line.');
  }

  onSegmented(el.palette, function (id) {
    if (id === 'custom') { el.paletteInput.click(); return; }
    usePalette(id);
  });

  el.paletteInput.addEventListener('change', function () {
    var file = el.paletteInput.files[0];
    el.paletteInput.value = '';
    if (!file) return;
    file.text().then(function (text) {
      var colors = C.parsePaletteText(text);
      if (colors.length < 2) { showToast(t('bd_pal_bad', 'No colors found in this file.')); return; }
      state.custom = { name: file.name, colors: colors };
      usePalette('custom');
    });
  });

  function renderMax() {
    var v = parseInt(el.max.value, 10);
    el.maxValue.textContent = v ? String(v) : t('bd_no_limit', 'No limit');
  }
  el.max.addEventListener('input', renderMax);
  el.max.addEventListener('change', build);
  el.bg.addEventListener('change', build);

  onSegmented(el.tool, setTool);
  el.codes.addEventListener('change', function () { if (state.pattern) renderCanvas(); });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (state.pattern) renderCanvas(); }, 150);
  });

  // ---------- Input ----------

  el.input.addEventListener('change', function () { loadFile(el.input.files[0]); el.input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (evt) {
    el.drop.addEventListener(evt, function (e) { e.preventDefault(); el.drop.classList.add('is-dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    el.drop.addEventListener(evt, function (e) { e.preventDefault(); el.drop.classList.remove('is-dragover'); });
  });
  el.drop.addEventListener('drop', function (e) { loadFile(e.dataTransfer.files[0]); });
  window.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (/^image\//.test(items[i].type)) { e.preventDefault(); loadFile(items[i].getAsFile()); return; }
    }
  });

  window.onLangChange = function () {
    renderModeNote();
    renderMax();
    renderPaletteNote();
    renderOwnedNote();
    renderWorks();
    if (state.pattern) renderInfo();
  };

  el.pitch.value = readStore('70015-beads-pitch', '2.6');
  setSegmented(el.pitchPreset, String(numberIn(el.pitch, 1, 20, 2.6)));
  el.board.value = readStore('70015-beads-board', '29');
  el.ownedOnly.checked = readStore('70015-beads-owned-only', false) === true;
  loadOwned();
  setMode('pixel', 1);
  renderMax();
  renderPaletteGrid();
  renderOwnedNote();
  renderWorks();

  // Opened from another tool's "Bead pattern" button (js/export.js).
  ImageExport.receiveHandoff('beads', function (blob) {
    loadFile(new File([blob], 'image.png', { type: 'image/png' }));
  });
})();
