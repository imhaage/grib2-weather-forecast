import { describe, expect, test } from "vitest";
import {
  componentVariableKeyForVector,
  isVectorCompositeVariable,
  vectorCompositeVariableFor,
} from "./wind-composite-variable.js";

describe("vector composite variables", () => {
  test("recognizes vector composite variables by key", () => {
    expect(isVectorCompositeVariable("wind")).toBe(true);
    expect(isVectorCompositeVariable("gust")).toBe(true);
    expect(isVectorCompositeVariable("u")).toBe(false);
    expect(isVectorCompositeVariable("vgust")).toBe(false);
  });

  test("maps vector composites to u and v components", () => {
    expect(componentVariableKeyForVector("wind", "u")).toBe("u");
    expect(componentVariableKeyForVector("wind", "v")).toBe("v");
    expect(componentVariableKeyForVector("gust", "u")).toBe("ugust");
    expect(componentVariableKeyForVector("gust", "v")).toBe("vgust");
    expect(componentVariableKeyForVector("t", "u")).toBe(null);
  });

  test("creates display variable definitions for wind and gust", () => {
    expect(vectorCompositeVariableFor("wind")).toMatchObject({
      shortName: "wind",
      name: "Wind (10m)",
      units: "km/h",
      group: "Weather maps",
    });
    expect(vectorCompositeVariableFor("gust")).toMatchObject({
      shortName: "gust",
      name: "Wind gust (10m)",
      units: "km/h",
      group: "Weather maps",
    });
  });
});
