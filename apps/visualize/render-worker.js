// apps/visualize/render-worker.js
// Pixel loop for heatmap rendering — runs in a Web Worker.
// Receives raw decoded values + unit transform + LUT + grid params.
// Returns an ImageBitmap plus field statistics (min/max/mean/count).
import { applyUnitTransform } from "./unit-transforms.js";

self.onmessage = async ({ data }) => {
  const {
    callId, gen,
    values, unitTransform, lut,
    missingValue,
    min, range,
    isLog, logFloor, logDenom,
    zeroThreshold,
    outW, outH,
    ni, nj, dj, isStoN,
    northLat, southLat, myNorth, mySpan,
  } = data;

  try {
    let dataMin = Infinity, dataMax = -Infinity, dataSum = 0, dataCount = 0;

    const img = new ImageData(outW, outH);
    const px = img.data;

    for (let py = 0; py < outH; py++) {
      const myY = myNorth - (py / outH) * mySpan;
      const lat = (2 * Math.atan(Math.exp(myY)) - Math.PI / 2) * 180 / Math.PI;
      if (lat > northLat || lat < southLat) continue;

      const rowFromNorth = Math.min(Math.max(Math.round((northLat - lat) / dj), 0), nj - 1);
      const row = isStoN ? nj - 1 - rowFromNorth : rowFromNorth;
      const rowOff = row * ni;
      const imgRow = py * outW;

      // Invariant: outW === ni (main thread passes outW: grid.ni)
      for (let col = 0; col < outW; col++) {
        const raw = values[rowOff + col];
        if (raw <= missingValue) continue;
        const v = applyUnitTransform(unitTransform, raw);
        if (zeroThreshold > 0 && v <= zeroThreshold) continue;

        if (v < dataMin) dataMin = v;
        if (v > dataMax) dataMax = v;
        dataSum += v;
        dataCount++;

        let t;
        if (isLog) {
          t = Math.max(0, Math.min(1, Math.log(Math.max(v, logFloor) / logFloor) / logDenom));
        } else {
          t = Math.max(0, Math.min(1, (v - min) / range));
        }
        const li = Math.min(Math.round(t * 255), 255) * 3;
        const off = (imgRow + col) * 4;
        px[off]     = lut[li];
        px[off + 1] = lut[li + 1];
        px[off + 2] = lut[li + 2];
        px[off + 3] = 255;
      }
    }

    const dataMean = dataCount ? dataSum / dataCount : NaN;
    const bitmap = await createImageBitmap(img);
    self.postMessage({ callId, gen, bitmap, dataMin, dataMax, dataMean, dataCount }, [bitmap]);
  } catch (e) {
    self.postMessage({ callId, gen, error: e.message });
  }
};
