import { cardinalDirectionForDegrees, normalizeDegrees } from "./wind-direction-format.js";

const CALM_WIND_KMH = 5;
const TARGET_SYMBOL_SPACING_PX = 42;

function createFeatureCollection(features) {
  return {
    type: "FeatureCollection",
    features,
  };
}

function visibleColumnCount(grid, bounds) {
  const westCol = Math.max(0, Math.floor((bounds.west - grid.longitudeOfFirstPoint) / grid.di));
  const eastCol = Math.min(
    grid.ni - 1,
    Math.ceil((bounds.east - grid.longitudeOfFirstPoint) / grid.di),
  );
  return Math.max(1, eastCol - westCol + 1);
}

function sampleStrideForViewport(grid, bounds, viewport) {
  const approximateColumns = Math.max(1, Math.floor(viewport.width / TARGET_SYMBOL_SPACING_PX));
  return Math.max(1, Math.floor(visibleColumnCount(grid, bounds) / approximateColumns));
}

function isInsideBounds(lng, lat, bounds) {
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

function hasDisplayValue(value, missingValue) {
  return Number.isFinite(value) && value > missingValue;
}

export function buildWindSymbolFeatures({
  grid,
  speedValues,
  directionValues,
  missingValue,
  bounds,
  viewport,
  speedUnitTransform = (value) => value,
}) {
  if (!grid || !speedValues || !directionValues || !bounds || !viewport) {
    return createFeatureCollection([]);
  }

  const features = [];
  const stride = sampleStrideForViewport(grid, bounds, viewport);
  const northLat = Math.max(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const isStoN = grid.latitudeOfLastPoint > grid.latitudeOfFirstPoint;

  for (let rowFromNorth = 0; rowFromNorth < grid.nj; rowFromNorth += stride) {
    const lat = northLat - rowFromNorth * grid.dj;
    const row = isStoN ? grid.nj - 1 - rowFromNorth : rowFromNorth;

    for (let col = 0; col < grid.ni; col += stride) {
      const lng = grid.longitudeOfFirstPoint + col * grid.di;
      if (!isInsideBounds(lng, lat, bounds)) continue;

      const index = row * grid.ni + col;
      const rawSpeed = speedValues[index];
      const rawDirection = directionValues[index];
      if (!hasDisplayValue(rawSpeed, missingValue) || !hasDisplayValue(rawDirection, missingValue)) {
        continue;
      }

      const speedKmh = speedUnitTransform(rawSpeed);
      const directionDegrees = normalizeDegrees(rawDirection);
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        properties: {
          symbol: speedKmh < CALM_WIND_KMH ? "calm" : "arrow",
          speedKmh,
          directionDegrees,
          cardinal: cardinalDirectionForDegrees(directionDegrees),
        },
      });
    }
  }

  return createFeatureCollection(features);
}
