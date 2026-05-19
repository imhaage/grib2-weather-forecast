import { contours } from "d3-contour";

import { applyUnitTransform, unitTransformFor } from "./unit-transforms.js";

const PRESSURE_VARIABLES = new Set(["p", "msl"]);
const DEFAULT_ISOBAR_INTERVAL_HPA = 5;
const DEFAULT_MAX_CONTOUR_GRID_WIDTH = 160;
const DEFAULT_SMOOTHING_PASSES = 2;

export function supportsIsobars(shortName) {
  return PRESSURE_VARIABLES.has(shortName);
}

function pressureValueFor(shortName, rawValue, missingValue) {
  if (rawValue <= missingValue) return NaN;
  const unitTransform = unitTransformFor(shortName);
  return applyUnitTransform(unitTransform, rawValue);
}

function isFinitePressure(value) {
  return Number.isFinite(value);
}

export function isobarThresholds(values, interval = DEFAULT_ISOBAR_INTERVAL_HPA) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!isFinitePressure(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];

  const start = Math.floor(min / interval) * interval + interval;
  const end = Math.ceil(max / interval) * interval - interval;
  const thresholds = [];
  for (let value = start; value <= end; value += interval) {
    thresholds.push(value);
  }
  return thresholds;
}

function generalizedGridFor(grid, maxGridWidth) {
  if (grid.ni <= maxGridWidth) return grid;
  const scale = maxGridWidth / grid.ni;
  const ni = Math.max(2, Math.round(grid.ni * scale));
  const nj = Math.max(2, Math.round(grid.nj * scale));
  return {
    ...grid,
    ni,
    nj,
    di: (grid.longitudeOfLastPoint - grid.longitudeOfFirstPoint) / (ni - 1),
    dj: Math.abs(grid.latitudeOfLastPoint - grid.latitudeOfFirstPoint) / (nj - 1),
  };
}

function meanPressureForCell(values, sourceGrid, colStart, colEnd, rowStart, rowEnd) {
  let sum = 0;
  let count = 0;
  for (let row = rowStart; row < rowEnd; row++) {
    const offset = row * sourceGrid.ni;
    for (let col = colStart; col < colEnd; col++) {
      const value = values[offset + col];
      if (!isFinitePressure(value)) continue;
      sum += value;
      count++;
    }
  }
  return count ? sum / count : NaN;
}

function downsamplePressureGrid(grid, values, targetGrid) {
  if (targetGrid.ni === grid.ni && targetGrid.nj === grid.nj) return Float32Array.from(values);

  const output = new Float32Array(targetGrid.ni * targetGrid.nj);
  for (let row = 0; row < targetGrid.nj; row++) {
    const rowStart = Math.floor((row * grid.nj) / targetGrid.nj);
    const rowEnd = Math.max(rowStart + 1, Math.ceil(((row + 1) * grid.nj) / targetGrid.nj));
    for (let col = 0; col < targetGrid.ni; col++) {
      const colStart = Math.floor((col * grid.ni) / targetGrid.ni);
      const colEnd = Math.max(colStart + 1, Math.ceil(((col + 1) * grid.ni) / targetGrid.ni));
      output[row * targetGrid.ni + col] = meanPressureForCell(
        values,
        grid,
        colStart,
        colEnd,
        rowStart,
        rowEnd,
      );
    }
  }
  return output;
}

function smoothedCellValue(values, grid, col, row) {
  let sum = 0;
  let count = 0;
  for (let y = Math.max(0, row - 1); y <= Math.min(grid.nj - 1, row + 1); y++) {
    const offset = y * grid.ni;
    for (let x = Math.max(0, col - 1); x <= Math.min(grid.ni - 1, col + 1); x++) {
      const value = values[offset + x];
      if (!isFinitePressure(value)) continue;
      sum += value;
      count++;
    }
  }
  return count ? sum / count : NaN;
}

function smoothPressureGrid(values, grid, passes) {
  let current = values;
  for (let pass = 0; pass < passes; pass++) {
    const next = new Float32Array(current.length);
    for (let row = 0; row < grid.nj; row++) {
      for (let col = 0; col < grid.ni; col++) {
        next[row * grid.ni + col] = smoothedCellValue(current, grid, col, row);
      }
    }
    current = next;
  }
  return current;
}

export function generalizePressureGrid({
  grid,
  pressureValues,
  maxGridWidth = DEFAULT_MAX_CONTOUR_GRID_WIDTH,
  smoothingPasses = DEFAULT_SMOOTHING_PASSES,
}) {
  const targetGrid = generalizedGridFor(grid, maxGridWidth);
  const downsampledValues = downsamplePressureGrid(grid, pressureValues, targetGrid);
  return {
    grid: targetGrid,
    values: smoothPressureGrid(downsampledValues, targetGrid, smoothingPasses),
  };
}

function contourPointToLonLat([x, y], grid) {
  const lonStep =
    grid.longitudeOfLastPoint >= grid.longitudeOfFirstPoint
      ? Math.abs(grid.di)
      : -Math.abs(grid.di);
  const latStep =
    grid.latitudeOfLastPoint >= grid.latitudeOfFirstPoint ? Math.abs(grid.dj) : -Math.abs(grid.dj);
  const col = Math.min(Math.max(x - 0.5, 0), grid.ni - 1);
  const row = Math.min(Math.max(y - 0.5, 0), grid.nj - 1);
  return [grid.longitudeOfFirstPoint + col * lonStep, grid.latitudeOfFirstPoint + row * latStep];
}

function isSameBoundarySegment(a, b, grid) {
  return (
    (a[0] === b[0] && (a[0] === 0 || a[0] === grid.ni)) ||
    (a[1] === b[1] && (a[1] === 0 || a[1] === grid.nj))
  );
}

function compactCoordinates(coordinates) {
  return coordinates.filter(
    (coordinate, index) =>
      index === 0 ||
      coordinate[0] !== coordinates[index - 1][0] ||
      coordinate[1] !== coordinates[index - 1][1],
  );
}

function featureForLine(contour, coordinates) {
  const compactedCoordinates = compactCoordinates(coordinates);
  if (compactedCoordinates.length < 2) return null;
  return {
    type: "Feature",
    properties: {
      value: contour.value,
      label: `${contour.value} hPa`,
    },
    geometry: {
      type: "LineString",
      coordinates: compactedCoordinates,
    },
  };
}

function ringToIsobarLineFeatures(contour, ring, grid) {
  const features = [];
  let currentLine = [];

  function flushLine() {
    if (currentLine.length >= 2) {
      const feature = featureForLine(contour, currentLine);
      if (feature) features.push(feature);
    }
    currentLine = [];
  }

  for (let index = 1; index < ring.length; index++) {
    const previous = ring[index - 1];
    const point = ring[index];
    if (isSameBoundarySegment(previous, point, grid)) {
      flushLine();
      continue;
    }
    const previousLonLat = contourPointToLonLat(previous, grid);
    const pointLonLat = contourPointToLonLat(point, grid);
    if (currentLine.length === 0) currentLine.push(previousLonLat);
    currentLine.push(pointLonLat);
  }
  flushLine();
  return features;
}

function contourGeometryToLineFeatures(contour, grid) {
  const features = [];
  for (const polygon of contour.coordinates) {
    for (const ring of polygon) {
      features.push(...ringToIsobarLineFeatures(contour, ring, grid));
    }
  }
  return features;
}

export function generateIsobars({
  shortName,
  grid,
  values,
  interval = DEFAULT_ISOBAR_INTERVAL_HPA,
  missingValue = -Infinity,
  maxGridWidth = DEFAULT_MAX_CONTOUR_GRID_WIDTH,
  smoothingPasses = DEFAULT_SMOOTHING_PASSES,
}) {
  if (!supportsIsobars(shortName) || !values?.length) {
    return { type: "FeatureCollection", features: [] };
  }

  const pressureValues = Array.from(values, (value) =>
    pressureValueFor(shortName, value, missingValue),
  );
  const generalized = generalizePressureGrid({
    grid,
    pressureValues,
    maxGridWidth,
    smoothingPasses,
  });
  const thresholds = isobarThresholds(generalized.values, interval);
  const features = contours()
    .size([generalized.grid.ni, generalized.grid.nj])
    .thresholds(thresholds)(generalized.values)
    .flatMap((contour) => contourGeometryToLineFeatures(contour, generalized.grid));

  return {
    type: "FeatureCollection",
    features,
  };
}
