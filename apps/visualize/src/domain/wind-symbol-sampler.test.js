import { describe, expect, test } from "vitest";
import { buildWindSymbolFeatures } from "./wind-symbol-sampler.js";

const grid = {
  ni: 4,
  nj: 3,
  latitudeOfFirstPoint: 52,
  latitudeOfLastPoint: 50,
  longitudeOfFirstPoint: 1,
  longitudeOfLastPoint: 4,
  di: 1,
  dj: 1,
};

describe("wind symbol sampler", () => {
  test("returns only vector-aggregated features inside visible bounds", () => {
    const collection = buildWindSymbolFeatures({
      grid,
      vectorUValues: new Float32Array(12).fill(3),
      vectorVValues: new Float32Array(12).fill(4),
      missingValue: -1e100,
      bounds: { west: 1.5, south: 50.5, east: 3.5, north: 51.5 },
      zoom: 8,
    });

    expect(collection.type).toBe("FeatureCollection");
    expect(
      collection.features.every((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        return lng >= 1.5 && lng <= 3.5 && lat >= 50.5 && lat <= 51.5;
      }),
    ).toBe(true);
  });

  test("marks calm wind when aggregated vector speed is below 5 km/h", () => {
    const collection = buildWindSymbolFeatures({
      grid,
      vectorUValues: new Float32Array(12).fill(1),
      vectorVValues: new Float32Array(12).fill(0),
      missingValue: -1e100,
      bounds: { west: 0, south: 49, east: 5, north: 53 },
      zoom: 8,
    });

    expect(collection.features[0].properties.symbol).toBe("calm");
  });

  test("stores arrow properties from aggregated u and v components", () => {
    const collection = buildWindSymbolFeatures({
      grid,
      vectorUValues: new Float32Array(12).fill(0),
      vectorVValues: new Float32Array(12).fill(-4),
      missingValue: -1e100,
      bounds: { west: 0, south: 49, east: 5, north: 53 },
      zoom: 8,
    });

    expect(collection.features[0].properties).toMatchObject({
      symbol: "arrow",
      directionDegrees: 0,
      cardinal: "N",
      speedKmh: 14.4,
    });
  });

  test("averages u and v components inside each matrix block", () => {
    const vectorUValues = new Float32Array(16).fill(1);
    vectorUValues[0] = 9;
    const collection = buildWindSymbolFeatures({
      grid: {
        ...grid,
        ni: 4,
        nj: 4,
        latitudeOfFirstPoint: 53,
        latitudeOfLastPoint: 50,
      },
      vectorUValues,
      vectorVValues: new Float32Array(16).fill(0),
      missingValue: -1e100,
      bounds: { west: 0, south: 49, east: 5, north: 54 },
      zoom: 6,
    });

    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].properties.speedKmh).toBeCloseTo(5.4);
    expect(collection.features[0].properties.directionDegrees).toBe(270);
  });

  test("uses zoom 6 as the one-point-out-of-four reference density", () => {
    const wideGrid = {
      ...grid,
      ni: 100,
      nj: 1,
      latitudeOfFirstPoint: 50,
      latitudeOfLastPoint: 50,
      longitudeOfFirstPoint: 0,
      longitudeOfLastPoint: 99,
      di: 1,
      dj: 1,
    };

    const collection = buildWindSymbolFeatures({
      grid: wideGrid,
      vectorUValues: new Float32Array(100).fill(4),
      vectorVValues: new Float32Array(100).fill(0),
      missingValue: -1e100,
      bounds: { west: 0, south: 49, east: 99, north: 51 },
      zoom: 6,
    });

    expect(collection.features).toHaveLength(25);
  });

  test("changes matrix stride only when the rounded zoom changes", () => {
    const wideGrid = {
      ...grid,
      ni: 100,
      nj: 1,
      latitudeOfFirstPoint: 50,
      latitudeOfLastPoint: 50,
      longitudeOfFirstPoint: 0,
      longitudeOfLastPoint: 99,
      di: 1,
      dj: 1,
    };

    const createCollection = (zoom) =>
      buildWindSymbolFeatures({
        grid: wideGrid,
        vectorUValues: new Float32Array(100).fill(4),
        vectorVValues: new Float32Array(100).fill(0),
        missingValue: -1e100,
        bounds: { west: 0, south: 49, east: 99, north: 51 },
        zoom,
      });

    expect(createCollection(5.49).features).toHaveLength(13);
    expect(createCollection(5.5).features).toHaveLength(25);
    expect(createCollection(6.49).features).toHaveLength(25);
    expect(createCollection(4.49).features).toHaveLength(7);
    expect(createCollection(6.51).features).toHaveLength(50);
  });
});
