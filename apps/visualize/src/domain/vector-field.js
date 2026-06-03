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
        ? Math.hypot(u, v) * MS_TO_KMH
        : missingValue;
  }

  return values;
}
