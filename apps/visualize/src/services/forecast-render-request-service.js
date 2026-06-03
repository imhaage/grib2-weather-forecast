import { createRenderScaleParams } from "../domain/forecast-field.js";
import { blockForHour } from "../domain/forecast-state.js";
import { findPackageVariable } from "../domain/model-packages.js";
import { buildLUT, LOG_SCALE_FLOOR } from "../domain/palettes.js";
import { displayUnitsFor, unitTransformFor } from "../domain/unit-transforms.js";
import { staticScaleFor } from "../domain/variable-metadata.js";
import { componentVariableKeyForWind } from "../domain/wind-composite-variable.js";

export function createForecastRenderRequest({
  state,
  hourIndex,
  hour,
  renderGeneration,
  paletteName,
  missingValue,
  includeValues = false,
}) {
  const block = blockForHour(state.resources, hour);
  if (!block || !state.availableBlocks.has(block.key)) return null;

  const selectedVariable = state.variable;
  const speedKey = componentVariableKeyForWind(selectedVariable, "speed");
  const directionKey = componentVariableKeyForWind(selectedVariable, "direction");
  const renderVariableKey = speedKey ?? selectedVariable;
  const varDef = findPackageVariable(state.packageKey, renderVariableKey);
  const secondaryVarDef = directionKey ? findPackageVariable(state.packageKey, directionKey) : null;
  const shortName = varDef?.shortName ?? renderVariableKey;
  const staticScale = staticScaleFor(shortName);
  const { renderMin, renderMax, range, isLog, logDenom, zeroThreshold } = createRenderScaleParams(
    staticScale,
    LOG_SCALE_FLOOR,
  );
  const previousHour = hourIndex > 0 ? state.hourList[hourIndex - 1] : null;
  const previousBlock = previousHour != null ? blockForHour(state.resources, previousHour) : null;

  return {
    type: "renderHour",
    renderGeneration,
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
    secondaryVariable: secondaryVarDef
      ? { shortName: secondaryVarDef.shortName, levelValue: secondaryVarDef.levelValue ?? null }
      : null,
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
