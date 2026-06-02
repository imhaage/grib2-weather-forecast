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
      renderGen: 4,
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
      renderGen: 4,
      paletteName: "Viridis",
      missingValue: -1e100,
      includeValues: true,
    });

    expect(request).toMatchObject({
      type: "renderHour",
      gen: 4,
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
});
