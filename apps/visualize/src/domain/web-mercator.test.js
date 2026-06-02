import { describe, expect, test } from "vitest";
import {
  gridCorners,
  latitudeFromWebMercatorY,
  mercatorCanvasHeight,
  renderProjectionForGrid,
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

  test("returns map corners in north/east/south/west order", () => {
    const grid = {
      latitudeOfFirstPoint: 40,
      longitudeOfFirstPoint: 5,
      latitudeOfLastPoint: 50,
      longitudeOfLastPoint: -5,
    };

    expect(gridCorners(grid)).toEqual([
      [-5, 50],
      [5, 50],
      [5, 40],
      [-5, 40],
    ]);
  });

  test("builds render projection values for workers", () => {
    const projection = renderProjectionForGrid({
      latitudeOfFirstPoint: 40,
      latitudeOfLastPoint: 50,
    });

    expect(projection.northLat).toBe(50);
    expect(projection.southLat).toBe(40);
    expect(projection.isStoN).toBe(true);
    expect(projection.spanY).toBeGreaterThan(0);
  });
});
