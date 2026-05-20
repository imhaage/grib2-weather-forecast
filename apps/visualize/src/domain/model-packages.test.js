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
});
