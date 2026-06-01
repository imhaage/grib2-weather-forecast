import {
  iterateGRIB2Messages,
  decodeGRIB2,
} from "/packages/grib2-decoder/dist/grib2-decoder.js";
import {
  computeAccumulationDiff,
  effectiveForecastTime,
  productMatchesVariable,
} from "./src/domain/forecast-field.js";
import {
  mercatorCanvasHeight,
  webMercatorY,
} from "./src/domain/web-mercator.js";
import { generateIsobars, supportsIsobars } from "./src/domain/isobars.js";
import { renderFieldToImageData } from "./src/workers/render-field-core.js";

const blockBuffers = new Map();

function findMessage(blockKey, block, hour, variable) {
  const buffer = blockBuffers.get(blockKey);
  if (!buffer) return null;

  for (const message of iterateGRIB2Messages(buffer)) {
    const { product } = message;
    if (!productMatchesVariable(product, variable)) continue;
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
      values = computeAccumulationDiff({
        currentValues: current.values,
        previousValues: previous.values,
        missingValue,
      });
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
  const northY = webMercatorY(northLat);
  const spanY = northY - webMercatorY(southLat);
  const { image, dataMin, dataMax, dataMean, dataCount } = renderFieldToImageData({
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
    ni: grid.ni,
    nj: grid.nj,
    dj: grid.dj,
    isStoN,
    northLat,
    southLat,
    northY,
    spanY,
  });

  const bitmap = await createImageBitmap(image);
  const result = {
    callId,
    gen,
    bitmap,
    dataMin,
    dataMax,
    dataMean,
    dataCount,
    grid,
    product,
    header,
    unitTransform,
    renderMin,
    range,
    staticScale,
    isLog,
    displayUnits: decoded.displayUnits ?? displayUnits,
    isFallback,
    isobars: supportsIsobars(product.shortName)
      ? generateIsobars({
        shortName: product.shortName,
        grid,
        values,
        missingValue,
      })
      : null,
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
