import { describe, expect, test } from "vitest";
import { buildLUT, makeScale } from "./palettes.js";

describe("palette helpers", () => {
  test("buildLUT creates one RGB triplet per byte value", () => {
    const lut = buildLUT("Temperature", { min: -30, max: 50 });
    expect(lut.length).toBe(256 * 3);
    expect([...lut.slice(0, 3)]).toEqual([8, 48, 107]);
    expect([...lut.slice(-3)]).toEqual([103, 0, 13]);
  });

  test("palettes are defined in their final display order", () => {
    expect(makeScale("Plasma")(0).hex()).toBe("#f0f921");
    expect(makeScale("Plasma")(1).hex()).toBe("#0d0887");
    expect(makeScale("Viridis")(0).hex()).toBe("#fee825");
    expect(makeScale("Blues")(0).hex()).toBe("#f7fbff");
  });

  test("temperature keeps an independent domain for the freezing point", () => {
    const scale = makeScale("Temperature", { min: -30, max: 50 });
    expect(scale(0.375).hex()).toBe("#ffffff");
    expect(scale(0.5).hex()).toBe("#ffc800");
  });

  test("CAPE uses explicit convective-energy thresholds", () => {
    const scale = makeScale("CAPE", { min: 0, max: 4000 });
    expect(scale(0).hex()).toBe("#1f2937");
    expect(scale(0.25).hex()).toBe("#facc15");
    expect(scale(1).hex()).toBe("#7e22ce");
  });
});
