import { isVectorCompositeVariable } from "../../domain/wind-composite-variable.js";
import { buildWindSymbolFeatures } from "../../domain/wind-symbol-sampler.js";

const DEFAULT_WIND_SYMBOL_SAMPLING = Object.freeze({
  referenceZoom: 6,
  matrixStride: 16,
});

interface ForecastEntry {
  grid: unknown;
  vectorUValues?: Float32Array | null;
  vectorVValues?: Float32Array | null;
}

interface ForecastModelState {
  showWindDirection?: boolean;
  variable?: string | null;
}

interface ViewportBounds {
  east: number;
  north: number;
  south: number;
  west: number;
}

interface WindSymbolRenderer {
  clearWindSymbols?: () => void;
  updateWindSymbols?: (geojson: unknown) => void;
}

interface WindSymbolSampling {
  matrixStride: number;
  referenceZoom: number;
}

interface CreateForecastWindSymbolOverlayUseCaseOptions {
  buildFeatures?: typeof buildWindSymbolFeatures;
  getBounds: () => ViewportBounds | null;
  getModelState: () => ForecastModelState | null | undefined;
  getZoom: () => number;
  missingValue: number;
  renderer: WindSymbolRenderer;
  sampling?: WindSymbolSampling;
}

export function createForecastWindSymbolOverlayUseCase({
  buildFeatures = buildWindSymbolFeatures,
  getBounds,
  getModelState,
  getZoom,
  missingValue,
  renderer,
  sampling = DEFAULT_WIND_SYMBOL_SAMPLING,
}: CreateForecastWindSymbolOverlayUseCaseOptions) {
  function clear() {
    renderer.clearWindSymbols?.();
  }

  function update(entry: ForecastEntry, values: Float32Array | null | undefined) {
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
