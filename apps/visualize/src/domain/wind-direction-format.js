const CARDINAL_DIRECTIONS = Object.freeze([
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
]);

export function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

export function cardinalDirectionForDegrees(degrees) {
  const normalized = normalizeDegrees(degrees);
  const index = Math.round(normalized / 22.5) % CARDINAL_DIRECTIONS.length;

  return CARDINAL_DIRECTIONS[index];
}
