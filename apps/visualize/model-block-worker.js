import { expose, transfer } from "comlink";
import { decodeGRIB2, iterateGRIB2Messages } from "/packages/grib2-decoder/dist/grib2-decoder.js";
import {
  computeAccumulationDiff,
  effectiveForecastTime,
  productMatchesVariable,
  shouldComputeAccumulationDiff,
  toFloat32Values,
} from "./src/domain/forecast-field.js";
import { generateIsobars, supportsIsobars } from "./src/domain/isobars.js";
import { deriveVectorSpeedValues } from "./src/domain/vector-field.js";
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
  const isAccumulation = shouldComputeAccumulationDiff(current.product);
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

function decodeSecondaryDisplayValues(data) {
  if (!data.secondaryVariable) return null;
  return decodeDisplayValues({
    ...data,
    variable: data.secondaryVariable,
    previousBlockKey: null,
    previousBlock: null,
    previousHour: null,
  });
}

function storeBlock({ blockKey, buffer }) {
  blockBuffers.set(blockKey, buffer);
  return { type: "storeBlockResult", ok: true };
}

async function renderHour(data) {
  const decoded = await decodeDisplayValues(data);
  if (!decoded) return null;
  const secondaryDecoded = await decodeSecondaryDisplayValues(data);
  if (data.secondaryVariable && !secondaryDecoded) return null;
  const isVectorComposite = Boolean(data.vectorComposite);

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
  const displayValues =
    isVectorComposite && secondaryDecoded
      ? deriveVectorSpeedValues({
          uValues: decoded.values,
          vValues: secondaryDecoded.values,
          missingValue,
        })
      : decoded.values;
  const { grid, product, header, isFallback } = decoded;
  const outW = grid.ni;
  const outH = mercatorCanvasHeight(grid);
  const { northLat, southLat, isStoN, northY, spanY } = renderProjectionForGrid(grid);
  const { image, dataMin, dataMax, dataMean, dataCount } = renderFieldToImageData({
    values: displayValues,
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
    type: "renderHourResult",
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
    vectorComposite: data.vectorComposite ?? null,
    vectorUValues: isVectorComposite ? decoded.values : null,
    vectorVValues: isVectorComposite ? (secondaryDecoded?.values ?? null) : null,
    isobars: supportsIsobars(product.shortName)
      ? generateIsobars({
          shortName: product.shortName,
          grid,
          values: displayValues,
          missingValue,
        })
      : null,
  };
  const transferables = [bitmap];
  if (includeValues) {
    result.values = displayValues;
    transferables.push(displayValues.buffer);
  }
  if (isVectorComposite) {
    transferables.push(decoded.values.buffer);
  }
  if (secondaryDecoded?.values) {
    transferables.push(secondaryDecoded.values.buffer);
  }
  return transfer(result, transferables);
}

async function decodeValues(data) {
  const decoded = await decodeDisplayValues(data);
  if (!decoded) {
    return { type: "decodeValuesResult", renderGeneration: data.renderGeneration };
  }
  const secondaryDecoded = await decodeSecondaryDisplayValues(data);
  if (data.secondaryVariable && !secondaryDecoded) {
    return { type: "decodeValuesResult", renderGeneration: data.renderGeneration };
  }
  const isVectorComposite = Boolean(data.vectorComposite);
  const values =
    isVectorComposite && secondaryDecoded
      ? deriveVectorSpeedValues({
          uValues: decoded.values,
          vValues: secondaryDecoded.values,
          missingValue: data.missingValue,
        })
      : decoded.values;
  const result = {
    type: "decodeValuesResult",
    renderGeneration: data.renderGeneration,
    ...decoded,
    values,
    vectorComposite: data.vectorComposite ?? null,
    vectorUValues: isVectorComposite ? decoded.values : null,
    vectorVValues: isVectorComposite ? (secondaryDecoded?.values ?? null) : null,
  };
  const transferables = [values.buffer];
  if (isVectorComposite) {
    transferables.push(decoded.values.buffer);
  }
  if (secondaryDecoded?.values) {
    transferables.push(secondaryDecoded.values.buffer);
  }
  return transfer(result, transferables);
}

expose({
  decodeValues,
  renderHour,
  storeBlock,
});
