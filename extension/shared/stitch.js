var ZimgStitch = (function () {
  'use strict';

  var MATCH_ROWS = 16;
  var SAMPLE_STEP = 4;
  var NCC_THRESH = 0.92;
  var MAX_PIXELS = 64 * 1024 * 1024;

  function toGrayStrip(data, width, startRow, rows) {
    var out = new Float32Array(width * rows);
    for (var r = 0; r < rows; r++) {
      var rowOff = (startRow + r) * width * 4;
      for (var c = 0; c < width; c++) {
        var i = rowOff + c * 4;
        out[r * width + c] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
    }
    return out;
  }

  function stats(arr) {
    var sum = 0, n = 0;
    for (var i = 0; i < arr.length; i += SAMPLE_STEP) { sum += arr[i]; n++; }
    var mean = sum / n;
    var vsum = 0;
    for (var i = 0; i < arr.length; i += SAMPLE_STEP) {
      var d = arr[i] - mean;
      vsum += d * d;
    }
    return { mean: mean, std: Math.sqrt(vsum / n) };
  }

  function findOverlapRows(prevData, newData, width, searchRows) {
    var prevH = prevData.height;
    var newH = newData.height;
    searchRows = Math.min(searchRows || 200, Math.floor(prevH * 0.4), newH - MATCH_ROWS);
    if (searchRows < MATCH_ROWS) return 0;

    var tplGray = toGrayStrip(prevData.data, width, prevH - MATCH_ROWS, MATCH_ROWS);
    var tplS = stats(tplGray);

    if (tplS.std < 1.0) {
      return findOverlapMSE(tplGray, newData, width, searchRows);
    }

    var bestNCC = -1, bestOff = -1;
    for (var off = 0; off <= searchRows - MATCH_ROWS; off++) {
      var candGray = toGrayStrip(newData.data, width, off, MATCH_ROWS);
      var candS = stats(candGray);
      if (candS.std < 0.5) continue;
      var num = 0;
      for (var i = 0; i < tplGray.length; i += SAMPLE_STEP) {
        num += (tplGray[i] - tplS.mean) * (candGray[i] - candS.mean);
      }
      var samples = Math.ceil(tplGray.length / SAMPLE_STEP);
      var ncc = num / (tplS.std * candS.std * samples);
      if (ncc > bestNCC) { bestNCC = ncc; bestOff = off; }
    }
    return (bestNCC >= NCC_THRESH && bestOff >= 0) ? bestOff + MATCH_ROWS : 0;
  }

  function findOverlapMSE(tplGray, newData, width, searchRows) {
    var bestMSE = Infinity, bestOff = -1;
    for (var off = 0; off <= searchRows - MATCH_ROWS; off++) {
      var candGray = toGrayStrip(newData.data, width, off, MATCH_ROWS);
      var sum = 0, n = 0;
      for (var i = 0; i < tplGray.length; i += SAMPLE_STEP) {
        var d = tplGray[i] - candGray[i];
        sum += d * d;
        n++;
      }
      var mse = sum / n;
      if (mse < bestMSE) { bestMSE = mse; bestOff = off; }
    }
    return (bestMSE < 5.0 && bestOff >= 0) ? bestOff + MATCH_ROWS : 0;
  }

  function stitchImages(images, opts) {
    opts = opts || {};
    var cropX = opts.cropX || 0;
    var cropW = opts.cropW || 0;
    var searchRows = opts.searchRows || 200;

    if (!images.length) return null;

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var totalOverlap = 0;

    var firstW = cropW || images[0].naturalWidth || images[0].width;
    var firstH = images[0].naturalHeight || images[0].height;

    canvas.width = firstW;
    canvas.height = firstH;
    ctx.drawImage(images[0], cropX, 0, firstW, firstH, 0, 0, firstW, firstH);

    var prevData = ctx.getImageData(0, 0, firstW, firstH);

    for (var idx = 1; idx < images.length; idx++) {
      var img = images[idx];
      var imgW = cropW || img.naturalWidth || img.width;
      var imgH = img.naturalHeight || img.height;

      var tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = imgW;
      tmpCanvas.height = imgH;
      var tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.drawImage(img, cropX, 0, imgW, imgH, 0, 0, imgW, imgH);
      var newData = tmpCtx.getImageData(0, 0, imgW, imgH);

      var overlap = findOverlapRows(prevData, newData, imgW, searchRows);
      totalOverlap += overlap;
      var appendH = imgH - overlap;
      if (appendH <= 0) continue;

      var oldH = canvas.height;
      var newH = oldH + appendH;
      if (firstW * newH > MAX_PIXELS) break;

      var buf = document.createElement('canvas');
      buf.width = firstW;
      buf.height = newH;
      var bctx = buf.getContext('2d');
      bctx.drawImage(canvas, 0, 0);
      bctx.drawImage(tmpCanvas, 0, overlap, imgW, appendH, 0, oldH, imgW, appendH);

      canvas.width = firstW;
      canvas.height = newH;
      ctx.drawImage(buf, 0, 0);

      prevData = ctx.getImageData(0, Math.max(0, newH - 200), firstW, Math.min(200, newH));
      prevData = { data: prevData.data, width: firstW, height: prevData.height };
    }

    return { canvas: canvas, segments: images.length, overlapRemoved: totalOverlap };
  }

  return { findOverlapRows: findOverlapRows, stitchImages: stitchImages };
})();
