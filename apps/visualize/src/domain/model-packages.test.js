import { describe, expect, test } from "vitest";
import { PACKAGES } from "./model-packages.js";

describe("model packages", () => {
  test("groups AROME SP1 variables by map readability", () => {
    expect(PACKAGES.AROME_SP1.variables.map(({ name, group }) => ({ name, group }))).toEqual([
      { name: "Temperature (2m)", group: "Weather maps" },
      { name: "Relative humidity (2m)", group: "Weather maps" },
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
    expect(PACKAGES.AROME_HP1.variables.map(({ name, group }) => ({ name, group }))).toEqual([
      { name: "Wind speed (10m)", group: "Weather maps" },
      { name: "Wind speed (20m)", group: "Weather maps" },
      { name: "Wind speed (50m)", group: "Weather maps" },
      { name: "Wind speed (100m)", group: "Weather maps" },
      { name: "Wind direction (10m)", group: "Weather maps" },
      { name: "Wind direction (20m)", group: "Weather maps" },
      { name: "Wind direction (50m)", group: "Weather maps" },
      { name: "Wind direction (100m)", group: "Weather maps" },
      { name: "Relative humidity (10m)", group: "Weather maps" },
      { name: "Relative humidity (20m)", group: "Weather maps" },
      { name: "Relative humidity (50m)", group: "Weather maps" },
      { name: "Relative humidity (100m)", group: "Weather maps" },
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
});
