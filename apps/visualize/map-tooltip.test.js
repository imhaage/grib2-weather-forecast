import { describe, expect, test } from "vitest";
import { formatMapTooltipValue } from "./map-tooltip.js";

describe("map tooltip formatting", () => {
  test("formats composite wind speed and direction", () => {
    expect(
      formatMapTooltipValue({
        rawValue: 12,
        vectorUValue: 1,
        vectorVValue: 0,
        gridState: {
          unitFn: null,
          displayUnits: "km/h",
          product: { units: "m s-1" },
          vectorUValues: new Float32Array([1]),
          vectorVValues: new Float32Array([0]),
        },
      }),
    ).toBe("12.00 km/h · 270° W");
  });
});
