const WIND_LEVELS = Object.freeze([10, 20, 50, 100]);
const WIND_COMPOSITE_PATTERN = /^wind_(\d+)$/;

const VECTOR_COMPOSITES = Object.freeze({
  wind: Object.freeze({
    shortName: "wind",
    name: "Wind (10m)",
    uComponent: "u",
    vComponent: "v",
  }),
  gust: Object.freeze({
    shortName: "gust",
    name: "Wind gust (10m)",
    uComponent: "ugust",
    vComponent: "vgust",
  }),
});

export function isVectorCompositeVariable(variableKey) {
  return Object.hasOwn(VECTOR_COMPOSITES, variableKey);
}

export function componentVariableKeyForVector(variableKey, component) {
  const composite = VECTOR_COMPOSITES[variableKey];
  if (!composite) return null;
  if (component === "u") return composite.uComponent;
  if (component === "v") return composite.vComponent;
  return null;
}

export function vectorCompositeVariableFor(variableKey) {
  const composite = VECTOR_COMPOSITES[variableKey];
  if (!composite) return null;
  return {
    shortName: composite.shortName,
    name: composite.name,
    level: "10 m above ground",
    units: "km/h",
    group: "Weather maps",
  };
}

export function vectorCompositeVariablesFor(keys = Object.keys(VECTOR_COMPOSITES)) {
  return keys.map((key) => vectorCompositeVariableFor(key)).filter(Boolean);
}

export function isWindCompositeVariable(variableKey) {
  return isVectorCompositeVariable(variableKey) || WIND_COMPOSITE_PATTERN.test(variableKey);
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
