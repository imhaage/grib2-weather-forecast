import { generateIsobars, supportsIsobars } from "../../domain/isobars.js";

interface ForecastEntry {
  grid?: unknown;
  isobars?: FeatureCollectionLike | null;
  product: {
    shortName: string;
  };
}

interface FeatureCollectionLike {
  [key: string]: unknown;
}

interface IsobarRenderer {
  clearIsobars: () => void;
  updateIsobars: (geojson: FeatureCollectionLike | null | undefined) => void;
}

interface CreateForecastIsobarOverlayUseCaseOptions {
  generateIsobars?: typeof generateIsobars;
  missingValue: number;
  renderer: IsobarRenderer;
  supportsIsobars?: typeof supportsIsobars;
}

export function createForecastIsobarOverlayUseCase({
  generateIsobars: buildIsobars = generateIsobars,
  missingValue,
  renderer,
  supportsIsobars: canShowIsobars = supportsIsobars,
}: CreateForecastIsobarOverlayUseCaseOptions) {
  function update(entry: ForecastEntry, values: Float32Array | null | undefined) {
    if (!canShowIsobars(entry.product.shortName)) {
      renderer.clearIsobars();
      return;
    }
    if (entry.isobars) {
      renderer.updateIsobars(entry.isobars);
      return;
    }
    if (!values) {
      renderer.clearIsobars();
      return;
    }
    entry.isobars = buildIsobars({
      shortName: entry.product.shortName,
      grid: entry.grid,
      values,
      missingValue,
    });
    renderer.updateIsobars(entry.isobars);
  }

  return {
    update,
  };
}
