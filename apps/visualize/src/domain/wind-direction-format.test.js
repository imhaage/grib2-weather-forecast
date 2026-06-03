import { describe, expect, test } from "vitest";
import { cardinalDirectionForDegrees, normalizeDegrees } from "./wind-direction-format.js";

describe("wind direction formatting", () => {
  test("normalizes degrees into the 0-360 range", () => {
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(725)).toBe(5);
    expect(normalizeDegrees(-10)).toBe(350);
  });

  test("formats cardinal directions with 16-wind labels", () => {
    expect(cardinalDirectionForDegrees(0)).toBe("N");
    expect(cardinalDirectionForDegrees(45)).toBe("NE");
    expect(cardinalDirectionForDegrees(240)).toBe("WSW");
    expect(cardinalDirectionForDegrees(270)).toBe("W");
  });
});
