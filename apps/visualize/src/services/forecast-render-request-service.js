import { createRenderScaleParams } from "../domain/forecast-field.js";
import { blockForHour } from "../domain/forecast-state.js";
import { findPackageVariable } from "../domain/model-packages.js";
import { buildLUT, LOG_SCALE_FLOOR } from "../domain/palettes.js";
import { displayUnitsFor, unitTransformFor } from "../domain/unit-transforms.js";
import { staticScaleFor } from "../domain/variable-metadata.js";

export function createForecastRenderRequest({
  state,
  hourIndex,
  hour,
  renderGen,
  paletteName,
  missingValue,
  includeValues = false,
}) {
  const block = blockForHour(state.resources, hour);
  if (!block || !state.availableBlocks.has(block.key)) return null;

  const varDef = findPackageVariable(state.packageKey, state.variable);
  const shortName = varDef?.shortName ?? state.variable;
  const staticScale = staticScaleFor(shortName);
  const { renderMin, renderMax, range, isLog, logDenom, zeroThreshold } = createRenderScaleParams(
    staticScale,
    LOG_SCALE_FLOOR,
  );
  const previousHour = hourIndex > 0 ? state.hourList[hourIndex - 1] : null;
  const previousBlock = previousHour != null ? blockForHour(state.resources, previousHour) : null;

  return {
    type: "renderHour",
    gen: renderGen,
    blockKey: block.key,
    block,
    hour,
    previousBlockKey: previousBlock?.key ?? null,
    previousBlock,
    previousHour,
    variable: {
      shortName,
      levelValue: varDef?.levelValue ?? null,
    },
    unitTransform: unitTransformFor(shortName),
    staticScale,
    renderMin,
    range,
    isLog,
    logFloor: LOG_SCALE_FLOOR,
    logDenom,
    zeroThreshold,
    displayUnits: displayUnitsFor(shortName, varDef?.units),
    lut: buildLUT(paletteName, { min: renderMin, max: renderMax }),
    missingValue,
    includeValues,
  };
}
