import { describe, expect, test } from "vitest";
import { buildLUT, legendTicksFor, makeScale } from "./palettes.js";

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

  test("legend ticks use custom palette domains when available", () => {
    expect(legendTicksFor({ paletteName: "CAPE", min: 0, max: 4000 })).toEqual([
      { value: 0, position: 0 },
      { value: 100, position: 2.5 },
      { value: 500, position: 12.5 },
      { value: 1000, position: 25 },
      { value: 2000, position: 50 },
      { value: 3000, position: 75 },
      { value: 4000, position: 100 },
    ]);
  });

  test("legend ticks can follow logarithmic precipitation scales", () => {
    expect(legendTicksFor({ paletteName: "Spectral", min: 0, max: 20, isLog: true })).toEqual([
      { value: 0, position: 0 },
      { value: 1, position: 43.46 },
      { value: 5, position: 73.84 },
      { value: 10, position: 86.92 },
      { value: 20, position: 100 },
    ]);
  });
});
