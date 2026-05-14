import {
  iterateGRIB2Messages,
  decodeGRIB2,
} from "/packages/grib2-decoder/dist/grib2-decoder.js";
import { applyUnitTransform } from "./unit-transforms.js";

const blockBuffers = new Map();

function mercatorY(lat) {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
}

function mercatorCanvasHeight(grid) {
  const spanY = Math.abs(
    mercatorY(grid.latitudeOfFirstPoint) - mercatorY(grid.latitudeOfLastPoint),
  );
  const spanX = Math.abs(
    ((grid.longitudeOfLastPoint - grid.longitudeOfFirstPoint) * Math.PI) / 180,
  );
  return Math.round((grid.ni * spanY) / spanX);
}

function effectiveForecastTime(product, block) {
  return product.pdtNumber === 8 && block.startHour === block.endHour
    ? block.endHour
    : product.forecastTime;
}

function findMessage(blockKey, block, hour, variable) {
  const buffer = blockBuffers.get(blockKey);
  if (!buffer) return null;

  for (const message of iterateGRIB2Messages(buffer)) {
    const { product } = message;
    if (product.shortName !== variable.shortName) continue;
    if (variable.levelValue != null && product.levelValue !== variable.levelValue) continue;
    if (effectiveForecastTime(product, block) !== hour) continue;
    return message;
  }

  return null;
}

function toDisplayValues(values) {
  if (values instanceof Float32Array) return values;
  const out = new Float32Array(values.length);
  out.set(values);
  return out;
}

async function decodeDisplayValues({ blockKey, block, hour, previousBlockKey, previousBlock, previousHour, variable, missingValue }) {
  const currentMessage = findMessage(blockKey, block, hour, variable);
  if (!currentMessage) return null;

  const current = await decodeGRIB2(currentMessage.buffer);
  const isAccumulation = current.product.pdtNumber === 8;
  let values = current.values;
  let isFallback = false;

  if (isAccumulation && previousBlockKey && previousBlock && previousHour != null) {
    const previousMessage = findMessage(previousBlockKey, previousBlock, previousHour, variable);
    if (previousMessage) {
      const previous = await decodeGRIB2(previousMessage.buffer);
      const diff = new Float32Array(current.values.length);
      for (let i = 0; i < current.values.length; i++) {
        if (current.values[i] <= missingValue || previous.values[i] <= missingValue) {
          diff[i] = missingValue;
        } else {
          diff[i] = Math.max(0, current.values[i] - previous.values[i]);
        }
      }
      values = diff;
    } else {
      isFallback = true;
    }
  }

  const displayValues = toDisplayValues(values);
  const displayUnits = isAccumulation && !isFallback && previousHour != null
    ? "mm/h"
    : null;

  return {
    values: displayValues,
    grid: current.grid,
    product: current.product,
    header: current.header,
    isFallback,
    displayUnits,
  };
}

async function renderHour(data) {
  const decoded = await decodeDisplayValues(data);
  if (!decoded) return null;

  const {
    callId,
    gen,
    includeValues,
    lut,
    missingValue,
    renderMin,
    range,
    isLog,
    logFloor,
    logDenom,
    zeroThreshold,
    unitTransform,
    staticScale,
    displayUnits,
  } = data;
  const { values, grid, product, header, isFallback } = decoded;
  const outW = grid.ni;
  const outH = mercatorCanvasHeight(grid);
  const northLat = Math.max(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const southLat = Math.min(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const isStoN = grid.latitudeOfLastPoint > grid.latitudeOfFirstPoint;
  const myNorth = mercatorY(northLat);
  const mySpan = myNorth - mercatorY(southLat);
  const image = new ImageData(outW, outH);
  const pixels = image.data;
  let dataMin = Infinity;
  let dataMax = -Infinity;
  let dataSum = 0;
  let dataCount = 0;

  for (let py = 0; py < outH; py++) {
    const myY = myNorth - (py / outH) * mySpan;
    const lat = (2 * Math.atan(Math.exp(myY)) - Math.PI / 2) * 180 / Math.PI;
    if (lat > northLat || lat < southLat) continue;

    const rowFromNorth = Math.min(Math.max(Math.round((northLat - lat) / grid.dj), 0), grid.nj - 1);
    const row = isStoN ? grid.nj - 1 - rowFromNorth : rowFromNorth;
    const rowOff = row * grid.ni;
    const imgRow = py * outW;

    for (let col = 0; col < outW; col++) {
      const raw = values[rowOff + col];
      if (raw <= missingValue) continue;
      const value = applyUnitTransform(unitTransform, raw);
      if (zeroThreshold > 0 && value <= zeroThreshold) continue;

      if (value < dataMin) dataMin = value;
      if (value > dataMax) dataMax = value;
      dataSum += value;
      dataCount++;

      const t = isLog
        ? Math.max(0, Math.min(1, Math.log(Math.max(value, logFloor) / logFloor) / logDenom))
        : Math.max(0, Math.min(1, (value - renderMin) / range));
      const lutIndex = Math.min(Math.round(t * 255), 255) * 3;
      const offset = (imgRow + col) * 4;
      pixels[offset] = lut[lutIndex];
      pixels[offset + 1] = lut[lutIndex + 1];
      pixels[offset + 2] = lut[lutIndex + 2];
      pixels[offset + 3] = 255;
    }
  }

  const bitmap = await createImageBitmap(image);
  const result = {
    callId,
    gen,
    bitmap,
    dataMin,
    dataMax,
    dataMean: dataCount ? dataSum / dataCount : NaN,
    dataCount,
    grid,
    product,
    header,
    unitTransform,
    renderMin,
    range,
    staticScale,
    displayUnits: decoded.displayUnits ?? displayUnits,
    isFallback,
  };
  const transfer = [bitmap];
  if (includeValues) {
    result.values = values;
    transfer.push(values.buffer);
  }
  self.postMessage(result, transfer);
}

self.onmessage = async ({ data }) => {
  const { type, callId, gen } = data;

  try {
    switch (type) {
      case "storeBlock": {
        const { blockKey, buffer } = data;
        blockBuffers.set(blockKey, buffer);
        self.postMessage({ callId, ok: true });
        break;
      }
      case "renderHour":
        await renderHour(data);
        break;
      case "decodeValues": {
        const decoded = await decodeDisplayValues(data);
        if (!decoded) {
          self.postMessage({ callId, gen, values: null });
          break;
        }
        self.postMessage(
          { callId, gen, ...decoded },
          [decoded.values.buffer],
        );
        break;
      }
      default:
        self.postMessage({ callId, gen, error: `Unknown worker message: ${type}` });
    }
  } catch (error) {
    self.postMessage({ callId, gen, error: error.message });
  }
};
