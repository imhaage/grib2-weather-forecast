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

  test("display metadata has safe fallbacks", () => {
    expect(defaultPaletteFor("t")).toBe("Temperature");
    expect(defaultPaletteFor("p")).toBe("Plasma");
    expect(defaultPaletteFor("msl")).toBe("Plasma");
    expect(defaultPaletteFor("unknown")).toBe(null);
    expect(parameterDescriptionFor("cape")).toMatch(/storms also require triggering/);
    expect(parameterDescriptionFor("unknown")).toBe("");
    expect(staticScaleFor("t")).toEqual({ min: -30, max: 50 });
    expect(staticScaleFor("p")).toEqual({ min: 950, max: 1050 });
    expect(staticScaleFor("msl")).toEqual({ min: 950, max: 1050 });
    expect(staticScaleFor("rrate")).toEqual({
      min: 0,
      max: 150,
      log: true,
      zeroThreshold: 0.005,
    });
    expect(defaultPaletteFor("cape")).toBe("CAPE");
    expect(staticScaleFor("cape")).toEqual({ min: 0, max: 4000 });
    expect(staticScaleFor("unknown")).toBe(null);
  });
});
