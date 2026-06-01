import { describe, expect, test } from "vitest";
import {
  latitudeFromWebMercatorY,
  mercatorCanvasHeight,
  webMercatorX,
  webMercatorY,
} from "./web-mercator.js";

describe("web mercator helpers", () => {
  test("projects longitude and latitude to monotonic Web Mercator coordinates", () => {
    expect(webMercatorX(16)).toBeGreaterThan(webMercatorX(-12));
    expect(webMercatorY(55.4)).toBeGreaterThan(webMercatorY(37.5));
    expect(latitudeFromWebMercatorY(webMercatorY(42.25))).toBeCloseTo(42.25);
  });

  test("computes Mercator-proportional canvas height for the AROME 0.01 grid", () => {
    const height = mercatorCanvasHeight({
      ni: 2801,
      latitudeOfFirstPoint: 55.4,
      latitudeOfLastPoint: 37.5,
      longitudeOfFirstPoint: -12,
      longitudeOfLastPoint: 16,
    });

    expect(height).toBe(2634);
  });
});
