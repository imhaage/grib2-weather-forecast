const UNIT_TRANSFORMS = Object.freeze({
  t: {
    displayUnits: "°C",
    apply: (value) => value - 273.15,
  },
  wspd: {
    displayUnits: "km/h",
    apply: (value) => value * 3.6,
  },
  p: {
    displayUnits: "hPa",
    apply: (value) => value / 100,
  },
  msl: {
    displayUnits: "hPa",
    apply: (value) => value / 100,
  },
  tcc: {
    displayUnits: "%",
    apply: (value) => value * 100,
  },
});

export function unitTransformFor(shortName) {
  return Object.hasOwn(UNIT_TRANSFORMS, shortName) ? shortName : null;
}

export function displayUnitsFor(shortName, rawUnits) {
  return UNIT_TRANSFORMS[shortName]?.displayUnits ?? rawUnits;
}

export function applyUnitTransform(unitTransform, value) {
  return UNIT_TRANSFORMS[unitTransform]?.apply(value) ?? value;
}

export function unitFnFor(unitTransform) {
  return UNIT_TRANSFORMS[unitTransform]?.apply ?? null;
}

export function formatValueForUnits(value, units, decimals = 2) {
  return value.toFixed(units === "hPa" ? 0 : decimals);
}
