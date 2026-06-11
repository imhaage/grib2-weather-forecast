import type { GridDefinition, ProductDefinition } from "../../domain/field-types";
import { generateIsobars, supportsIsobars } from "../../domain/isobars.js";
import type { ForecastFeatureCollection, ForecastMapRendererPort } from "./map-contracts";

interface ForecastEntry {
  grid?: GridDefinition;
  isobars?: ForecastFeatureCollection | null;
  product: ProductDefinition;
}

interface CreateForecastIsobarOverlayUseCaseOptions {
  generateIsobars?: typeof generateIsobars;
  missingValue: number;
  renderer: Pick<ForecastMapRendererPort, "clearIsobars" | "updateIsobars">;
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
    }) as ForecastFeatureCollection;
    renderer.updateIsobars(entry.isobars);
  }

  return {
    update,
  };
}
