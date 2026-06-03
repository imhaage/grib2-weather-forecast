const WIND_LEVELS = Object.freeze([10, 20, 50, 100]);
const WIND_COMPOSITE_PATTERN = /^wind_(\d+)$/;

export function isWindCompositeVariable(variableKey) {
  return WIND_COMPOSITE_PATTERN.test(variableKey);
}

export function windCompositeLevelFor(variableKey) {
  const match = WIND_COMPOSITE_PATTERN.exec(variableKey);
  return match ? Number(match[1]) : null;
}

export function componentVariableKeyForWind(variableKey, component) {
  const level = windCompositeLevelFor(variableKey);
  if (level == null) return null;
  if (component === "speed") return `wspd_${level}`;
  if (component === "direction") return `wdir_${level}`;
  return null;
}

export function windCompositeVariableForLevel(level) {
  return {
    shortName: "wind",
    varKey: `wind_${level}`,
    levelValue: level,
    name: `Wind (${level}m)`,
    level: `${level} m above ground`,
    units: "km/h",
    group: "Weather maps",
  };
}

export function windCompositeVariablesForLevels(levels = WIND_LEVELS) {
  return levels.map((level) => windCompositeVariableForLevel(level));
}
