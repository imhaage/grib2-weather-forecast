import type { GridDefinition } from "../../domain/field-types";
import type { ForecastRunState } from "../../domain/forecast-types";
import { isVectorCompositeVariable } from "../../domain/wind-composite-variable.js";
import { buildWindSymbolFeatures } from "../../domain/wind-symbol-sampler.js";
import type {
  ForecastFeatureCollection,
  ForecastMapRendererPort,
  ViewportBounds,
} from "./map-contracts";

const DEFAULT_WIND_SYMBOL_SAMPLING = Object.freeze({
  referenceZoom: 6,
  matrixStride: 16,
});

interface ForecastEntry {
  grid: GridDefinition;
  vectorUValues?: Float32Array | null;
  vectorVValues?: Float32Array | null;
}

interface WindSymbolSampling {
  matrixStride: number;
  referenceZoom: number;
}

interface CreateForecastWindSymbolOverlayUseCaseOptions {
  buildFeatures?: typeof buildWindSymbolFeatures;
  getBounds: () => ViewportBounds | null;
  getModelState: () => ForecastRunState | null | undefined;
  getZoom: () => number;
  missingValue: number;
  renderer: Pick<ForecastMapRendererPort, "clearWindSymbols" | "updateWindSymbols">;
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
      }) as ForecastFeatureCollection,
    );
  }

  return {
    update,
  };
}
