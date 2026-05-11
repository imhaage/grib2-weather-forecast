// apps/visualize/render-worker.js
// Pixel loop for heatmap rendering — runs in a Web Worker.
// Receives decoded values + LUT + grid params, returns an ImageBitmap.
self.onmessage = async ({ data }) => {
  const {
    callId, gen,
    values, lut,
    missingValue,
    min, range,
    isLog, logFloor, logDenom,
    zeroThreshold,
    outW, outH,
    ni, nj, dj, isStoN,
    northLat, southLat, myNorth, mySpan,
  } = data;

  try {
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
        const v = values[rowOff + col];
        if (v <= missingValue || (zeroThreshold > 0 && v <= zeroThreshold)) continue;

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

    const bitmap = await createImageBitmap(img);
    self.postMessage({ callId, gen, bitmap }, [bitmap]);
  } catch (e) {
    self.postMessage({ callId, gen, error: e.message });
  }
};
