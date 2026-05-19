// @ts-check

/** @typedef {import("./types").VariableKeySource} VariableKeySource */
/** @typedef {import("./types").VariableMetadata} VariableMetadata */

const PRESSURE_METADATA = Object.freeze({
  defaultPalette: "Plasma",
  staticScale: { min: 950, max: 1050 },
});

/** @type {Readonly<Record<string, VariableMetadata>>} */
export const VARIABLE_METADATA = Object.freeze({
  t: {
    description:
      "Air temperature measured 2m above ground. The standard reference for what people feel outdoors. Key for assessing frost risk, heatwaves, and thermal comfort.",
    defaultPalette: "TempC",
    staticScale: { min: -25, max: 50 },
  },
  r: {
    description:
      "Moisture content of the air relative to its saturation point, at 2m above ground. Values above 80% indicate damp, foggy, or precipitation-prone conditions. Below 30%, the air is dry - increasing wildfire risk and discomfort.",
    defaultPalette: "Blues",
    staticScale: { min: 0, max: 100 },
  },
  u: {
    description:
      "East-west component of wind speed at 10m above ground. Positive = blowing eastward, negative = blowing westward. Combined with the V component, you can derive actual wind speed and direction.",
    defaultPalette: "Viridis",
    staticScale: { min: -30, max: 30 },
  },
  v: {
    description:
      "North-south component of wind speed at 10m above ground. Positive = blowing northward, negative = southward. Combined with the U component, you can derive actual wind speed and direction.",
    defaultPalette: "Viridis",
    staticScale: { min: -30, max: 30 },
  },
  ugust: {
    description:
      "East-west component of the maximum wind gust at 10m. Gusts are brief, intense bursts significantly stronger than the average wind. Combined with vgust, reveals the direction and peak intensity - critical for storm safety assessments.",
    defaultPalette: "Viridis",
    staticScale: { min: 0, max: 40 },
  },
  vgust: {
    description:
      "North-south component of the maximum wind gust at 10m. Combined with ugust, reveals the direction and peak intensity - critical for storm safety assessments.",
    defaultPalette: "Viridis",
    staticScale: { min: 0, max: 40 },
  },
  p: {
    description:
      "Atmospheric pressure at ground level, in hPa. High pressure (>1013 hPa) is typically associated with fair weather; low pressure signals approaching fronts or storms. Useful for tracking large-scale weather systems.",
    ...PRESSURE_METADATA,
  },
  cape: {
    description:
      "A measure of the atmosphere's fuel for thunderstorm development. Values above 500 J/kg suggest moderate storm potential; above 2500 J/kg, severe weather with large hail and strong winds becomes likely.",
    defaultPalette: "Spectral",
    staticScale: { min: 0, max: 4000 },
  },
  lcc: {
    description:
      "Fraction of the sky covered by low-altitude clouds (below ~2km), such as stratus and fog layers. Directly affects visibility, sunlight at ground level, and daytime heating.",
    defaultPalette: "Viridis",
    staticScale: { min: 0, max: 100, zeroThreshold: 0.005 },
  },
  mcc: {
    description:
      "Fraction of the sky covered by mid-level clouds (~2-6km), often associated with frontal systems and stratiform precipitation.",
    defaultPalette: "Viridis",
    staticScale: { min: 0, max: 100, zeroThreshold: 0.005 },
  },
  hcc: {
    description:
      "Fraction of the sky covered by high-altitude clouds (above ~6km), such as cirrus. These thin ice clouds rarely produce rain directly but can indicate an approaching weather system.",
    defaultPalette: "Viridis",
    staticScale: { min: 0, max: 100, zeroThreshold: 0.005 },
  },
  tgrp: {
    description:
      "Rate of falling graupel (soft hail / snow pellets), in mm/h. Graupel forms inside convective clouds and is often a precursor to larger hail or intense thunderstorms.",
    defaultPalette: "Spectral",
    staticScale: { min: 0, max: 15, log: true, zeroThreshold: 0.005 },
  },
  rrate: {
    description:
      "Intensity of liquid precipitation at a given moment, in mm/h. Below 1 mm/h is light rain; 1-10 mm/h is moderate; above 10 mm/h is heavy. Key for flash flood risk and outdoor planning.",
    defaultPalette: "Spectral",
    staticScale: { min: 0, max: 150, log: true, zeroThreshold: 0.005 },
  },
  srate: {
    description:
      "Intensity of snowfall (liquid equivalent), in mm/h. Even modest values can rapidly create dangerous road conditions and reduce visibility, especially at temperatures well below 0°C.",
    defaultPalette: "Spectral",
    staticScale: { min: 0, max: 20, log: true, zeroThreshold: 0.005 },
  },
  msl: {
    ...PRESSURE_METADATA,
  },
  tcc: {
    defaultPalette: "Viridis",
    staticScale: { min: 0, max: 100, zeroThreshold: 0.005 },
  },
  wspd: {
    defaultPalette: "Spectral",
    staticScale: { min: 0, max: 200 },
  },
  wspd_10: {
    defaultPalette: "Plasma",
  },
  wspd_20: {
    defaultPalette: "Plasma",
  },
  wspd_50: {
    defaultPalette: "Plasma",
  },
  wspd_100: {
    defaultPalette: "Plasma",
  },
  wdir: {
    defaultPalette: "Plasma",
    staticScale: { min: 0, max: 360 },
  },
});

/**
 * @param {VariableKeySource} varDef
 */
export function variableKeyFor(varDef) {
  return varDef.varKey ?? varDef.shortName;
}

/**
 * @param {string} shortName
 */
export function variableMetadataFor(shortName) {
  return VARIABLE_METADATA[shortName] ?? {};
}

/**
 * @param {string} shortName
 */
export function parameterDescriptionFor(shortName) {
  return variableMetadataFor(shortName).description ?? "";
}

/**
 * @param {string} shortName
 */
export function defaultPaletteFor(shortName) {
  return variableMetadataFor(shortName).defaultPalette ?? null;
}

/**
 * @param {string} shortName
 */
export function staticScaleFor(shortName) {
  return variableMetadataFor(shortName).staticScale ?? null;
}
