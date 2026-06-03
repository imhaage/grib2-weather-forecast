import { describe, expect, test } from "vitest";
import { createForecastRenderRequest } from "./forecast-render-request-service.js";

function createState(overrides = {}) {
  return {
    packageKey: "AROME_HP1",
    variable: "wspd_10",
    resources: [
      {
        key: "01H",
        startHour: 1,
        endHour: 1,
      },
      {
        key: "02H",
        startHour: 2,
        endHour: 2,
      },
    ],
    availableBlocks: new Set(["02H"]),
    hourList: [1, 2],
    ...overrides,
  };
}

describe("forecast render request service", () => {
  test("returns null when the matching block is not available in memory", () => {
    const request = createForecastRenderRequest({
      state: createState({ availableBlocks: new Set() }),
      hourIndex: 1,
      hour: 2,
      renderGeneration: 4,
      paletteName: "Viridis",
      missingValue: -1e100,
    });

    expect(request).toBeNull();
  });

  test("builds a model worker render request with variable, scale and previous block metadata", () => {
    const state = createState();
    const request = createForecastRenderRequest({
      state,
      hourIndex: 1,
      hour: 2,
      renderGeneration: 4,
      paletteName: "Viridis",
      missingValue: -1e100,
      includeValues: true,
    });

    expect(request).toMatchObject({
      type: "renderHour",
      renderGeneration: 4,
      blockKey: "02H",
      block: state.resources[1],
      hour: 2,
      previousBlockKey: "01H",
      previousBlock: state.resources[0],
      previousHour: 1,
      unitTransform: "wspd",
      variable: {
        shortName: "wspd",
        levelValue: 10,
      },
      staticScale: { min: 0, max: 200 },
      renderMin: 0,
      range: 200,
      isLog: false,
      logFloor: 0.1,
      logDenom: 1,
      zeroThreshold: 0,
      displayUnits: "km/h",
      missingValue: -1e100,
      includeValues: true,
    });
    expect(request.lut).toBeInstanceOf(Uint8Array);
    expect(request.lut).toHaveLength(256 * 3);
  });

  test("renders composite wind variables from the matching u and v components", () => {
    const state = createState({ packageKey: "AROME_SP1", variable: "wind" });
    const request = createForecastRenderRequest({
      state,
      hourIndex: 1,
      hour: 2,
      renderGeneration: 7,
      paletteName: "Viridis",
      missingValue: -1e100,
      includeValues: true,
    });

    expect(request).toMatchObject({
      variable: { shortName: "u", levelValue: null },
      secondaryVariable: { shortName: "v", levelValue: null },
      vectorComposite: { shortName: "wind", uComponent: "u", vComponent: "v" },
      unitTransform: null,
      displayUnits: "km/h",
      staticScale: { min: 0, max: 200 },
    });
  });

  test("renders composite gust variables from the matching u and v gust components", () => {
    const state = createState({ packageKey: "AROME_SP1", variable: "gust" });
    const request = createForecastRenderRequest({
      state,
      hourIndex: 1,
      hour: 2,
      renderGeneration: 8,
      paletteName: "Viridis",
      missingValue: -1e100,
    });

    expect(request).toMatchObject({
      variable: { shortName: "ugust", levelValue: null },
      secondaryVariable: { shortName: "vgust", levelValue: null },
      vectorComposite: { shortName: "gust", uComponent: "ugust", vComponent: "vgust" },
      unitTransform: null,
      displayUnits: "km/h",
      staticScale: { min: 0, max: 200 },
    });
  });
});
