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
const sampling = { referenceZoom: 6, matrixStride: 16 };

function buildFeatures(options) {
  return buildWindSymbolFeatures({ sampling, ...options });
}

describe("wind symbol sampler", () => {
  test("returns only vector-aggregated features inside visible bounds", () => {
    const collection = buildFeatures({
      grid,
      vectorUValues: new Float32Array(12).fill(3),
      vectorVValues: new Float32Array(12).fill(4),
      missingValue: -1e100,
      bounds: { west: 1.5, south: 50.5, east: 3.5, north: 51.5 },
      zoom: 10,
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
    const collection = buildFeatures({
      grid,
      vectorUValues: new Float32Array(12).fill(1),
      vectorVValues: new Float32Array(12).fill(0),
      missingValue: -1e100,
      bounds: { west: 0, south: 49, east: 5, north: 53 },
      zoom: 10,
    });

    expect(collection.features[0].properties.symbol).toBe("calm");
  });

  test("stores arrow properties from aggregated u and v components", () => {
    const collection = buildFeatures({
      grid,
      vectorUValues: new Float32Array(12).fill(0),
      vectorVValues: new Float32Array(12).fill(-4),
      missingValue: -1e100,
      bounds: { west: 0, south: 49, east: 5, north: 53 },
      zoom: 10,
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
    const collection = buildFeatures({
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
      zoom: 8,
    });

    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].properties.speedKmh).toBeCloseTo(5.4);
    expect(collection.features[0].properties.directionDegrees).toBe(270);
  });

  test("uses zoom 6 as the reduced reference density", () => {
    const wideGrid = {
      ...grid,
      ni: 100,
      nj: 16,
      latitudeOfFirstPoint: 65,
      latitudeOfLastPoint: 50,
      longitudeOfFirstPoint: 0,
      longitudeOfLastPoint: 99,
      di: 1,
      dj: 1,
    };

    const collection = buildFeatures({
      grid: wideGrid,
      vectorUValues: new Float32Array(1600).fill(4),
      vectorVValues: new Float32Array(1600).fill(0),
      missingValue: -1e100,
      bounds: { west: 0, south: 50, east: 99, north: 65 },
      zoom: 6,
    });

    expect(collection.features).toHaveLength(6);
  });

  test("skips incomplete edge blocks at zoom 6", () => {
    const wideGrid = {
      ...grid,
      ni: 100,
      nj: 100,
      latitudeOfFirstPoint: 99,
      latitudeOfLastPoint: 0,
      longitudeOfFirstPoint: 0,
      longitudeOfLastPoint: 99,
      di: 1,
      dj: 1,
    };

    const collection = buildFeatures({
      grid: wideGrid,
      vectorUValues: new Float32Array(10000).fill(4),
      vectorVValues: new Float32Array(10000).fill(0),
      missingValue: -1e100,
      bounds: { west: 0, south: 0, east: 99, north: 99 },
      zoom: 6,
    });

    expect(collection.features).toHaveLength(36);
  });

  test("skips blocks that are only partially inside the visible bounds", () => {
    const wideGrid = {
      ...grid,
      ni: 100,
      nj: 100,
      latitudeOfFirstPoint: 99,
      latitudeOfLastPoint: 0,
      longitudeOfFirstPoint: 0,
      longitudeOfLastPoint: 99,
      di: 1,
      dj: 1,
    };

    const collection = buildFeatures({
      grid: wideGrid,
      vectorUValues: new Float32Array(10000).fill(4),
      vectorVValues: new Float32Array(10000).fill(0),
      missingValue: -1e100,
      bounds: { west: 0, south: 0, east: 50, north: 99 },
      zoom: 6,
    });

    expect(collection.features).toHaveLength(18);
  });

  test("skips blocks without a complete set of usable vector cells", () => {
    const blockGrid = {
      ...grid,
      ni: 16,
      nj: 16,
      latitudeOfFirstPoint: 65,
      latitudeOfLastPoint: 50,
      longitudeOfFirstPoint: 0,
      longitudeOfLastPoint: 15,
      di: 1,
      dj: 1,
    };
    const vectorUValues = new Float32Array(256).fill(4);
    vectorUValues[0] = -Infinity;

    const collection = buildFeatures({
      grid: blockGrid,
      vectorUValues,
      vectorVValues: new Float32Array(256).fill(0),
      missingValue: -1e100,
      bounds: { west: 0, south: 50, east: 15, north: 65 },
      zoom: 6,
    });

    expect(collection.features).toHaveLength(0);
  });

  test("changes matrix stride only when the rounded zoom changes", () => {
    const wideGrid = {
      ...grid,
      ni: 100,
      nj: 64,
      latitudeOfFirstPoint: 113,
      latitudeOfLastPoint: 50,
      longitudeOfFirstPoint: 0,
      longitudeOfLastPoint: 99,
      di: 1,
      dj: 1,
    };

    const createCollection = (zoom) =>
      buildWindSymbolFeatures({
        sampling,
        grid: wideGrid,
        vectorUValues: new Float32Array(6400).fill(4),
        vectorVValues: new Float32Array(6400).fill(0),
        missingValue: -1e100,
        bounds: { west: 0, south: 50, east: 99, north: 113 },
        zoom,
      });

    expect(createCollection(5.49).features).toHaveLength(6);
    expect(createCollection(5.5).features).toHaveLength(24);
    expect(createCollection(6.49).features).toHaveLength(24);
    expect(createCollection(4.49).features).toHaveLength(1);
    expect(createCollection(6.51).features).toHaveLength(96);
  });

  test("uses an injected sampling policy for presentation density", () => {
    const collection = buildWindSymbolFeatures({
      sampling: { referenceZoom: 0, matrixStride: 4 },
      grid: {
        ...grid,
        ni: 8,
        nj: 8,
        latitudeOfFirstPoint: 57,
        latitudeOfLastPoint: 50,
        longitudeOfFirstPoint: 0,
        longitudeOfLastPoint: 7,
        di: 1,
        dj: 1,
      },
      vectorUValues: new Float32Array(64).fill(4),
      vectorVValues: new Float32Array(64).fill(0),
      missingValue: -1e100,
      bounds: { west: 0, south: 50, east: 7, north: 57 },
      zoom: 0,
    });

    expect(collection.features).toHaveLength(4);
  });
});
