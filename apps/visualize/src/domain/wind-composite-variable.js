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

  if (!composite) {
    return null;
  }

  if (component === "u") {
    return composite.uComponent;
  }

  if (component === "v") {
    return composite.vComponent;
  }

  return null;
}

export function vectorCompositeVariableFor(variableKey) {
  const composite = VECTOR_COMPOSITES[variableKey];

  if (!composite) {
    return null;
  }

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
