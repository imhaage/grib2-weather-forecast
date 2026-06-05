import { isVectorCompositeVariable } from "../domain/wind-composite-variable.js";
import { buildWindSymbolFeatures } from "../domain/wind-symbol-sampler.js";

const DEFAULT_WIND_SYMBOL_SAMPLING = Object.freeze({
  referenceZoom: 6,
  matrixStride: 16,
});

export function createForecastWindSymbolOverlayService({
  buildFeatures = buildWindSymbolFeatures,
  getBounds,
  getModelState,
  getZoom,
  missingValue,
  renderer,
  sampling = DEFAULT_WIND_SYMBOL_SAMPLING,
}) {
  function clear() {
    renderer.clearWindSymbols?.();
  }

  function update(entry, values) {
    const modelState = getModelState();
    if (
      !isVectorCompositeVariable(modelState?.variable) ||
      modelState?.showWindDirection === false ||
      !values ||
      !entry.vectorUValues ||
      !entry.vectorVValues ||
      !renderer.updateWindSymbols
    ) {
      clear();
      return;
    }

    const bounds = getBounds();
    if (!bounds) {
      clear();
      return;
    }

    renderer.updateWindSymbols(
      buildFeatures({
        grid: entry.grid,
        vectorUValues: entry.vectorUValues,
        vectorVValues: entry.vectorVValues,
        missingValue,
        bounds,
        zoom: getZoom(),
        sampling,
      }),
    );
  }

  return {
    update,
  };
}
