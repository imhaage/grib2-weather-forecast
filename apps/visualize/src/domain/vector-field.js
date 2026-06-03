import { normalizeDegrees } from "./wind-direction-format.js";

const MS_TO_KMH = 3.6;

function hasVectorComponent(value, missingValue) {
  return Number.isFinite(value) && value > missingValue;
}

export function deriveVectorSpeedValues({ uValues, vValues, missingValue }) {
  const length = Math.min(uValues.length, vValues.length);
  const values = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    const u = uValues[index];
    const v = vValues[index];
    values[index] =
      hasVectorComponent(u, missingValue) && hasVectorComponent(v, missingValue)
        ? speedKmhFromVector(u, v)
        : missingValue;
  }

  return values;
}

export function speedKmhFromVector(u, v) {
  return Math.hypot(u, v) * MS_TO_KMH;
}

export function directionDegreesFromVector(u, v) {
  return normalizeDegrees((Math.atan2(-u, -v) * 180) / Math.PI);
}

export function hasUsableVectorComponent(value, missingValue) {
  return hasVectorComponent(value, missingValue);
}
