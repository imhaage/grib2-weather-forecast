import { describe, expect, test } from "vitest";
import {
  defaultPaletteFor,
  parameterDescriptionFor,
  staticScaleFor,
  variableKeyFor,
} from "./variable-metadata.js";

describe("variable metadata helpers", () => {
  test("variableKeyFor prefers explicit varKey over shortName", () => {
    expect(variableKeyFor({ shortName: "wspd", varKey: "wspd_10" })).toBe("wspd_10");
    expect(variableKeyFor({ shortName: "t" })).toBe("t");
  });

  test("returns default palettes for display-ready variable families", () => {
    expect(defaultPaletteFor("t")).toBe("Temperature");
    expect(defaultPaletteFor("p")).toBe("Plasma");
    expect(defaultPaletteFor("msl")).toBe("Plasma");
    expect(defaultPaletteFor("cape")).toBe("CAPE");
    expect(defaultPaletteFor("r_100")).toBe("Blues");
    expect(defaultPaletteFor("wspd_100")).toBe("Viridis");
    expect(defaultPaletteFor("wind_100")).toBe("Viridis");
    expect(defaultPaletteFor("u_100")).toBe("Viridis");
    expect(defaultPaletteFor("v_100")).toBe("Viridis");
  });

  test("returns static scales for key weather-map variables", () => {
    expect(staticScaleFor("t")).toEqual({ min: -30, max: 50 });
    expect(staticScaleFor("p")).toEqual({ min: 950, max: 1050 });
    expect(staticScaleFor("msl")).toEqual({ min: 950, max: 1050 });
    expect(staticScaleFor("cape")).toEqual({ min: 0, max: 4000 });
    expect(staticScaleFor("r_100")).toEqual({ min: 0, max: 100 });
    expect(staticScaleFor("wspd_100")).toEqual({ min: 0, max: 200 });
    expect(staticScaleFor("wind_100")).toEqual({ min: 0, max: 200 });
    expect(staticScaleFor("u_100")).toEqual({ min: -30, max: 30 });
    expect(staticScaleFor("v_100")).toEqual({ min: -30, max: 30 });
  });

  test("keeps logarithmic precipitation scale metadata together", () => {
    expect(staticScaleFor("rrate")).toEqual({
      min: 0,
      max: 150,
      log: true,
      zeroThreshold: 0.005,
    });
  });

  test("documents CAPE interpretation guidance", () => {
    expect(parameterDescriptionFor("cape")).toMatch(/storms also require triggering/);
  });

  test("falls back safely for unknown variables", () => {
    expect(defaultPaletteFor("unknown")).toBe(null);
    expect(parameterDescriptionFor("unknown")).toBe("");
    expect(staticScaleFor("unknown")).toBe(null);
  });
});
