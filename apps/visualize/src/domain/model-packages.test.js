import { describe, expect, test } from "vitest";
import { MODEL_INFO, PACKAGES } from "./model-packages.js";

describe("model packages", () => {
  test("exposes verified model descriptions and coverage metadata", () => {
    expect(MODEL_INFO.AROME).toMatchObject({
      title: "AROME 0.01",
      description: "High-resolution, limited-area French atmospheric model.",
      boundingBox: "12°W – 16°E · 37.5°N – 55.4°N",
      coverage: "Mainland France and Corsica (EURW1S100)",
    });
    expect(MODEL_INFO.ARPEGE).toMatchObject({
      title: "ARPEGE 0.1",
      description: "French global atmospheric forecast model.",
      boundingBox: "32°W – 42°E · 20°N – 72°N",
      coverage: "Europe, North Africa, the northeast Atlantic, and the Middle East (EURAT01)",
    });
  });

  test("groups AROME SP1 variables by map readability", () => {
    expect(PACKAGES.AROME_SP1.variables.map(({ name, group }) => ({ name, group }))).toEqual([
      { name: "Temperature (2m)", group: "Weather maps" },
      { name: "Relative humidity (2m)", group: "Weather maps" },
      { name: "Wind (10m)", group: "Weather maps" },
      { name: "Wind gust (10m)", group: "Weather maps" },
      { name: "U (wind, 10m)", group: "Component fields" },
      { name: "V (wind, 10m)", group: "Component fields" },
      { name: "U (wind gust, 10m)", group: "Component fields" },
      { name: "V (wind gust, 10m)", group: "Component fields" },
    ]);
  });

  test("groups AROME SP2 variables by direct weather-map value", () => {
    expect(PACKAGES.AROME_SP2.variables.map(({ name, group }) => ({ name, group }))).toEqual([
      { name: "Pressure (model surface)", group: "Component fields" },
      { name: "CAPE (near-surface)", group: "Weather maps" },
      { name: "Low cloud cover (<2.5km)", group: "Weather maps" },
      { name: "Medium cloud cover (2.5-5km)", group: "Weather maps" },
      { name: "High cloud cover (>5km)", group: "Weather maps" },
      { name: "Graupel precipitation (surface rate)", group: "Weather maps" },
      { name: "Rain precipitation (surface rate)", group: "Weather maps" },
      { name: "Snow precipitation (surface rate)", group: "Weather maps" },
    ]);
  });

  test("exposes verified AROME HP1 height-level variables", () => {
    expect(PACKAGES.AROME_HP1.homeVariableGroups).toEqual([
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
    ]);

    expect(PACKAGES.AROME_HP1.variables.map(({ name, group }) => ({ name, group }))).toEqual([
      { name: "Relative humidity (10m)", group: "Weather maps" },
      { name: "Relative humidity (20m)", group: "Weather maps" },
      { name: "Relative humidity (50m)", group: "Weather maps" },
      { name: "Relative humidity (100m)", group: "Weather maps" },
      { name: "Wind speed (10m)", group: "Component fields" },
      { name: "Wind speed (20m)", group: "Component fields" },
      { name: "Wind speed (50m)", group: "Component fields" },
      { name: "Wind speed (100m)", group: "Component fields" },
      { name: "Wind direction (10m)", group: "Component fields" },
      { name: "Wind direction (20m)", group: "Component fields" },
      { name: "Wind direction (50m)", group: "Component fields" },
      { name: "Wind direction (100m)", group: "Component fields" },
      { name: "U (wind, 10m)", group: "Component fields" },
      { name: "U (wind, 20m)", group: "Component fields" },
      { name: "U (wind, 50m)", group: "Component fields" },
      { name: "U (wind, 100m)", group: "Component fields" },
      { name: "V (wind, 10m)", group: "Component fields" },
      { name: "V (wind, 20m)", group: "Component fields" },
      { name: "V (wind, 50m)", group: "Component fields" },
      { name: "V (wind, 100m)", group: "Component fields" },
    ]);
  });

  test("groups verified ARPEGE SP1 variables by direct weather-map value", () => {
    expect(PACKAGES.ARPEGE_SP1.variables.map(({ name, group }) => ({ name, group }))).toEqual([
      { name: "Temperature (2m)", group: "Weather maps" },
      { name: "Relative humidity (2m)", group: "Weather maps" },
      { name: "U (wind, 10m)", group: "Component fields" },
      { name: "V (wind, 10m)", group: "Component fields" },
      { name: "Pressure (mean sea-level)", group: "Weather maps" },
      { name: "Total cloud cover (column)", group: "Weather maps" },
      { name: "Wind speed (10m)", group: "Weather maps" },
      { name: "Wind direction (10m)", group: "Weather maps" },
    ]);
  });
});
