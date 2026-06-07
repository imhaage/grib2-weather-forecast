const ACCUMULATION_DIFF_SHORT_NAMES = new Set(["rrate", "srate", "tgrp"]);

export function effectiveForecastTime(product, block) {
  return product.pdtNumber === 8 && block.startHour === block.endHour
    ? block.endHour
    : product.forecastTime;
}

export function forecastMessageKeys(forecastTime, variable) {
  const simpleKey = `${forecastTime}_${variable.shortName}`;

  return variable.levelValue != null
    ? [`${simpleKey}_${variable.levelValue}`, simpleKey]
    : [simpleKey];
}

export function productMatchesVariable(product, variable) {
  if (product.shortName !== variable.shortName) {
    return false;
  }

  return variable.levelValue == null || product.levelValue === variable.levelValue;
}

export function computeAccumulationDiff({ currentValues, previousValues, missingValue }) {
  const diff = new Float32Array(currentValues.length);

  for (let index = 0; index < currentValues.length; index++) {
    if (currentValues[index] <= missingValue || previousValues[index] <= missingValue) {
      diff[index] = missingValue;
    } else {
      diff[index] = Math.max(0, currentValues[index] - previousValues[index]);
    }
  }

  return diff;
}

export function shouldComputeAccumulationDiff(product) {
  return product.pdtNumber === 8 && ACCUMULATION_DIFF_SHORT_NAMES.has(product.shortName);
}

export function createRenderScaleParams(staticScale, logFloor) {
  const renderMin = staticScale ? staticScale.min : 0;
  const renderMax = staticScale ? staticScale.max : 1;
  const range = renderMax - renderMin || 1;
  const isLog = staticScale?.log ?? false;

  return {
    renderMin,
    renderMax,
    range,
    isLog,
    logDenom: isLog ? Math.log(staticScale.max / logFloor) : 1,
    zeroThreshold: staticScale?.zeroThreshold ?? 0,
  };
}

export function toFloat32Values(values) {
  if (values instanceof Float32Array) {
    return values;
  }

  const out = new Float32Array(values.length);
  out.set(values);

  return out;
}

export function createRenderParams({
  data,
  values = data.values,
  staticScale,
  unitTransform,
  displayUnits,
  logFloor,
  isFallback = false,
}) {
  return {
    values: toFloat32Values(values),
    unitTransform,
    staticScale,
    ...createRenderScaleParams(staticScale, logFloor),
    displayUnits,
    isFallback,
    grid: data.grid,
    product: data.product,
    header: data.header,
  };
}
