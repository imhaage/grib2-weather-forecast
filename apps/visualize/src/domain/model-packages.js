import { variableKeyFor } from "./variable-metadata.js";

export const PACKAGES = {
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
        name: "Temperature",
        units: "°C",
        level: "2 m above ground",
      },
      {
        shortName: "r",
        name: "Relative humidity",
        units: "%",
        level: "2 m above ground",
      },
      {
        shortName: "u",
        name: "U-component of wind",
        units: "m s-1",
        level: "10 m above ground",
      },
      {
        shortName: "v",
        name: "V-component of wind",
        units: "m s-1",
        level: "10 m above ground",
      },
      {
        shortName: "ugust",
        name: "U-component of wind (gust)",
        units: "m s-1",
        level: "10 m above ground",
      },
      {
        shortName: "vgust",
        name: "V-component of wind (gust)",
        units: "m s-1",
        level: "10 m above ground",
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
        name: "Pressure",
        units: "hPa",
        level: "Ground surface",
      },
      {
        shortName: "cape",
        name: "Convective available potential energy",
        units: "J kg-1",
        level: "Ground surface",
      },
      {
        shortName: "lcc",
        name: "Low cloud cover",
        units: "%",
        level: "Ground surface",
      },
      {
        shortName: "mcc",
        name: "Medium cloud cover",
        units: "%",
        level: "Ground surface",
      },
      {
        shortName: "hcc",
        name: "High cloud cover",
        units: "%",
        level: "Ground surface",
      },
      {
        shortName: "tgrp",
        name: "Graupel (snow pellets) precipitation",
        units: "mm/h",
        level: "Ground surface",
      },
      {
        shortName: "rrate",
        name: "Rain precipitation",
        units: "mm/h",
        level: "Ground surface",
      },
      {
        shortName: "srate",
        name: "Snow precipitation",
        units: "mm/h",
        level: "Ground surface",
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
    variables: [
      {
        shortName: "wspd",
        varKey: "wspd_10",
        levelValue: 10,
        name: "Wind speed",
        level: "10 m above ground",
        units: "km/h",
      },
      {
        shortName: "wspd",
        varKey: "wspd_20",
        levelValue: 20,
        name: "Wind speed",
        level: "20 m above ground",
        units: "km/h",
      },
      {
        shortName: "wspd",
        varKey: "wspd_50",
        levelValue: 50,
        name: "Wind speed",
        level: "50 m above ground",
        units: "km/h",
      },
      {
        shortName: "wdir",
        varKey: "wdir_10",
        levelValue: 10,
        name: "Wind direction",
        level: "10 m above ground",
        units: "°",
      },
      {
        shortName: "wdir",
        varKey: "wdir_20",
        levelValue: 20,
        name: "Wind direction",
        level: "20 m above ground",
        units: "°",
      },
      {
        shortName: "wdir",
        varKey: "wdir_50",
        levelValue: 50,
        name: "Wind direction",
        level: "50 m above ground",
        units: "°",
      },
      {
        shortName: "wdir",
        varKey: "wdir_100",
        levelValue: 100,
        name: "Wind direction",
        level: "100 m above ground",
        units: "°",
      },
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
        name: "Temperature",
        units: "°C",
        level: "2 m above ground",
      },
      {
        shortName: "r",
        name: "Relative humidity",
        units: "%",
        level: "2 m above ground",
      },
      {
        shortName: "u",
        name: "U-component of wind",
        units: "m s-1",
        level: "10 m above ground",
      },
      {
        shortName: "v",
        name: "V-component of wind",
        units: "m s-1",
        level: "10 m above ground",
      },
      {
        shortName: "msl",
        name: "Pressure reduced to MSL",
        units: "hPa",
        level: "Mean sea level",
      },
      {
        shortName: "tcc",
        name: "Total cloud cover",
        units: "%",
        level: "Ground surface",
      },
      {
        shortName: "wspd",
        name: "Wind speed",
        units: "km/h",
        level: "10 m above ground",
      },
      {
        shortName: "wdir",
        name: "Wind direction",
        units: "°",
        level: "10 m above ground",
      },
    ],
  },
};

export const MODEL_INFO = {
  AROME: {
    description:
      "High-resolution model from Météo-France, covering metropolitan France and its Atlantic, English Channel, and Mediterranean seaboards.",
    resolution: "0.01° (~1 km)",
    domain: "12°W – 16°E · 37°N – 55°N",
    domainDesc:
      "Metropolitan France and its Atlantic, English Channel, and Mediterranean seaboards",
    horizon: "H+01 to H+51",
    filesInfo: "1 hour per file (51 files)",
  },
  ARPEGE: {
    description:
      "Limited-area model from Météo-France covering Europe, the northeast Atlantic, and the Middle East.",
    resolution: "0.1° (~11 km)",
    domain: "32°W – 42°E · 20°N – 72°N",
    domainDesc: "Western to central Europe, from the Sahara to the Norwegian Sea",
    horizon: "H+000 to H+102",
    filesInfo: "12 hours per file (9 files)",
  },
};

export function findPackageVariable(packageKey, key) {
  return PACKAGES[packageKey]?.variables.find((v) => variableKeyFor(v) === key) ?? null;
}
