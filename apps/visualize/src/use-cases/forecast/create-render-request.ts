import { createRenderScaleParams } from "../../domain/forecast-field.js";
import { blockForHour } from "../../domain/forecast-state.js";
import type { ForecastRunState } from "../../domain/forecast-types";
import { findPackageVariable } from "../../domain/model-packages.js";
import { buildLUT, LOG_SCALE_FLOOR } from "../../domain/palettes.js";
import { displayUnitsFor, unitTransformFor } from "../../domain/unit-transforms.js";
import { staticScaleFor } from "../../domain/variable-metadata.js";
import {
  componentVariableKeyForVector,
  isVectorCompositeVariable,
} from "../../domain/wind-composite-variable.js";
import type { ModelBlockRenderRequest } from "../../workers/model-block-worker-contracts";

interface CreateForecastRenderRequestOptions {
  state: ForecastRunState;
  hourIndex: number;
  hour: number;
  renderGeneration: number;
  paletteName: string;
  missingValue: number;
  includeValues?: boolean;
}

export function createForecastRenderRequest({
  state,
  hourIndex,
  hour,
  renderGeneration,
  paletteName,
  missingValue,
  includeValues = false,
}: CreateForecastRenderRequestOptions): ModelBlockRenderRequest | null {
  const block = blockForHour(state.resources, hour);

  if (!block || !state.availableBlocks.has(block.key)) {
    return null;
  }

  const selectedVariable = state.variable;

  if (!selectedVariable) {
    return null;
  }

  const uComponentKey = componentVariableKeyForVector(selectedVariable, "u");
  const vComponentKey = componentVariableKeyForVector(selectedVariable, "v");
  const renderVariableKey = uComponentKey ?? selectedVariable;
  const varDef = findPackageVariable(state.packageKey, renderVariableKey);
  const secondaryVarDef = vComponentKey
    ? findPackageVariable(state.packageKey, vComponentKey)
    : null;
  const shortName = varDef?.shortName ?? renderVariableKey;
  const compositeShortName = isVectorCompositeVariable(selectedVariable) ? selectedVariable : null;
  const scaleShortName = compositeShortName ?? shortName;
  const staticScale = staticScaleFor(scaleShortName);
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
    vectorComposite:
      compositeShortName && uComponentKey && vComponentKey
        ? { shortName: compositeShortName, uComponent: uComponentKey, vComponent: vComponentKey }
        : null,
    unitTransform: compositeShortName ? null : unitTransformFor(shortName),
    staticScale,
    renderMin,
    range,
    isLog,
    logFloor: LOG_SCALE_FLOOR,
    logDenom,
    zeroThreshold,
    displayUnits: compositeShortName ? "km/h" : displayUnitsFor(shortName, varDef?.units),
    lut: buildLUT(paletteName, { min: renderMin, max: renderMax }),
    missingValue,
    includeValues,
  };
}
