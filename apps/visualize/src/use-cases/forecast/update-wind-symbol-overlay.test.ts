import { describe, expect, test, vi } from "vitest";
import { makeForecastRunState } from "./forecast-test-fixtures";
import { makeForecastFeatureCollection, makeGridDefinition } from "./map-test-fixtures";
import { createForecastWindSymbolOverlayUseCase } from "./update-wind-symbol-overlay";

function createEntry(overrides = {}) {
  return {
    grid: makeGridDefinition({ ni: 1, nj: 1 }),
    vectorUValues: new Float32Array([1]),
    vectorVValues: new Float32Array([2]),
    ...overrides,
  };
}

describe("forecast wind symbol overlay use case", () => {
  test("updates wind symbols for visible vector composite fields", () => {
    const renderer = { clearWindSymbols: vi.fn(), updateWindSymbols: vi.fn() };
    const features = makeForecastFeatureCollection();
    const useCase = createForecastWindSymbolOverlayUseCase({
      buildFeatures: vi.fn(() => features),
      getBounds: vi.fn(() => ({ west: 0, south: 49, east: 5, north: 53 })),
      getModelState: vi.fn(() =>
        makeForecastRunState({ variable: "wind", showWindDirection: true }),
      ),
      getZoom: vi.fn(() => 8),
      missingValue: 9999,
      renderer,
    });

    useCase.update(createEntry(), new Float32Array([3]));

    expect(renderer.updateWindSymbols).toHaveBeenCalledWith(features);
    expect(renderer.clearWindSymbols).not.toHaveBeenCalled();
  });

  test("clears wind symbols when direction display is disabled", () => {
    const renderer = { clearWindSymbols: vi.fn(), updateWindSymbols: vi.fn() };
    const useCase = createForecastWindSymbolOverlayUseCase({
      buildFeatures: vi.fn(),
      getBounds: vi.fn(() => ({ west: 0, south: 49, east: 5, north: 53 })),
      getModelState: vi.fn(() =>
        makeForecastRunState({ variable: "wind", showWindDirection: false }),
      ),
      getZoom: vi.fn(() => 8),
      missingValue: 9999,
      renderer,
    });

    useCase.update(createEntry(), new Float32Array([3]));

    expect(renderer.clearWindSymbols).toHaveBeenCalled();
    expect(renderer.updateWindSymbols).not.toHaveBeenCalled();
  });

  test("clears wind symbols when map bounds are unavailable", () => {
    const renderer = { clearWindSymbols: vi.fn(), updateWindSymbols: vi.fn() };
    const useCase = createForecastWindSymbolOverlayUseCase({
      buildFeatures: vi.fn(),
      getBounds: vi.fn(() => null),
      getModelState: vi.fn(() =>
        makeForecastRunState({ variable: "wind", showWindDirection: true }),
      ),
      getZoom: vi.fn(() => 8),
      missingValue: 9999,
      renderer,
    });

    useCase.update(createEntry(), new Float32Array([3]));

    expect(renderer.clearWindSymbols).toHaveBeenCalled();
    expect(renderer.updateWindSymbols).not.toHaveBeenCalled();
  });
});
