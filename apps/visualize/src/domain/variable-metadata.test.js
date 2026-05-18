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
    expect(defaultPaletteFor("t")).toBe("TempC");
    expect(defaultPaletteFor("unknown")).toBe(null);
    expect(parameterDescriptionFor("cape")).toMatch(/thunderstorm development/);
    expect(parameterDescriptionFor("unknown")).toBe("");
    expect(staticScaleFor("rrate")).toEqual({
      min: 0,
      max: 150,
      log: true,
      zeroThreshold: 0.005,
    });
    expect(staticScaleFor("unknown")).toBe(null);
  });
});
