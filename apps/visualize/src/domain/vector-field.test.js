import { describe, expect, test } from "vitest";
import { deriveVectorSpeedValues } from "./vector-field.js";

describe("vector field", () => {
  test("derives km/h speed values from u and v components", () => {
    const values = deriveVectorSpeedValues({
      uValues: new Float32Array([3, 0]),
      vValues: new Float32Array([4, -2]),
      missingValue: -1e100,
    });

    expect(values[0]).toBe(18);
    expect(values[1]).toBeCloseTo(7.2);
  });

  test("keeps a missing value when either vector component is missing", () => {
    const values = deriveVectorSpeedValues({
      uValues: new Float32Array([3, -1e100, 1]),
      vValues: new Float32Array([-1e100, 4, 1]),
      missingValue: -1e100,
    });

    expect(values[0]).toBe(-Infinity);
    expect(values[1]).toBe(-Infinity);
    expect(values[2]).toBeCloseTo(Math.hypot(1, 1) * 3.6);
  });
});
