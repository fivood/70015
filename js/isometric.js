/**
 * 70015 Isometric Studio (等距画板)
 * Standalone browser-based isometric modeling, floorplan extrusion, and 3D reference tool.
 */
(function () {
  'use strict';

  // 常数与数学
  var COS_30 = Math.cos(Math.PI / 6);
  var SIN_30 = Math.sin(Math.PI / 6);
  var ISO_30_ANGLES = [-150, -90, -30, 30, 90, 150];
  var GAME_21_ANGLES = [-153.435, -90, -26.565, 26.565, 90, 153.435];
  var PLAN_2D_ANGLES = [-180, -90, 0, 90, 180];

  // 状态
  var viewMode = 'iso'; // 'iso' | 'plan'
  var gridMode = 'true_iso_30'; // 'true_iso_30' | 'game_iso_2_1'
  var showGrid = true;
  var snapToGrid = true;
  var currentTool = 'box'; // 'select' | 'box' | 'plane' | 'brush' | 'line' | 'rect_2d' | 'eraser' | 'eyedropper'
  var currentPlane = 'top'; // 'top' | 'left' | 'right'
  var currentColor = '#317fa8';
  var hasOutline = true;
  var outlineColor = '#1f2937';
  var tileSize = 40;

  var shapes = [];
  var history = [[]];
  var historyIndex = 0;

  var pan = { x: 0, y: 0 };
  var zoom = 1.0;

  // 交互临时状态
  var isDragging = false;
  var isPanning = false;
  var isSpacePressed = false;
  var isAltPressed = false;
  var panStart = { x: 0, y: 0 };
  var startMouse = { x: 0, y: 0 };
  var currentMouse = { x: 0, y: 0 };
  var hoverPoint = null;
  var hoverHitFace = 'top';

  // 3D 盒子两段式拉伸状态
  var boxExtrudeStage = 'idle'; // 'idle' | 'drawing_base' | 'pulling_height'
  var boxBase = null;
  var boxHeight = 1.5;

  // 画笔笔触
  var currentBrushStroke = [];

  // DOM 元素
  var canvas, ctx, container, statusText;
  var toolBtns, viewModeBtns, planeBtns;
  var undoBtn, redoBtn, extrudeBtn, sampleBtn, exportBtn, clearBtn;
  var gridBtn, snapBtn;
  var fillColorInput, strokeColorInput, hasOutlineInput;
  var shadeTopBox, shadeLeftBox, shadeRightBox;

  // ==================== 核心数学函数 ====================

  function gridToScreen(gx, gy, gz, gMode, tSize) {
    gz = gz || 0;
    tSize = tSize || tileSize;
    gMode = gMode || gridMode;
    if (gMode === 'true_iso_30') {
      return {
        x: (gx - gy) * tSize * COS_30,
        y: (gx + gy) * tSize * SIN_30 - gz * tSize
      };
    } else {
      return {
        x: (gx - gy) * (tSize * 0.5),
        y: (gx + gy) * (tSize * 0.25) - gz * (tSize * 0.5)
      };
    }
  }

  function screenToGrid(sx, sy, gMode, tSize, gz) {
    gz = gz || 0;
    tSize = tSize || tileSize;
    gMode = gMode || gridMode;
    if (gMode === 'true_iso_30') {
      var adjustedY = sy + gz * tSize;
      var u = sx / (tSize * COS_30);
      var v = adjustedY / (tSize * SIN_30);
      return { gx: (u + v) / 2, gy: (v - u) / 2 };
    } else {
      var adjustedY2 = sy + gz * (tSize * 0.5);
      var u2 = sx / (tSize * 0.5);
      var v2 = adjustedY2 / (tSize * 0.25);
      return { gx: (u2 + v2) / 2, gy: (v2 - u2) / 2 };
    }
  }

  function snapToGridPoint(sx, sy, gMode, tSize, gz, step) {
    step = step || 1.0;
    var g = screenToGrid(sx, sy, gMode, tSize, gz);
    var snappedGx = Math.round(g.gx / step) * step;
    var snappedGy = Math.round(g.gy / step) * step;
    return {
      screen: gridToScreen(snappedGx, snappedGy, gz, gMode, tSize),
      grid: { gx: snappedGx, gy: snappedGy, gz: gz || 0 }
    };
  }

  function snapToIsometricAxis(startX, startY, currX, currY, gMode) {
    var dx = currX - startX;
    var dy = currY - startY;
    var length = Math.hypot(dx, dy);
    if (length < 3) return { point: { x: currX, y: currY }, angle: 0 };

    var currentAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    var targetAngles = gMode === 'true_iso_30' ? ISO_30_ANGLES : GAME_21_ANGLES;

    var closestAngle = targetAngles[0];
    var minDiff = Math.abs(currentAngleDeg - closestAngle);

    for (var i = 0; i < targetAngles.length; i++) {
      var angle = targetAngles[i];
      var diff = Math.abs(currentAngleDeg - angle);
      if (diff > 180) diff = 360 - diff;
      if (diff < minDiff) {
        minDiff = diff;
        closestAngle = angle;
      }
    }

    var rad = (closestAngle * Math.PI) / 180;
    return {
      point: { x: startX + length * Math.cos(rad), y: startY + length * Math.sin(rad) },
      angle: closestAngle
    };
  }

  function snapRayToGridStep(startX, startY, projX, projY, tSize) {
    var dx = projX - startX;
    var dy = projY - startY;
    var length = Math.hypot(dx, dy);
    if (length < 3) return { x: projX, y: projY };
    var unit = tSize || tileSize;
    var snapped = Math.round(length / unit) * unit;
    var scale = snapped / length;
    return { x: startX + dx * scale, y: startY + dy * scale };
  }

  // ==================== 颜色明暗推算 ====================

  function hexToRgb(hex) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(function (x) { return x + x; }).join('');
    var num = parseInt(c, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgbToHex(r, g, b) {
    var toH = function (n) {
      var cl = Math.max(0, Math.min(255, Math.round(n)));
      return cl.toString(16).padStart(2, '0');
    };
    return '#' + toH(r) + toH(g) + toH(b);
  }

  function hexToHsl(hex) {
    var rgb = hexToRgb(hex);
    var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var rNorm = 0, gNorm = 0, bNorm = 0;
    if (h >= 0 && h < 60) { rNorm = c; gNorm = x; }
    else if (h >= 60 && h < 120) { rNorm = x; gNorm = c; }
    else if (h >= 120 && h < 180) { gNorm = c; bNorm = x; }
    else if (h >= 180 && h < 240) { gNorm = x; bNorm = c; }
    else if (h >= 240 && h < 300) { rNorm = x; bNorm = c; }
    else { rNorm = c; bNorm = x; }
    return rgbToHex((rNorm + m) * 255, (gNorm + m) * 255, (bNorm + m) * 255);
  }

  function compute3Shades(baseColor) {
    var hsl = hexToHsl(baseColor);
    var topL = Math.min(95, hsl.l + 16);
    var topS = Math.max(10, hsl.s - 6);
    var leftL = Math.max(5, hsl.l - 4);
    var rightL = Math.max(5, hsl.l - 24);
    var rightS = Math.min(100, hsl.s + 8);
    return {
      topColor: hslToHex(hsl.h, topS, topL),
      leftColor: hslToHex(hsl.h, hsl.s, leftL),
      rightColor: hslToHex(hsl.h, rightS, rightL)
    };
  }

  // ==================== 顶点与图形辅助 ====================

  function getBoxVertices(box, gMode, tSize) {
    var gx = box.gx, gy = box.gy, gz = box.gz, gw = box.gw, gd = box.gd, gh = box.gh;
    return [
      gridToScreen(gx, gy, gz, gMode, tSize),
      gridToScreen(gx + gw, gy, gz, gMode, tSize),
      gridToScreen(gx + gw, gy + gd, gz, gMode, tSize),
      gridToScreen(gx, gy + gd, gz, gMode, tSize),
      gridToScreen(gx, gy, gz + gh, gMode, tSize),
      gridToScreen(gx + gw, gy, gz + gh, gMode, tSize),
      gridToScreen(gx + gw, gy + gd, gz + gh, gMode, tSize),
      gridToScreen(gx, gy + gd, gz + gh, gMode, tSize)
    ];
  }

  function getPlaneVertices(plane, gMode, tSize) {
    var gx = plane.gx, gy = plane.gy, gz = plane.gz, gw = plane.gw, gd = plane.gd;
    if (plane.planeType === 'top') {
      return [
        gridToScreen(gx, gy, gz, gMode, tSize),
        gridToScreen(gx + gw, gy, gz, gMode, tSize),
        gridToScreen(gx + gw, gy + gd, gz, gMode, tSize),
        gridToScreen(gx, gy + gd, gz, gMode, tSize)
      ];
    } else if (plane.planeType === 'left') {
      return [
        gridToScreen(gx, gy, gz, gMode, tSize),
        gridToScreen(gx, gy + gd, gz, gMode, tSize),
        gridToScreen(gx, gy + gd, gz + gw, gMode, tSize),
        gridToScreen(gx, gy, gz + gw, gMode, tSize)
      ];
    } else {
      return [
        gridToScreen(gx, gy, gz, gMode, tSize),
        gridToScreen(gx + gw, gy, gz, gMode, tSize),
        gridToScreen(gx + gw, gy, gz + gd, gMode, tSize),
        gridToScreen(gx, gy, gz + gd, gMode, tSize)
      ];
    }
  }

  function pointInPolygon(pt, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x, yi = poly[i].y;
      var xj = poly[j].x, yj = poly[j].y;
      var intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function detectHoveredFace(world) {
    var boxes = shapes.filter(function (s) { return s.type === 'box'; });
    for (var i = boxes.length - 1; i >= 0; i--) {
      var v = getBoxVertices(boxes[i], gridMode, tileSize);
      if (pointInPolygon(world, [v[4], v[5], v[6], v[7]])) return 'top';
      if (pointInPolygon(world, [v[3], v[2], v[6], v[7]])) return 'left';
      if (pointInPolygon(world, [v[2], v[1], v[5], v[6]])) return 'right';
    }
    return currentPlane;
  }

  // ==================== 渲染系统 ====================

  function toWorld(sx, sy) {
    return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom };
  }

  function getEffectivePoint(world) {
    if (!snapToGrid) return world;
    if (viewMode === 'iso') {
      var sn = snapToGridPoint(world.x, world.y, gridMode, tileSize, 0, 1.0);
      return sn.screen;
    } else {
      return { x: Math.round(world.x / 32) * 32, y: Math.round(world.y / 32) * 32 };
    }
  }

  function render() {
    if (!canvas || !ctx) return;
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 网格
    if (showGrid) {
      if (viewMode === 'iso') drawIsoGrid();
      else drawPlanGrid();
    }

    // 深度排序
    var sorted = shapes.slice().sort(function (a, b) {
      var dA = (a.type === 'box' || a.type === 'plane') ? (a.gx + a.gy) + (a.gz || 0) * 0.5 : 0;
      var dB = (b.type === 'box' || b.type === 'plane') ? (b.gx + b.gy) + (b.gz || 0) * 0.5 : 0;
      return dA - dB;
    });

    for (var i = 0; i < sorted.length; i++) {
      var s = sorted[i];
      if (s.type === 'box') drawBox(s);
      else if (s.type === 'plane') drawPlane(s);
      else if (s.type === 'brush_stroke') drawBrushStroke(s);
      else if (s.type === 'line') drawLine(s);
      else if (s.type === 'rect_2d') drawRect2D(s);
    }

    // 实时 3D 盒子高度拉伸
    if (boxExtrudeStage === 'pulling_height' && boxBase) {
      var shades = compute3Shades(currentColor);
      var tempBox = {
        type: 'box',
        gx: boxBase.gx,
        gy: boxBase.gy,
        gz: boxBase.gz,
        gw: boxBase.gw,
        gd: boxBase.gd,
        gh: boxHeight,
        topColor: shades.topColor,
        leftColor: shades.leftColor,
        rightColor: shades.rightColor,
        hasOutline: true,
        outlineColor: outlineColor
      };
      drawBox(tempBox);
      drawHeightIndicator(tempBox);
    }

    // 拖拽预览
    if (isDragging && !isSpacePressed && !isPanning && boxExtrudeStage !== 'pulling_height') {
      drawPreview();
    }

    // 磁吸或 3D 表面贴面光标
    if (!isPanning && !isSpacePressed && hoverPoint) {
      if (currentTool === 'brush') {
        drawSurfaceBrushCursor(hoverPoint, hoverHitFace);
      } else if (snapToGrid) {
        drawSnapCursor(hoverPoint);
      }
    }

    ctx.restore();
    updateStatusBar();
  }

  function drawIsoGrid() {
    ctx.save();
    ctx.strokeStyle = 'var(--border)';
    ctx.lineWidth = 0.5 / zoom;
    var range = 25;
    for (var gx = -range; gx <= range; gx++) {
      var p1 = gridToScreen(gx, -range, 0);
      var p2 = gridToScreen(gx, range, 0);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (var gy = -range; gy <= range; gy++) {
      var q1 = gridToScreen(-range, gy, 0);
      var q2 = gridToScreen(range, gy, 0);
      ctx.beginPath();
      ctx.moveTo(q1.x, q1.y);
      ctx.lineTo(q2.x, q2.y);
      ctx.stroke();
    }

    // 原点
    var o = gridToScreen(0, 0, 0);
    var xEnd = gridToScreen(2, 0, 0);
    ctx.strokeStyle = 'var(--primary)';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(xEnd.x, xEnd.y);
    ctx.stroke();

    var yEnd = gridToScreen(0, 2, 0);
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(yEnd.x, yEnd.y);
    ctx.stroke();

    var zEnd = gridToScreen(0, 0, 2);
    ctx.strokeStyle = 'var(--text)';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(zEnd.x, zEnd.y);
    ctx.stroke();

    ctx.font = Math.max(9, Math.round(10 / zoom)) + 'px sans-serif';
    ctx.fillStyle = 'var(--text-muted)';
    ctx.fillText('+X', xEnd.x + 4 / zoom, xEnd.y + 4 / zoom);
    ctx.fillText('+Y', yEnd.x - 16 / zoom, yEnd.y + 4 / zoom);
    ctx.fillStyle = 'var(--text)';
    ctx.fillText('+Z (H)', zEnd.x - 14 / zoom, zEnd.y - 4 / zoom);

    ctx.restore();
  }

  function drawPlanGrid() {
    ctx.save();
    ctx.strokeStyle = 'var(--border)';
    ctx.lineWidth = 0.5 / zoom;
    var range = 40 * 32;
    for (var x = -range; x <= range; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, -range);
      ctx.lineTo(x, range);
      ctx.stroke();
    }
    for (var y = -range; y <= range; y += 32) {
      ctx.beginPath();
      ctx.moveTo(-range, y);
      ctx.lineTo(range, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBox(b) {
    var v = getBoxVertices(b);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = b.hasOutline ? (b.outlineColor || 'var(--border)') : 'transparent';

    // Left
    ctx.beginPath();
    ctx.moveTo(v[3].x, v[3].y); ctx.lineTo(v[2].x, v[2].y); ctx.lineTo(v[6].x, v[6].y); ctx.lineTo(v[7].x, v[7].y);
    ctx.closePath();
    ctx.fillStyle = b.leftColor;
    ctx.fill();
    if (b.hasOutline) ctx.stroke();

    // Right
    ctx.beginPath();
    ctx.moveTo(v[2].x, v[2].y); ctx.lineTo(v[1].x, v[1].y); ctx.lineTo(v[5].x, v[5].y); ctx.lineTo(v[6].x, v[6].y);
    ctx.closePath();
    ctx.fillStyle = b.rightColor;
    ctx.fill();
    if (b.hasOutline) ctx.stroke();

    // Top
    ctx.beginPath();
    ctx.moveTo(v[4].x, v[4].y); ctx.lineTo(v[5].x, v[5].y); ctx.lineTo(v[6].x, v[6].y); ctx.lineTo(v[7].x, v[7].y);
    ctx.closePath();
    ctx.fillStyle = b.topColor;
    ctx.fill();
    if (b.hasOutline) ctx.stroke();
    ctx.restore();
  }

  function drawPlane(p) {
    var pts = getPlaneVertices(p);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach(function (pt) { ctx.lineTo(pt.x, pt.y); });
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
    if (p.hasOutline) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = p.outlineColor || 'var(--border)';
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBrushStroke(st) {
    if (st.points.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(st.points[0].x, st.points[0].y);
    for (var i = 1; i < st.points.length; i++) {
      ctx.lineTo(st.points[i].x, st.points[i].y);
    }
    ctx.lineWidth = st.size || 3;
    ctx.strokeStyle = st.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawLine(l) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(l.start.x, l.start.y);
    ctx.lineTo(l.end.x, l.end.y);
    ctx.lineWidth = l.width || 2;
    ctx.strokeStyle = l.color;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawRect2D(r) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.width, r.height);
    ctx.fillStyle = r.fillColor;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = r.outlineColor || 'var(--border)';
    ctx.stroke();
    ctx.restore();
  }

  function drawHeightIndicator(b) {
    var v = getBoxVertices(b);
    ctx.save();
    ctx.strokeStyle = 'var(--text)';
    ctx.setLineDash([2, 2]);
    ctx.lineWidth = 1.2 / zoom;
    ctx.beginPath();
    ctx.moveTo(v[2].x, v[2].y);
    ctx.lineTo(v[6].x, v[6].y);
    ctx.stroke();

    var labelX = v[6].x + 12 / zoom;
    var labelY = (v[2].y + v[6].y) / 2;
    var tag = 'H: ' + b.gh.toFixed(1) + ' (Click)';
    ctx.font = 'bold ' + Math.max(9, Math.round(10.5 / zoom)) + 'px monospace';
    ctx.fillStyle = 'var(--surface)';
    ctx.fillRect(labelX - 2 / zoom, labelY - 8 / zoom, 100 / zoom, 16 / zoom);
    ctx.fillStyle = 'var(--text)';
    ctx.fillText(tag, labelX, labelY + 4 / zoom);
    ctx.restore();
  }

  function drawSurfaceBrushCursor(pt, face) {
    ctx.save();
    ctx.strokeStyle = 'var(--primary)';
    ctx.lineWidth = 1.5 / zoom;
    var r = 8 / zoom;
    ctx.beginPath();
    if (face === 'top') {
      ctx.moveTo(pt.x, pt.y - r * 0.58);
      ctx.lineTo(pt.x + r, pt.y);
      ctx.lineTo(pt.x, pt.y + r * 0.58);
      ctx.lineTo(pt.x - r, pt.y);
    } else if (face === 'left') {
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - r * 0.86, pt.y + r * 0.5);
      ctx.lineTo(pt.x - r * 0.86, pt.y - r * 0.8);
      ctx.lineTo(pt.x, pt.y - r * 1.3);
    } else {
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + r * 0.86, pt.y + r * 0.5);
      ctx.lineTo(pt.x + r * 0.86, pt.y - r * 0.8);
      ctx.lineTo(pt.x, pt.y - r * 1.3);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(49, 127, 168, 0.2)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawSnapCursor(pt) {
    ctx.save();
    ctx.strokeStyle = 'var(--primary)';
    ctx.fillStyle = 'var(--primary)';
    ctx.lineWidth = 1 / zoom;
    var size = 3 / zoom;
    ctx.beginPath();
    ctx.moveTo(pt.x - size, pt.y); ctx.lineTo(pt.x + size, pt.y);
    ctx.moveTo(pt.x, pt.y - size); ctx.lineTo(pt.x, pt.y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.5 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPreview() {
    ctx.save();
    if (viewMode === 'iso') {
      if (currentTool === 'box') {
        var gStart = screenToGrid(startMouse.x, startMouse.y);
        var gCurr = screenToGrid(currentMouse.x, currentMouse.y);
        var step = snapToGrid ? 1.0 : 0.5;
        var gx = Math.min(Math.round(gStart.gx / step) * step, Math.round(gCurr.gx / step) * step);
        var gy = Math.min(Math.round(gStart.gy / step) * step, Math.round(gCurr.gy / step) * step);
        var gw = Math.max(step, Math.abs(Math.round((gCurr.gx - gStart.gx) / step) * step) || step);
        var gd = Math.max(step, Math.abs(Math.round((gCurr.gy - gStart.gy) / step) * step) || step);

        var pts = [
          gridToScreen(gx, gy, 0),
          gridToScreen(gx + gw, gy, 0),
          gridToScreen(gx + gw, gy + gd, 0),
          gridToScreen(gx, gy + gd, 0)
        ];
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.forEach(function (p) { ctx.lineTo(p.x, p.y); });
        ctx.closePath();
        ctx.fillStyle = 'rgba(49, 127, 168, 0.25)';
        ctx.fill();
        ctx.strokeStyle = 'var(--primary)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (currentTool === 'plane') {
        var gS = screenToGrid(startMouse.x, startMouse.y);
        var gC = screenToGrid(currentMouse.x, currentMouse.y);
        var stp = snapToGrid ? 1.0 : 0.5;
        var gpx = Math.min(Math.round(gS.gx / stp) * stp, Math.round(gC.gx / stp) * stp);
        var gpy = Math.min(Math.round(gS.gy / stp) * stp, Math.round(gC.gy / stp) * stp);
        var gpw = Math.max(stp, Math.abs(Math.round((gC.gx - gS.gx) / stp) * stp) || stp);
        var gpd = Math.max(stp, Math.abs(Math.round((gC.gy - gS.gy) / stp) * stp) || stp);

        var previewPlane = {
          type: 'plane',
          planeType: currentPlane,
          gx: gpx, gy: gpy, gz: 0, gw: gpw, gd: gpd,
          color: currentColor,
          hasOutline: true,
          outlineColor: outlineColor
        };
        ctx.globalAlpha = 0.8;
        drawPlane(previewPlane);
      } else if (currentTool === 'brush') {
        if (currentBrushStroke.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(currentBrushStroke[0].x, currentBrushStroke[0].y);
          for (var i = 1; i < currentBrushStroke.length; i++) {
            ctx.lineTo(currentBrushStroke[i].x, currentBrushStroke[i].y);
          }
          ctx.lineWidth = 3;
          ctx.strokeStyle = currentColor;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      } else if (currentTool === 'line') {
        var snapped = snapToIsometricAxis(startMouse.x, startMouse.y, currentMouse.x, currentMouse.y, gridMode);
        var endP = snapToGrid ? snapRayToGridStep(startMouse.x, startMouse.y, snapped.point.x, snapped.point.y) : snapped.point;
        ctx.beginPath();
        ctx.moveTo(startMouse.x, startMouse.y);
        ctx.lineTo(endP.x, endP.y);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else {
      if (currentTool === 'rect_2d') {
        ctx.fillStyle = currentColor;
        ctx.strokeStyle = 'var(--primary)';
        var rx = Math.min(startMouse.x, currentMouse.x);
        var ry = Math.min(startMouse.y, currentMouse.y);
        var rw = Math.abs(currentMouse.x - startMouse.x);
        var rh = Math.abs(currentMouse.y - startMouse.y);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      }
    }
    ctx.restore();
  }

  // ==================== 状态与交互 ====================

  function pushState(newShapes) {
    shapes = newShapes;
    history = history.slice(0, historyIndex + 1);
    history.push(shapes.slice());
    historyIndex++;
    updateUndoRedoBtns();
    render();
  }

  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      shapes = history[historyIndex].slice();
      updateUndoRedoBtns();
      render();
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      shapes = history[historyIndex].slice();
      updateUndoRedoBtns();
      render();
    }
  }

  function updateUndoRedoBtns() {
    if (undoBtn) undoBtn.disabled = historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= history.length - 1;
  }

  function updateShadeBoxes() {
    var sh = compute3Shades(currentColor);
    if (shadeTopBox) { shadeTopBox.style.backgroundColor = sh.topColor; shadeTopBox.title = 'Top: ' + sh.topColor; }
    if (shadeLeftBox) { shadeLeftBox.style.backgroundColor = sh.leftColor; shadeLeftBox.title = 'Left: ' + sh.leftColor; }
    if (shadeRightBox) { shadeRightBox.style.backgroundColor = sh.rightColor; shadeRightBox.title = 'Right: ' + sh.rightColor; }
  }

  function updateStatusBar() {
    if (!statusText) return;
    statusText.textContent = (viewMode === 'iso' ? '3D Iso' : '2D Plan') +
      ' | Tool: ' + currentTool + (currentTool === 'plane' || currentTool === 'brush' ? ' (' + currentPlane + ')' : '') +
      ' | Zoom: ' + Math.round(zoom * 100) + '%' +
      ' | Objects: ' + shapes.length;
  }

  // ==================== 事件监听 ====================

  function handleMouseDown(e) {
    var rect = canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;
    var rawWorld = toWorld(sx, sy);
    var world = getEffectivePoint(rawWorld);

    if (e.button === 1 || isSpacePressed || e.button === 2) {
      if (e.button === 2 && boxExtrudeStage === 'pulling_height') {
        boxExtrudeStage = 'idle';
        boxBase = null;
        render();
        return;
      }
      isPanning = true;
      panStart = { x: sx - pan.x, y: sy - pan.y };
      return;
    }

    if (boxExtrudeStage === 'pulling_height' && boxBase) {
      var sh = compute3Shades(currentColor);
      var newBox = {
        type: 'box',
        gx: boxBase.gx,
        gy: boxBase.gy,
        gz: boxBase.gz,
        gw: boxBase.gw,
        gd: boxBase.gd,
        gh: Math.max(0.2, boxHeight),
        baseColor: currentColor,
        topColor: sh.topColor,
        leftColor: sh.leftColor,
        rightColor: sh.rightColor,
        hasOutline: hasOutline,
        outlineColor: outlineColor
      };
      pushState(shapes.concat([newBox]));
      boxExtrudeStage = 'idle';
      boxBase = null;
      render();
      return;
    }

    if (currentTool === 'eyedropper' || isAltPressed) {
      for (var i = shapes.length - 1; i >= 0; i--) {
        var s = shapes[i];
        if (s.baseColor || s.color || s.fillColor) {
          currentColor = s.baseColor || s.color || s.fillColor;
          if (fillColorInput) fillColorInput.value = currentColor;
          updateShadeBoxes();
          break;
        }
      }
      return;
    }

    if (currentTool === 'eraser') {
      if (shapes.length > 0) {
        pushState(shapes.slice(0, shapes.length - 1));
      }
      return;
    }

    if (currentTool === 'brush') {
      isDragging = true;
      currentBrushStroke = [world];
      return;
    }

    if (currentTool === 'box' && viewMode === 'iso') {
      isDragging = true;
      boxExtrudeStage = 'drawing_base';
      startMouse = world;
      currentMouse = world;
      return;
    }

    isDragging = true;
    startMouse = world;
    currentMouse = world;
  }

  function handleMouseMove(e) {
    var rect = canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;

    if (isPanning) {
      pan = { x: sx - panStart.x, y: sy - panStart.y };
      render();
      return;
    }

    var rawWorld = toWorld(sx, sy);
    var effPoint = getEffectivePoint(rawWorld);
    hoverPoint = effPoint;

    if (viewMode === 'iso') {
      hoverHitFace = detectHoveredFace(rawWorld);
    }

    if (boxExtrudeStage === 'pulling_height' && boxBase) {
      var baseCenterScreen = gridToScreen(boxBase.gx + boxBase.gw / 2, boxBase.gy + boxBase.gd / 2, boxBase.gz);
      var deltaY = baseCenterScreen.y - rawWorld.y;
      var calcH = deltaY / (tileSize * (gridMode === 'true_iso_30' ? 1.0 : 0.5));
      if (snapToGrid) calcH = Math.round(calcH * 2) / 2;
      boxHeight = Math.max(0.2, calcH);
      render();
      return;
    }

    if (isDragging) {
      if (currentTool === 'brush') {
        currentBrushStroke.push(effPoint);
      } else {
        currentMouse = effPoint;
      }
    }
    render();
  }

  function handleMouseUp() {
    if (isPanning) { isPanning = false; return; }
    if (!isDragging) return;
    isDragging = false;

    var dist = Math.hypot(currentMouse.x - startMouse.x, currentMouse.y - startMouse.y);

    if (viewMode === 'iso') {
      if (currentTool === 'box' && boxExtrudeStage === 'drawing_base') {
        var gS = screenToGrid(startMouse.x, startMouse.y);
        var gC = screenToGrid(currentMouse.x, currentMouse.y);
        var st = snapToGrid ? 1.0 : 0.5;
        var gx = Math.min(Math.round(gS.gx / st) * st, Math.round(gC.gx / st) * st);
        var gy = Math.min(Math.round(gS.gy / st) * st, Math.round(gC.gy / st) * st);
        var gw = Math.max(st, Math.abs(Math.round((gC.gx - gS.gx) / st) * st) || st);
        var gd = Math.max(st, Math.abs(Math.round((gC.gy - gS.gy) / st) * st) || st);

        boxBase = { gx: gx, gy: gy, gz: 0, gw: gw, gd: gd };
        boxHeight = 1.5;
        boxExtrudeStage = 'pulling_height';
        render();
        return;
      }

      if (currentTool === 'plane') {
        var gS2 = screenToGrid(startMouse.x, startMouse.y);
        var gC2 = screenToGrid(currentMouse.x, currentMouse.y);
        var st2 = snapToGrid ? 1.0 : 0.5;
        var px = Math.min(Math.round(gS2.gx / st2) * st2, Math.round(gC2.gx / st2) * st2);
        var py = Math.min(Math.round(gS2.gy / st2) * st2, Math.round(gC2.gy / st2) * st2);
        var pw = Math.max(st2, Math.abs(Math.round((gC2.gx - gS2.gx) / st2) * st2) || st2);
        var pd = Math.max(st2, Math.abs(Math.round((gC2.gy - gS2.gy) / st2) * st2) || st2);

        var newPlane = {
          type: 'plane',
          planeType: currentPlane,
          gx: px, gy: py, gz: 0, gw: pw, gd: pd,
          color: currentColor,
          hasOutline: hasOutline,
          outlineColor: outlineColor
        };
        pushState(shapes.concat([newPlane]));
        return;
      }

      if (currentTool === 'brush') {
        if (currentBrushStroke.length >= 2) {
          var newStroke = {
            type: 'brush_stroke',
            points: currentBrushStroke.slice(),
            color: currentColor,
            size: 3,
            targetFace: hoverHitFace
          };
          pushState(shapes.concat([newStroke]));
        }
        currentBrushStroke = [];
        return;
      }

      if (currentTool === 'line') {
        var snapped = snapToIsometricAxis(startMouse.x, startMouse.y, currentMouse.x, currentMouse.y, gridMode);
        var endP = snapToGrid ? snapRayToGridStep(startMouse.x, startMouse.y, snapped.point.x, snapped.point.y) : snapped.point;
        if (dist > 3) {
          var newLine = {
            type: 'line',
            start: startMouse,
            end: endP,
            color: currentColor,
            width: 2
          };
          pushState(shapes.concat([newLine]));
        }
        return;
      }
    } else {
      if (currentTool === 'rect_2d') {
        var rx = Math.min(startMouse.x, currentMouse.x);
        var ry = Math.min(startMouse.y, currentMouse.y);
        var rw = Math.max(16, Math.abs(currentMouse.x - startMouse.x));
        var rh = Math.max(16, Math.abs(currentMouse.y - startMouse.y));
        var newRect = {
          type: 'rect_2d',
          x: rx, y: ry, width: rw, height: rh,
          extrudeHeight: 3.0,
          fillColor: currentColor,
          outlineColor: outlineColor
        };
        pushState(shapes.concat([newRect]));
      }
    }
  }

  function handleWheel(e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;
    var zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    var newZoom = Math.max(0.15, Math.min(4.0, zoom * zoomFactor));
    pan.x = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    pan.y = mouseY - (mouseY - pan.y) * (newZoom / zoom);
    zoom = newZoom;
    render();
  }

  function loadSampleRoom() {
    var shFloor = compute3Shades('#e5e7eb');
    var shWallL = compute3Shades('#94a3b8');
    var shWallR = compute3Shades('#64748b');
    var shDesk = compute3Shades('#317fa8');
    var shScreen = compute3Shades('#111827');
    var shChair = compute3Shades('#53c9df');

    var sampleShapes = [
      // 地板
      { type: 'box', gx: 0, gy: 0, gz: 0, gw: 7, gd: 7, gh: 0.25, baseColor: '#e5e7eb', topColor: shFloor.topColor, leftColor: shFloor.leftColor, rightColor: shFloor.rightColor, hasOutline: true, outlineColor: '#1f2937' },
      // 后左墙
      { type: 'box', gx: 0, gy: 0, gz: 0.25, gw: 0.3, gd: 7, gh: 3.2, baseColor: '#94a3b8', topColor: shWallL.topColor, leftColor: shWallL.leftColor, rightColor: shWallL.rightColor, hasOutline: true, outlineColor: '#1f2937' },
      // 后右墙
      { type: 'box', gx: 0.3, gy: 0, gz: 0.25, gw: 6.7, gd: 0.3, gh: 3.2, baseColor: '#64748b', topColor: shWallR.topColor, leftColor: shWallR.leftColor, rightColor: shWallR.rightColor, hasOutline: true, outlineColor: '#1f2937' },
      // 书桌
      { type: 'box', gx: 1.0, gy: 1.0, gz: 0.25, gw: 3.0, gd: 1.6, gh: 1.2, baseColor: '#317fa8', topColor: shDesk.topColor, leftColor: shDesk.leftColor, rightColor: shDesk.rightColor, hasOutline: true, outlineColor: '#1f2937' },
      // 显示器
      { type: 'box', gx: 1.6, gy: 1.2, gz: 1.45, gw: 1.4, gd: 0.2, gh: 0.9, baseColor: '#111827', topColor: shScreen.topColor, leftColor: shScreen.leftColor, rightColor: shScreen.rightColor, hasOutline: true, outlineColor: '#1f2937' },
      // 椅子
      { type: 'box', gx: 2.0, gy: 3.2, gz: 0.25, gw: 1.2, gd: 1.2, gh: 0.8, baseColor: '#53c9df', topColor: shChair.topColor, leftColor: shChair.leftColor, rightColor: shChair.rightColor, hasOutline: true, outlineColor: '#1f2937' }
    ];

    viewMode = 'iso';
    pushState(sampleShapes);
    pan = { x: canvas.width / 2, y: canvas.height / 2 };
    zoom = 1.0;
    render();
  }

  function extrude2DPlan() {
    var rects = shapes.filter(function (s) { return s.type === 'rect_2d'; });
    if (rects.length === 0) {
      alert('请先在 2D 平面模式下画好房间或色块矩形 (R)！');
      return;
    }

    var newIso = [];
    rects.forEach(function (r) {
      var gx = Math.round(r.x / 32);
      var gy = Math.round(r.y / 32);
      var gw = Math.max(1, Math.round(r.width / 32));
      var gd = Math.max(1, Math.round(r.height / 32));
      var gh = 2.5;
      var sh = compute3Shades(r.fillColor || currentColor);

      // 切片房间：地板 + 左立墙 + 右立墙
      newIso.push({
        type: 'box',
        gx: gx, gy: gy, gz: 0, gw: gw, gd: gd, gh: 0.2,
        baseColor: r.fillColor, topColor: sh.topColor, leftColor: sh.leftColor, rightColor: sh.rightColor,
        hasOutline: true, outlineColor: outlineColor
      });
      newIso.push({
        type: 'box',
        gx: gx, gy: gy, gz: 0.2, gw: 0.3, gd: gd, gh: gh,
        baseColor: sh.leftColor, topColor: sh.topColor, leftColor: sh.leftColor, rightColor: sh.rightColor,
        hasOutline: true, outlineColor: outlineColor
      });
      newIso.push({
        type: 'box',
        gx: gx + 0.3, gy: gy, gz: 0.2, gw: gw - 0.3, gd: 0.3, gh: gh,
        baseColor: sh.rightColor, topColor: sh.topColor, leftColor: sh.leftColor, rightColor: sh.rightColor,
        hasOutline: true, outlineColor: outlineColor
      });
    });

    viewMode = 'iso';
    if (viewModeBtns) {
      viewModeBtns.forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.view === 'iso');
      });
    }
    pushState(shapes.filter(function (s) { return s.type !== 'rect_2d'; }).concat(newIso));
  }

  function exportImage(format) {
    if (shapes.length === 0) return;
    var offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width * 2;
    offCanvas.height = canvas.height * 2;
    var offCtx = offCanvas.getContext('2d');
    offCtx.scale(2, 2);
    offCtx.translate(pan.x, pan.y);
    offCtx.scale(zoom, zoom);

    var sorted = shapes.slice().sort(function (a, b) {
      var dA = (a.type === 'box' || a.type === 'plane') ? (a.gx + a.gy) + (a.gz || 0) * 0.5 : 0;
      var dB = (b.type === 'box' || b.type === 'plane') ? (b.gx + b.gy) + (b.gz || 0) * 0.5 : 0;
      return dA - dB;
    });

    sorted.forEach(function (s) {
      var isLineArt = format === 'lineart';
      if (s.type === 'box') {
        var v = getBoxVertices(s);
        offCtx.lineWidth = isLineArt ? 2 : 1.2;
        offCtx.strokeStyle = isLineArt ? '#000000' : (s.outlineColor || '#1f2937');
        // Left
        offCtx.beginPath();
        offCtx.moveTo(v[3].x, v[3].y); offCtx.lineTo(v[2].x, v[2].y); offCtx.lineTo(v[6].x, v[6].y); offCtx.lineTo(v[7].x, v[7].y);
        offCtx.closePath();
        offCtx.fillStyle = isLineArt ? '#ffffff' : s.leftColor;
        offCtx.fill();
        offCtx.stroke();
        // Right
        offCtx.beginPath();
        offCtx.moveTo(v[2].x, v[2].y); offCtx.lineTo(v[1].x, v[1].y); offCtx.lineTo(v[5].x, v[5].y); offCtx.lineTo(v[6].x, v[6].y);
        offCtx.closePath();
        offCtx.fillStyle = isLineArt ? '#ffffff' : s.rightColor;
        offCtx.fill();
        offCtx.stroke();
        // Top
        offCtx.beginPath();
        offCtx.moveTo(v[4].x, v[4].y); offCtx.lineTo(v[5].x, v[5].y); offCtx.lineTo(v[6].x, v[6].y); offCtx.lineTo(v[7].x, v[7].y);
        offCtx.closePath();
        offCtx.fillStyle = isLineArt ? '#ffffff' : s.topColor;
        offCtx.fill();
        offCtx.stroke();
      }
    });

    var link = document.createElement('a');
    link.download = '70015_isometric_' + (format === 'lineart' ? 'lineart_' : '') + Date.now() + '.png';
    link.href = offCanvas.toDataURL('image/png');
    link.click();
  }

  // ==================== 初始化 ====================

  function init() {
    canvas = document.getElementById('isoCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    container = document.getElementById('canvasContainer');
    statusText = document.getElementById('statusText');

    function resize() {
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        if (pan.x === 0 && pan.y === 0) {
          pan = { x: canvas.width / 2, y: canvas.height / 2 };
        }
        render();
      }
    }
    window.addEventListener('resize', resize);
    resize();

    // 绑定画布事件
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // 工具按钮
    toolBtns = document.querySelectorAll('[data-tool]');
    toolBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentTool = btn.dataset.tool;
        toolBtns.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        render();
      });
    });

    // 视图切换按钮
    viewModeBtns = document.querySelectorAll('[data-view]');
    viewModeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        viewMode = btn.dataset.view;
        viewModeBtns.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        if (viewMode === 'plan') {
          currentTool = 'rect_2d';
        } else {
          currentTool = 'box';
        }
        toolBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.tool === currentTool); });
        render();
      });
    });

    // 面切换按钮 (Top / Left / Right)
    planeBtns = document.querySelectorAll('[data-plane]');
    planeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentPlane = btn.dataset.plane;
        planeBtns.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        render();
      });
    });

    // 拾色器
    fillColorInput = document.getElementById('fillColor');
    if (fillColorInput) {
      fillColorInput.addEventListener('input', function (e) {
        currentColor = e.target.value;
        updateShadeBoxes();
        render();
      });
    }

    strokeColorInput = document.getElementById('strokeColor');
    if (strokeColorInput) {
      strokeColorInput.addEventListener('input', function (e) {
        outlineColor = e.target.value;
        render();
      });
    }

    hasOutlineInput = document.getElementById('hasOutline');
    if (hasOutlineInput) {
      hasOutlineInput.addEventListener('change', function (e) {
        hasOutline = e.target.checked;
        render();
      });
    }

    shadeTopBox = document.getElementById('shadeTop');
    shadeLeftBox = document.getElementById('shadeLeft');
    shadeRightBox = document.getElementById('shadeRight');
    if (shadeTopBox) {
      shadeTopBox.addEventListener('click', function () {
        currentColor = compute3Shades(currentColor).topColor;
        if (fillColorInput) fillColorInput.value = currentColor;
        updateShadeBoxes();
      });
    }
    if (shadeLeftBox) {
      shadeLeftBox.addEventListener('click', function () {
        currentColor = compute3Shades(currentColor).leftColor;
        if (fillColorInput) fillColorInput.value = currentColor;
        updateShadeBoxes();
      });
    }
    if (shadeRightBox) {
      shadeRightBox.addEventListener('click', function () {
        currentColor = compute3Shades(currentColor).rightColor;
        if (fillColorInput) fillColorInput.value = currentColor;
        updateShadeBoxes();
      });
    }

    // 动作按钮
    undoBtn = document.getElementById('undoBtn');
    redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);

    gridBtn = document.getElementById('gridBtn');
    if (gridBtn) {
      gridBtn.addEventListener('click', function () {
        showGrid = !showGrid;
        gridBtn.classList.toggle('is-active', showGrid);
        render();
      });
    }

    snapBtn = document.getElementById('snapBtn');
    if (snapBtn) {
      snapBtn.addEventListener('click', function () {
        snapToGrid = !snapToGrid;
        snapBtn.classList.toggle('is-active', snapToGrid);
        render();
      });
    }

    extrudeBtn = document.getElementById('extrudeBtn');
    if (extrudeBtn) extrudeBtn.addEventListener('click', extrude2DPlan);

    sampleBtn = document.getElementById('sampleBtn');
    if (sampleBtn) sampleBtn.addEventListener('click', loadSampleRoom);

    exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', function () { exportImage('png'); });

    var lineartBtn = document.getElementById('lineartBtn');
    if (lineartBtn) lineartBtn.addEventListener('click', function () { exportImage('lineart'); });

    clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (confirm('确认清空画布吗？')) {
          pushState([]);
        }
      });
    }

    // 快捷键
    window.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') isSpacePressed = true;
      if (e.key === 'Alt') isAltPressed = true;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        currentPlane = currentPlane === 'top' ? 'left' : currentPlane === 'left' ? 'right' : 'top';
        if (planeBtns) {
          planeBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.plane === currentPlane); });
        }
        render();
      }
    });

    window.addEventListener('keyup', function (e) {
      if (e.code === 'Space') isSpacePressed = false;
      if (e.key === 'Alt') isAltPressed = false;
    });

    updateShadeBoxes();
    updateUndoRedoBtns();
    loadSampleRoom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
