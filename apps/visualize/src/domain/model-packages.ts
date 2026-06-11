import type { ForecastPackage, ForecastVariable } from "./forecast-types";
import { variableKeyFor } from "./variable-metadata.js";
import { vectorCompositeVariablesFor } from "./wind-composite-variable.js";

const WIND_LEVELS = Object.freeze([10, 20, 50, 100]);

interface LevelVariableConfig {
  shortName: string;
  varKeyPrefix: string;
  nameForLevel: (level: number) => string;
  units: string;
  group: string;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

function levelVariable({
  shortName,
  varKeyPrefix,
  level,
  nameForLevel,
  units,
  group,
}: LevelVariableConfig & { level: number }): ForecastVariable {
  return {
    shortName,
    varKey: `${varKeyPrefix}_${level}`,
    levelValue: level,
    name: nameForLevel(level),
    level: `${level} m above ground`,
    units,
    group,
  };
}

function levelVariables(config: LevelVariableConfig): ForecastVariable[] {
  return WIND_LEVELS.map((level) => levelVariable({ ...config, level }));
}

export const PACKAGES: Readonly<Record<string, ForecastPackage>> = {
  AROME_SP1: {
    model: "AROME",
    label: "AROME SP1 0.01°",
    provider: "data-gouv",
    datasetId: "65bd1247a6238f16e864fa80",
    titlePattern: "__SP1__",
    skipHour0: true,
    bounds: [
      [-12, 37.5],
      [16, 55.4],
    ],
    variables: [
      {
        shortName: "t",
        name: "Temperature (2m)",
        units: "°C",
        level: "2 m above ground",
        group: "Weather maps",
      },
      {
        shortName: "r",
        name: "Relative humidity (2m)",
        units: "%",
        level: "2 m above ground",
        group: "Weather maps",
      },
      ...vectorCompositeVariablesFor(["wind", "gust"]).filter(isDefined),
      {
        shortName: "u",
        name: "U (wind, 10m)",
        units: "m s-1",
        level: "10 m above ground",
        group: "Component fields",
      },
      {
        shortName: "v",
        name: "V (wind, 10m)",
        units: "m s-1",
        level: "10 m above ground",
        group: "Component fields",
      },
      {
        shortName: "ugust",
        name: "U (wind gust, 10m)",
        units: "m s-1",
        level: "10 m above ground",
        group: "Component fields",
      },
      {
        shortName: "vgust",
        name: "V (wind gust, 10m)",
        units: "m s-1",
        level: "10 m above ground",
        group: "Component fields",
      },
    ],
  },
  AROME_SP2: {
    model: "AROME",
    label: "AROME SP2 0.01°",
    provider: "data-gouv",
    datasetId: "65bd1247a6238f16e864fa80",
    titlePattern: "__SP2__",
    skipHour0: true,
    bounds: [
      [-12, 37.5],
      [16, 55.4],
    ],
    variables: [
      {
        shortName: "p",
        name: "Pressure (model surface)",
        units: "hPa",
        level: "Ground surface",
        group: "Component fields",
      },
      {
        shortName: "cape",
        name: "CAPE (near-surface)",
        units: "J kg-1",
        level: "Near-surface",
        group: "Weather maps",
      },
      {
        shortName: "lcc",
        name: "Low cloud cover (<2.5km)",
        units: "%",
        level: "Ground surface",
        group: "Weather maps",
      },
      {
        shortName: "mcc",
        name: "Medium cloud cover (2.5-5km)",
        units: "%",
        level: "Ground surface",
        group: "Weather maps",
      },
      {
        shortName: "hcc",
        name: "High cloud cover (>5km)",
        units: "%",
        level: "Ground surface",
        group: "Weather maps",
      },
      {
        shortName: "tgrp",
        name: "Graupel precipitation (surface rate)",
        units: "mm/h",
        level: "Ground surface",
        group: "Weather maps",
      },
      {
        shortName: "rrate",
        name: "Rain precipitation (surface rate)",
        units: "mm/h",
        level: "Ground surface",
        group: "Weather maps",
      },
      {
        shortName: "srate",
        name: "Snow precipitation (surface rate)",
        units: "mm/h",
        level: "Ground surface",
        group: "Weather maps",
      },
    ],
  },
  AROME_HP1: {
    model: "AROME",
    label: "AROME HP1 0.01°",
    provider: "data-gouv",
    datasetId: "65bd1247a6238f16e864fa80",
    titlePattern: "__HP1__",
    skipHour0: true,
    bounds: [
      [-12, 37.5],
      [16, 55.4],
    ],
    homeVariableGroups: [
      {
        group: "Weather maps",
        names: ["Relative humidity (10m, 20m, 50m, 100m)"],
      },
      {
        group: "Component fields",
        names: [
          "Wind speed (10m, 20m, 50m, 100m)",
          "Wind direction (10m, 20m, 50m, 100m)",
          "U (wind, 10m, 20m, 50m, 100m)",
          "V (wind, 10m, 20m, 50m, 100m)",
        ],
      },
    ],
    variables: [
      ...levelVariables({
        shortName: "r",
        varKeyPrefix: "r",
        nameForLevel: (level) => `Relative humidity (${level}m)`,
        units: "%",
        group: "Weather maps",
      }),
      ...levelVariables({
        shortName: "wspd",
        varKeyPrefix: "wspd",
        nameForLevel: (level) => `Wind speed (${level}m)`,
        units: "km/h",
        group: "Component fields",
      }),
      ...levelVariables({
        shortName: "wdir",
        varKeyPrefix: "wdir",
        nameForLevel: (level) => `Wind direction (${level}m)`,
        units: "°",
        group: "Component fields",
      }),
      ...levelVariables({
        shortName: "u",
        varKeyPrefix: "u",
        nameForLevel: (level) => `U (wind, ${level}m)`,
        units: "m s-1",
        group: "Component fields",
      }),
      ...levelVariables({
        shortName: "v",
        varKeyPrefix: "v",
        nameForLevel: (level) => `V (wind, ${level}m)`,
        units: "m s-1",
        group: "Component fields",
      }),
    ],
  },
  ARPEGE_SP1: {
    model: "ARPEGE",
    label: "ARPEGE SP1 0.1°",
    provider: "data-gouv",
    datasetId: "65bd13b2eb9e79ab309f6e63",
    titlePattern: "__SP1__",
    bounds: [
      [-32, 20],
      [42, 72],
    ],
    variables: [
      {
        shortName: "t",
        name: "Temperature (2m)",
        units: "°C",
        level: "2 m above ground",
        group: "Weather maps",
      },
      {
        shortName: "r",
        name: "Relative humidity (2m)",
        units: "%",
        level: "2 m above ground",
        group: "Weather maps",
      },
      {
        shortName: "u",
        name: "U (wind, 10m)",
        units: "m s-1",
        level: "10 m above ground",
        group: "Component fields",
      },
      {
        shortName: "v",
        name: "V (wind, 10m)",
        units: "m s-1",
        level: "10 m above ground",
        group: "Component fields",
      },
      {
        shortName: "msl",
        name: "Pressure (mean sea-level)",
        units: "hPa",
        level: "Mean sea level",
        group: "Weather maps",
      },
      {
        shortName: "tcc",
        name: "Total cloud cover (column)",
        units: "%",
        level: "Atmospheric column",
        group: "Weather maps",
      },
      {
        shortName: "wspd",
        name: "Wind speed (10m)",
        units: "km/h",
        level: "10 m above ground",
        group: "Weather maps",
      },
      {
        shortName: "wdir",
        name: "Wind direction (10m)",
        units: "°",
        level: "10 m above ground",
        group: "Weather maps",
      },
    ],
  },
};

export const MODEL_INFO = {
  AROME: {
    title: "AROME 0.01",
    description: "High-resolution, limited-area French atmospheric model.",
    resolution: "0.01° (~1 km)",
    boundingBox: "12°W – 16°E · 37.5°N – 55.4°N",
    coverage: "Mainland France and Corsica (EURW1S100)",
    horizon: "H+01 to H+51",
    filesInfo: "1 hour per file (51 files)",
  },
  ARPEGE: {
    title: "ARPEGE 0.1",
    description: "French global atmospheric forecast model.",
    resolution: "0.1° (~11 km)",
    boundingBox: "32°W – 42°E · 20°N – 72°N",
    coverage: "Europe, North Africa, the northeast Atlantic, and the Middle East (EURAT01)",
    horizon: "H+000 to H+102",
    filesInfo: "12 hours per file (9 files)",
  },
};

export function findPackageVariable(
  packageKey: string | null | undefined,
  key: string | null | undefined,
) {
  if (!packageKey) {
    return undefined;
  }

  return PACKAGES[packageKey]?.variables.find((v) => variableKeyFor(v) === key);
}
