import { describe, expect, test } from "vitest";
import {
  computeAccumulationDiff,
  createRenderScaleParams,
  effectiveForecastTime,
  forecastMessageKeys,
  productMatchesVariable,
} from "./forecast-field.js";

describe("forecast field domain logic", () => {
  test("uses block end hour as effective time for single-hour accumulations", () => {
    expect(
      effectiveForecastTime({ pdtNumber: 8, forecastTime: 0 }, { startHour: 12, endHour: 12 }),
    ).toBe(12);
  });

  test("keeps product forecast time for regular fields and multi-hour blocks", () => {
    expect(
      effectiveForecastTime({ pdtNumber: 0, forecastTime: 3 }, { startHour: 1, endHour: 1 }),
    ).toBe(3);
    expect(
      effectiveForecastTime({ pdtNumber: 8, forecastTime: 0 }, { startHour: 1, endHour: 12 }),
    ).toBe(0);
  });

  test("builds level-specific lookup keys before simple lookup keys", () => {
    expect(forecastMessageKeys(10, { shortName: "ws", levelValue: 50 })).toEqual([
      "10_ws_50",
      "10_ws",
    ]);
    expect(forecastMessageKeys(10, { shortName: "t" })).toEqual(["10_t"]);
  });

  test("matches variables by short name and optional level value", () => {
    const product = { shortName: "r", levelValue: 2 };

    expect(productMatchesVariable(product, { shortName: "r", levelValue: 2 })).toBe(true);
    expect(productMatchesVariable(product, { shortName: "r", levelValue: 10 })).toBe(false);
    expect(productMatchesVariable(product, { shortName: "r", levelValue: null })).toBe(true);
    expect(productMatchesVariable(product, { shortName: "t" })).toBe(false);
  });

  test("computes accumulation diff while preserving missing values", () => {
    const diff = computeAccumulationDiff({
      currentValues: new Float32Array([5, -1e100, 9, 4]),
      previousValues: new Float32Array([2, 1, -1e100, 7]),
      missingValue: -1e100,
    });

    expect([...diff]).toEqual([3, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, 0]);
  });

  test("creates render scale params for linear and log scales", () => {
    expect(createRenderScaleParams(null, 0.1)).toEqual({
      renderMin: 0,
      renderMax: 1,
      range: 1,
      isLog: false,
      logDenom: 1,
      zeroThreshold: 0,
    });

    expect(
      createRenderScaleParams({ min: 0, max: 100, log: true, zeroThreshold: 0.5 }, 0.1),
    ).toEqual({
      renderMin: 0,
      renderMax: 100,
      range: 100,
      isLog: true,
      logDenom: Math.log(100 / 0.1),
      zeroThreshold: 0.5,
    });
  });
});
