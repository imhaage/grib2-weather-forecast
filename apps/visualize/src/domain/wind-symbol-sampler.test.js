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
  test("returns only features inside visible bounds", () => {
    const speedValues = new Float32Array(12).fill(3);
    const directionValues = new Float32Array(12).fill(90);

    const collection = buildWindSymbolFeatures({
      grid,
      speedValues,
      directionValues,
      missingValue: -1e100,
      bounds: { west: 1.5, south: 50.5, east: 3.5, north: 51.5 },
      zoom: 6,
      viewport: { width: 800, height: 600 },
    });

    expect(collection.type).toBe("FeatureCollection");
    expect(
      collection.features.every((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        return lng >= 1.5 && lng <= 3.5 && lat >= 50.5 && lat <= 51.5;
      }),
    ).toBe(true);
  });

  test("marks calm wind when display speed is below 5 km/h", () => {
    const collection = buildWindSymbolFeatures({
      grid,
      speedValues: new Float32Array(12).fill(1),
      directionValues: new Float32Array(12).fill(180),
      missingValue: -1e100,
      bounds: { west: 0, south: 49, east: 5, north: 53 },
      zoom: 8,
      viewport: { width: 800, height: 600 },
      speedUnitTransform: (value) => value * 3.6,
    });

    expect(collection.features[0].properties.symbol).toBe("calm");
  });

  test("stores fixed-size arrow properties for non-calm wind", () => {
    const collection = buildWindSymbolFeatures({
      grid,
      speedValues: new Float32Array(12).fill(4),
      directionValues: new Float32Array(12).fill(270),
      missingValue: -1e100,
      bounds: { west: 0, south: 49, east: 5, north: 53 },
      zoom: 8,
      viewport: { width: 800, height: 600 },
      speedUnitTransform: (value) => value * 3.6,
    });

    expect(collection.features[0].properties).toMatchObject({
      symbol: "arrow",
      directionDegrees: 270,
      cardinal: "W",
      speedKmh: 14.4,
    });
  });

  test("keeps useful density when the visible bounds cover a small grid subset", () => {
    const wideGrid = {
      ...grid,
      ni: 100,
      nj: 2,
      latitudeOfFirstPoint: 51,
      latitudeOfLastPoint: 50,
      longitudeOfFirstPoint: 0,
      longitudeOfLastPoint: 99,
      di: 1,
      dj: 1,
    };

    const collection = buildWindSymbolFeatures({
      grid: wideGrid,
      speedValues: new Float32Array(200).fill(4),
      directionValues: new Float32Array(200).fill(90),
      missingValue: -1e100,
      bounds: { west: 10, south: 49, east: 20, north: 52 },
      zoom: 8,
      viewport: { width: 420, height: 300 },
      speedUnitTransform: (value) => value * 3.6,
    });

    expect(collection.features.length).toBeGreaterThan(5);
  });
});
