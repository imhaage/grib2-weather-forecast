// @ts-check

import { applyUnitTransform } from "../domain/unit-transforms.js";
import { latitudeFromWebMercatorY } from "../domain/web-mercator.js";

/**
 * @param {import("./render-types.js").RenderFieldInput} input
 * @returns {import("./render-types.js").RenderFieldResult}
 */
export function renderFieldToImageData({
  values,
  unitTransform,
  lut,
  missingValue,
  renderMin,
  range,
  isLog,
  logFloor,
  logDenom,
  zeroThreshold,
  outW,
  outH,
  ni,
  nj,
  dj,
  isStoN,
  northLat,
  southLat,
  northY,
  spanY,
}) {
  const image = new ImageData(outW, outH);
  const pixels = image.data;
  let dataMin = Infinity;
  let dataMax = -Infinity;
  let dataSum = 0;
  let dataCount = 0;

  for (let py = 0; py < outH; py++) {
    const y = northY - (py / outH) * spanY;
    const lat = latitudeFromWebMercatorY(y);

    if (lat > northLat + 1e-9 || lat < southLat - 1e-9) {
      continue;
    }

    const rowFromNorth = Math.min(Math.max(Math.round((northLat - lat) / dj), 0), nj - 1);
    const row = isStoN ? nj - 1 - rowFromNorth : rowFromNorth;
    const rowOffset = row * ni;
    const imageRow = py * outW;

    for (let col = 0; col < outW; col++) {
      const raw = values[rowOffset + col];

      if (raw <= missingValue) {
        continue;
      }

      const value = applyUnitTransform(unitTransform, raw);

      if (zeroThreshold > 0 && value <= zeroThreshold) {
        continue;
      }

      if (value < dataMin) {
        dataMin = value;
      }

      if (value > dataMax) {
        dataMax = value;
      }

      dataSum += value;
      dataCount++;

      const t = isLog
        ? Math.max(0, Math.min(1, Math.log(Math.max(value, logFloor) / logFloor) / logDenom))
        : Math.max(0, Math.min(1, (value - renderMin) / range));
      const lutIndex = Math.min(Math.round(t * 255), 255) * 3;
      const offset = (imageRow + col) * 4;
      pixels[offset] = lut[lutIndex];
      pixels[offset + 1] = lut[lutIndex + 1];
      pixels[offset + 2] = lut[lutIndex + 2];
      pixels[offset + 3] = 255;
    }
  }

  return {
    image,
    dataMin,
    dataMax,
    dataMean: dataCount ? dataSum / dataCount : NaN,
    dataCount,
  };
}
