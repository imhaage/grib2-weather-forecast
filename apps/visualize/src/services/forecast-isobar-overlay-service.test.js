import { describe, expect, test, vi } from "vitest";
import { createForecastIsobarOverlayService } from "./forecast-isobar-overlay-service.js";

describe("forecast isobar overlay service", () => {
  test("clears isobars when the field does not support them", () => {
    const renderer = { clearIsobars: vi.fn(), updateIsobars: vi.fn() };
    const service = createForecastIsobarOverlayService({
      generateIsobars: vi.fn(),
      missingValue: 9999,
      renderer,
      supportsIsobars: vi.fn(() => false),
    });

    service.update({ product: { shortName: "t" } }, new Float32Array([1]));

    expect(renderer.clearIsobars).toHaveBeenCalled();
    expect(renderer.updateIsobars).not.toHaveBeenCalled();
  });

  test("reuses cached isobars when already present on the entry", () => {
    const isobars = { type: "FeatureCollection" };
    const renderer = { clearIsobars: vi.fn(), updateIsobars: vi.fn() };
    const service = createForecastIsobarOverlayService({
      generateIsobars: vi.fn(),
      missingValue: 9999,
      renderer,
      supportsIsobars: vi.fn(() => true),
    });

    service.update({ isobars, product: { shortName: "msl" } }, null);

    expect(renderer.updateIsobars).toHaveBeenCalledWith(isobars);
  });

  test("generates and stores isobars for supported fields with values", () => {
    const isobars = { type: "FeatureCollection" };
    const entry = {
      grid: { id: "grid" },
      product: { shortName: "msl" },
    };
    const values = new Float32Array([1013]);
    const renderer = { clearIsobars: vi.fn(), updateIsobars: vi.fn() };
    const generateIsobars = vi.fn(() => isobars);
    const service = createForecastIsobarOverlayService({
      generateIsobars,
      missingValue: 9999,
      renderer,
      supportsIsobars: vi.fn(() => true),
    });

    service.update(entry, values);

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
