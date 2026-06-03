import { describe, expect, test } from "vitest";
import {
  componentVariableKeyForWind,
  isWindCompositeVariable,
  windCompositeLevelFor,
  windCompositeVariableForLevel,
} from "./wind-composite-variable.js";

describe("wind composite variables", () => {
  test("recognizes composite wind variables by key", () => {
    expect(isWindCompositeVariable("wind_10")).toBe(true);
    expect(isWindCompositeVariable("wind_100")).toBe(true);
    expect(isWindCompositeVariable("wspd_10")).toBe(false);
    expect(isWindCompositeVariable("wdir_10")).toBe(false);
  });

  test("maps wind composites to speed and direction components", () => {
    expect(componentVariableKeyForWind("wind_50", "speed")).toBe("wspd_50");
    expect(componentVariableKeyForWind("wind_50", "direction")).toBe("wdir_50");
    expect(componentVariableKeyForWind("t", "speed")).toBe(null);
  });

  test("creates display variable definitions for wind levels", () => {
    expect(windCompositeVariableForLevel(20)).toMatchObject({
      shortName: "wind",
      varKey: "wind_20",
      levelValue: 20,
      name: "Wind (20m)",
      level: "20 m above ground",
      units: "km/h",
      group: "Weather maps",
    });
  });

  test("extracts wind composite levels", () => {
    expect(windCompositeLevelFor("wind_10")).toBe(10);
    expect(windCompositeLevelFor("wind_100")).toBe(100);
    expect(windCompositeLevelFor("wind")).toBe(null);
  });
});
