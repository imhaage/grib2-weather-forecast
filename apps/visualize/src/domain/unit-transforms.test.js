import { describe, expect, test } from "vitest";
import {
  applyUnitTransform,
  displayUnitsFor,
  formatValueForUnits,
  unitTransformFor,
} from "./unit-transforms.js";

describe("unit transform helpers", () => {
  test("pressure values are converted to hPa and formatted as integers", () => {
    expect(unitTransformFor("p")).toBe("p");
    expect(displayUnitsFor("p", "Pa")).toBe("hPa");
    expect(applyUnitTransform("p", 101325)).toBe(1013.25);
    expect(formatValueForUnits(1013.25, "hPa", 2)).toBe("1013");
  });

  test("non-pressure values keep the requested display precision", () => {
    expect(formatValueForUnits(12.3456, "°C", 2)).toBe("12.35");
    expect(formatValueForUnits(12.3456, "km/h", 1)).toBe("12.3");
  });
});
