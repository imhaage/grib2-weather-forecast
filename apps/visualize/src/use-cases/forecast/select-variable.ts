import { findPackageVariable } from "../../domain/model-packages.js";
import { parameterDescriptionFor, variableKeyFor } from "../../domain/variable-metadata.js";
import { isVectorCompositeVariable } from "../../domain/wind-composite-variable.js";
import type {
  ForecastVariableDefinition,
  ForecastVariableSelectionPorts,
  ForecastVariableSelectionState,
} from "./ports";

export function createForecastVariableSelectionUseCase({
  applyDefaultPalette,
  findPackageVariable: findVariable = findPackageVariable,
  formatModelPackageSubtitle,
  parameterDescriptionFor: describeParameter = parameterDescriptionFor,
  updateLevelInfo,
  updateParamInfo,
}: ForecastVariableSelectionPorts) {
  function selectInitialVariable(
    modelState: ForecastVariableSelectionState,
    variableDefinition: ForecastVariableDefinition,
  ): string {
    const variableKey = variableKeyFor(variableDefinition);
    modelState.variable = variableKey;
    modelState.showWindDirection = true;
    applyDefaultPalette(variableKey);
    updateLevelInfo(variableDefinition);

    return variableKey;
  }

  function selectVariable(
    modelState: ForecastVariableSelectionState,
    variableKey: string,
  ): ForecastVariableDefinition | undefined {
    modelState.variable = variableKey;
    const variableDefinition = findVariable(modelState.packageKey, variableKey);
    const shortName = variableDefinition?.shortName ?? variableKey;
    applyDefaultPalette(variableKey);

    if (variableDefinition) {
      updateParamInfo(
        variableDefinition.name,
        describeParameter(shortName),
        formatModelPackageSubtitle(modelState.packageKey),
      );
      updateLevelInfo(variableDefinition);
    }

    return variableDefinition;
  }

  function windDirectionControlState(
    modelState: ForecastVariableSelectionState | null | undefined,
  ) {
    return {
      hidden: !isVectorCompositeVariable(modelState?.variable),
      checked: modelState?.showWindDirection !== false,
    };
  }

  return {
    selectInitialVariable,
    selectVariable,
    windDirectionControlState,
  };
}
