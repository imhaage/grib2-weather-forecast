import type { GridDefinition } from "../../domain/field-types";
import type { ForecastFeatureCollection, ForecastMapEntry, ForecastRaster } from "./map-contracts";

export function makeGridDefinition(overrides: Partial<GridDefinition> = {}): GridDefinition {
  return {
    ni: 2,
    nj: 2,
    di: 1,
    dj: 1,
    latitudeOfFirstPoint: 51,
    longitudeOfFirstPoint: 1,
    latitudeOfLastPoint: 50,
    longitudeOfLastPoint: 2,
    ...overrides,
  };
}

export function makeForecastFeatureCollection(features: unknown[] = []): ForecastFeatureCollection {
  return {
    type: "FeatureCollection",
    features,
  };
}

export function makeForecastMapEntry(overrides: Partial<ForecastMapEntry> = {}): ForecastMapEntry {
  const bitmap: ForecastRaster = {
    close() {},
  };

  return {
    bitmap,
    dataMin: 1,
    dataMax: 5,
    mean: 3,
    count: 4,
    displayUnits: "K",
    renderMin: 0,
    range: 10,
    staticScale: null,
    isLog: false,
    grid: makeGridDefinition(),
    product: { name: "Temperature", shortName: "t", pdtNumber: 0 },
    header: {},
    ...overrides,
  };
}
