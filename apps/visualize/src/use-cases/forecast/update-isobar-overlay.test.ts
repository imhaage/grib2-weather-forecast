import { describe, expect, test, vi } from "vitest";
import { createForecastIsobarOverlayUseCase } from "./update-isobar-overlay";

describe("forecast isobar overlay use case", () => {
  test("clears isobars when the field does not support them", () => {
    const renderer = { clearIsobars: vi.fn(), updateIsobars: vi.fn() };
    const useCase = createForecastIsobarOverlayUseCase({
      generateIsobars: vi.fn(),
      missingValue: 9999,
      renderer,
      supportsIsobars: vi.fn(() => false),
    });

    useCase.update({ product: { shortName: "t" } }, new Float32Array([1]));

    expect(renderer.clearIsobars).toHaveBeenCalled();
    expect(renderer.updateIsobars).not.toHaveBeenCalled();
  });

  test("reuses cached isobars when already present on the entry", () => {
    const isobars = { type: "FeatureCollection", features: [] };
    const renderer = { clearIsobars: vi.fn(), updateIsobars: vi.fn() };
    const useCase = createForecastIsobarOverlayUseCase({
      generateIsobars: vi.fn(),
      missingValue: 9999,
      renderer,
      supportsIsobars: vi.fn(() => true),
    });

    useCase.update({ isobars, product: { shortName: "msl" } }, null);

    expect(renderer.updateIsobars).toHaveBeenCalledWith(isobars);
  });

  test("generates and stores isobars for supported fields with values", () => {
    const isobars = { type: "FeatureCollection", features: [] };
    const entry: {
      grid: { id: string };
      isobars?: typeof isobars | null;
      product: { shortName: string };
    } = {
      grid: { id: "grid" },
      product: { shortName: "msl" },
    };
    const values = new Float32Array([1013]);
    const renderer = { clearIsobars: vi.fn(), updateIsobars: vi.fn() };
    const generateIsobars = vi.fn(() => isobars);
    const useCase = createForecastIsobarOverlayUseCase({
      generateIsobars,
      missingValue: 9999,
      renderer,
      supportsIsobars: vi.fn(() => true),
    });

    useCase.update(entry, values);

    expect(generateIsobars).toHaveBeenCalledWith({
      shortName: "msl",
      grid: entry.grid,
      values,
      missingValue: 9999,
    });
    expect(entry.isobars).toBe(isobars);
    expect(renderer.updateIsobars).toHaveBeenCalledWith(isobars);
  });
});
