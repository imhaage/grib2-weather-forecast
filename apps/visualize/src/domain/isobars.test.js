import { describe, expect, test } from "vitest";
import { generalizePressureGrid, generateIsobars, isobarThresholds } from "./isobars.js";

const grid = {
  ni: 4,
  nj: 4,
  latitudeOfFirstPoint: 50,
  longitudeOfFirstPoint: 0,
  latitudeOfLastPoint: 47,
  longitudeOfLastPoint: 3,
  di: 1,
  dj: 1,
};

describe("isobar helpers", () => {
  test("uses 5 hPa thresholds by default", () => {
    expect(isobarThresholds([999.4, 1001.2, 1007.8, 1014.1])).toEqual([1000, 1005, 1010]);
  });

  test("ignores missing pressure values before computing thresholds", () => {
    const geojson = generateIsobars({
      shortName: "p",
      grid,
      values: new Float32Array([
        -9999, 100500, 101000, 101500, -9999, 100500, 101000, 101500, -9999, 100500, 101000, 101500,
        -9999, 100500, 101000, 101500,
      ]),
      missingValue: -9999,
    });

    expect(new Set(geojson.features.map((feature) => feature.properties.value))).toEqual(
      new Set([1010]),
    );
  });

  test("generalizes dense pressure grids before contouring", () => {
    const denseGrid = {
      ...grid,
      ni: 8,
      nj: 4,
      longitudeOfLastPoint: 7,
    };
    const values = new Float32Array([
      100000, 100100, 100200, 100300, 100400, 100500, 100600, 100700, 100000, 100100, 100200,
      100300, 100400, 100500, 100600, 100700, 100000, 100100, 100200, 100300, 100400, 100500,
      100600, 100700, 100000, 100100, 100200, 100300, 100400, 100500, 100600, 100700,
    ]);

    const generalized = generalizePressureGrid({
      grid: denseGrid,
      pressureValues: values,
      maxGridWidth: 4,
      smoothingPasses: 1,
    });

    expect(generalized.grid.ni).toBe(4);
    expect(generalized.grid.nj).toBe(2);
    expect(generalized.values.length).toBe(8);
    expect(generalized.values[0]).toBeGreaterThan(100000);
  });

  test("generates labeled pressure contours in lon/lat coordinates", () => {
    const values = new Float32Array([
      100000, 100500, 101000, 101500, 100000, 100500, 101000, 101500, 100000, 100500, 101000,
      101500, 100000, 100500, 101000, 101500,
    ]);

    const geojson = generateIsobars({
      shortName: "p",
      grid,
      values,
      interval: 5,
    });

    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features.length).toBeGreaterThan(0);
    expect(geojson.features[0].properties.value).toBe(1005);
    expect(geojson.features[0].properties.label).toBe("1005 hPa");
    expect(geojson.features[0].geometry.type).toBe("LineString");
    expect(geojson.features[0].geometry.coordinates[0]).toEqual(
      expect.arrayContaining([expect.any(Number), expect.any(Number)]),
    );
    expect(
      geojson.features.some((feature) =>
        feature.geometry.coordinates.every(([lon]) => lon === 0 || lon === 3),
      ),
    ).toBe(false);
  });
});
