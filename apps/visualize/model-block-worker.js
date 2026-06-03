import { expose, transfer } from "comlink";
import { decodeGRIB2, iterateGRIB2Messages } from "/packages/grib2-decoder/dist/grib2-decoder.js";
import {
  computeAccumulationDiff,
  effectiveForecastTime,
  productMatchesVariable,
  toFloat32Values,
} from "./src/domain/forecast-field.js";
import { generateIsobars, supportsIsobars } from "./src/domain/isobars.js";
import { mercatorCanvasHeight, renderProjectionForGrid } from "./src/domain/web-mercator.js";
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

async function decodeDisplayValues({
  blockKey,
  block,
  hour,
  previousBlockKey,
  previousBlock,
  previousHour,
  variable,
  missingValue,
}) {
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

  const displayValues = toFloat32Values(values);
  const displayUnits = isAccumulation && !isFallback && previousHour != null ? "mm/h" : null;

  return {
    values: displayValues,
    grid: current.grid,
    product: current.product,
    header: current.header,
    isFallback,
    displayUnits,
  };
}

function storeBlock({ blockKey, buffer }) {
  blockBuffers.set(blockKey, buffer);
  return { ok: true };
}

async function renderHour(data) {
  const decoded = await decodeDisplayValues(data);
  if (!decoded) return null;

  const {
    renderGeneration,
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
  const { northLat, southLat, isStoN, northY, spanY } = renderProjectionForGrid(grid);
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
    renderGeneration,
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
  const transferables = [bitmap];
  if (includeValues) {
    result.values = values;
    transferables.push(values.buffer);
  }
  return transfer(result, transferables);
}

async function decodeValues(data) {
  const decoded = await decodeDisplayValues(data);
  if (!decoded) return { renderGeneration: data.renderGeneration, values: null };
  return transfer({ renderGeneration: data.renderGeneration, ...decoded }, [decoded.values.buffer]);
}

expose({
  decodeValues,
  renderHour,
  storeBlock,
});
