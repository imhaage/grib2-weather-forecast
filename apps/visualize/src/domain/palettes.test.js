import { describe, expect, test } from "vitest";
import { buildLUT, makeScale } from "./palettes.js";

describe("palette helpers", () => {
  test("buildLUT creates one RGB triplet per byte value", () => {
    const lut = buildLUT("TempC");
    expect(lut.length).toBe(256 * 3);
    expect([...lut.slice(0, 3)]).toEqual([8, 48, 107]);
    expect([...lut.slice(-3)]).toEqual([103, 0, 13]);
  });

  test("inverted palettes keep high normalized values at the first color stop", () => {
    expect(makeScale("Plasma")(1).hex()).toBe("#0d0887");
    expect(makeScale("Plasma")(0).hex()).toBe("#f0f921");
  });
});
