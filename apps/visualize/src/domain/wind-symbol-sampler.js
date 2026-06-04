import {
  directionDegreesFromVector,
  hasUsableVectorComponent,
  speedKmhFromVector,
} from "./vector-field.js";
import { cardinalDirectionForDegrees } from "./wind-direction-format.js";

const CALM_WIND_KMH = 5;

function createFeatureCollection(features) {
  return {
    type: "FeatureCollection",
    features,
  };
}

function matrixStrideForZoom(zoom, sampling) {
  if (
    !sampling ||
    !Number.isFinite(sampling.referenceZoom) ||
    !Number.isFinite(sampling.matrixStride) ||
    sampling.matrixStride <= 0
  ) {
    throw new TypeError("Wind symbol sampling policy is required");
  }
  const roundedZoom = Math.round(Number.isFinite(zoom) ? zoom : sampling.referenceZoom);
  const scale = 2 ** (sampling.referenceZoom - roundedZoom);
  return Math.max(1, Math.round(sampling.matrixStride * scale));
}

function latitudeForRowFromNorth(grid, rowFromNorth, northLat) {
  return northLat - rowFromNorth * grid.dj;
}

function gridRowForRowFromNorth(grid, rowFromNorth, isStoN) {
  return isStoN ? grid.nj - 1 - rowFromNorth : rowFromNorth;
}

function isInsideBounds(lng, lat, bounds) {
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

function blockFitsGrid(grid, startRowFromNorth, startCol, stride) {
  return startRowFromNorth + stride <= grid.nj && startCol + stride <= grid.ni;
}

function blockFitsBounds(grid, bounds, startRowFromNorth, startCol, stride, northLat) {
  const westLng = grid.longitudeOfFirstPoint + startCol * grid.di;
  const eastLng = grid.longitudeOfFirstPoint + (startCol + stride - 1) * grid.di;
  const northBlockLat = latitudeForRowFromNorth(grid, startRowFromNorth, northLat);
  const southBlockLat = latitudeForRowFromNorth(grid, startRowFromNorth + stride - 1, northLat);
  return (
    westLng >= bounds.west &&
    eastLng <= bounds.east &&
    southBlockLat >= bounds.south &&
    northBlockLat <= bounds.north
  );
}

function aggregateVectorBlock({
  grid,
  vectorUValues,
  vectorVValues,
  missingValue,
  bounds,
  startRowFromNorth,
  startCol,
  stride,
  northLat,
  isStoN,
}) {
  let uSum = 0;
  let vSum = 0;
  let lngSum = 0;
  let latSum = 0;
  let count = 0;
  const endRowFromNorth = startRowFromNorth + stride;
  const endCol = startCol + stride;
  const expectedCount = stride * stride;

  for (let rowFromNorth = startRowFromNorth; rowFromNorth < endRowFromNorth; rowFromNorth += 1) {
    const lat = latitudeForRowFromNorth(grid, rowFromNorth, northLat);
    const row = gridRowForRowFromNorth(grid, rowFromNorth, isStoN);

    for (let col = startCol; col < endCol; col += 1) {
      const lng = grid.longitudeOfFirstPoint + col * grid.di;
      if (!isInsideBounds(lng, lat, bounds)) continue;

      const index = row * grid.ni + col;
      const u = vectorUValues[index];
      const v = vectorVValues[index];
      if (
        !hasUsableVectorComponent(u, missingValue) ||
        !hasUsableVectorComponent(v, missingValue)
      ) {
        continue;
      }

      uSum += u;
      vSum += v;
      lngSum += lng;
      latSum += lat;
      count += 1;
    }
  }

  if (count !== expectedCount) return null;
  return {
    u: uSum / count,
    v: vSum / count,
    lng: lngSum / count,
    lat: latSum / count,
  };
}

function featureForAggregatedVector({ lng, lat, u, v }) {
  const speedKmh = speedKmhFromVector(u, v);
  const directionDegrees = directionDegreesFromVector(u, v);
  return {
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
  };
}

export function buildWindSymbolFeatures({
  grid,
  vectorUValues,
  vectorVValues,
  missingValue,
  bounds,
  zoom,
  sampling,
}) {
  if (!grid || !vectorUValues || !vectorVValues || !bounds) {
    return createFeatureCollection([]);
  }

  const features = [];
  const stride = matrixStrideForZoom(zoom, sampling);
  const northLat = Math.max(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const isStoN = grid.latitudeOfLastPoint > grid.latitudeOfFirstPoint;

  for (let rowFromNorth = 0; rowFromNorth < grid.nj; rowFromNorth += stride) {
    for (let col = 0; col < grid.ni; col += stride) {
      if (
        !blockFitsGrid(grid, rowFromNorth, col, stride) ||
        !blockFitsBounds(grid, bounds, rowFromNorth, col, stride, northLat)
      ) {
        continue;
      }

      const vector = aggregateVectorBlock({
        grid,
        vectorUValues,
        vectorVValues,
        missingValue,
        bounds,
        startRowFromNorth: rowFromNorth,
        startCol: col,
        stride,
        northLat,
        isStoN,
      });
      if (vector) features.push(featureForAggregatedVector(vector));
    }
  }

  return createFeatureCollection(features);
}
