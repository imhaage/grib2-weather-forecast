import { describe, expect, test } from "vitest";
import { formatMapTooltipValue } from "./map-tooltip.js";

describe("map tooltip formatting", () => {
  test("formats composite wind speed and direction", () => {
    expect(
      formatMapTooltipValue({
        rawValue: 12,
        directionValue: 240,
        gridState: {
          unitFn: (value) => value * 3.6,
          displayUnits: "km/h",
          product: { units: "m s-1" },
          windDirectionValues: new Float32Array([240]),
        },
      }),
    ).toBe("43.20 km/h · 240° WSW");
  });
});
