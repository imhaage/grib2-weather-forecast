import { fmtRefTime, iterateGRIB2Messages } from "grib2-decoder";
import { findPackageVariable } from "../../domain/model-packages.js";
import { displayUnitsFor } from "../../domain/unit-transforms.js";
import { parameterDescriptionFor, staticScaleFor } from "../../domain/variable-metadata.js";
import type {
  ForecastLegendInitializerPorts,
  ForecastLegendSession,
  ForecastLegendState,
} from "./ports";

interface InitializeForecastLegendContext {
  modelState: ForecastLegendState;
  session: ForecastLegendSession;
}

export function createForecastLegendInitializerUseCase({
  applyDefaultPalette,
  displayUnitsFor: displayUnits = displayUnitsFor,
  findPackageVariable: findVariable = findPackageVariable,
  formatModelPackageSubtitle,
  formatRefTime = fmtRefTime,
  iterateMessages = iterateGRIB2Messages,
  parameterDescriptionFor: describeParameter = parameterDescriptionFor,
  showColorScale,
  staticScaleFor: staticScale = staticScaleFor,
  updateLevelInfo,
  updateParamInfo,
}: ForecastLegendInitializerPorts) {
  function initializeFromBlock(
    buffer: Uint8Array,
    { modelState, session }: InitializeForecastLegendContext,
  ): boolean {
    if (session.legendInitialized || !modelState.variable) {
      return false;
    }

    session.legendInitialized = true;

    const variableDefinition = findVariable(session.packageKey, modelState.variable);
    const shortName = variableDefinition?.shortName ?? modelState.variable;

    for (const message of iterateMessages(buffer)) {
      const product = message.product;

      if (!product || product.shortName !== shortName) {
        continue;
      }

      if (
        variableDefinition?.levelValue != null &&
        product.levelValue !== variableDefinition.levelValue
      ) {
        continue;
      }

      modelState.lastRunInfo = `${session.packageKey} · run ${formatRefTime(message.header)}`;
      applyDefaultPalette(modelState.variable);
      updateParamInfo(
        product.name,
        describeParameter(shortName),
        formatModelPackageSubtitle(modelState.packageKey),
      );
      updateLevelInfo(variableDefinition);

      const scale = staticScale(shortName);

      if (scale && variableDefinition) {
        showColorScale(scale.min, scale.max, displayUnits(shortName, variableDefinition.units), {
          isLog: scale.log ?? false,
        });
      }

      return true;
    }

    return false;
  }

  return {
    initializeFromBlock,
  };
}
