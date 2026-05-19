import { describe, expect, test } from "vitest";
import { PACKAGES } from "./model-packages.js";

describe("model packages", () => {
  test("groups AROME SP1 variables by map readability", () => {
    expect(PACKAGES.AROME_SP1.variables.map(({ name, group }) => ({ name, group }))).toEqual([
      { name: "Temperature", group: "Weather maps" },
      { name: "Relative humidity", group: "Weather maps" },
      { name: "U-component of wind", group: "Model fields" },
      { name: "V-component of wind", group: "Model fields" },
      { name: "U-component of wind (gust)", group: "Model fields" },
      { name: "V-component of wind (gust)", group: "Model fields" },
    ]);
  });

  test("groups AROME SP2 variables by direct weather-map value", () => {
    expect(PACKAGES.AROME_SP2.variables.map(({ name, group }) => ({ name, group }))).toEqual([
      { name: "Pressure", group: "Model fields" },
      { name: "Convective available potential energy", group: "Weather maps" },
      { name: "Low cloud cover", group: "Weather maps" },
      { name: "Medium cloud cover", group: "Weather maps" },
      { name: "High cloud cover", group: "Weather maps" },
      { name: "Graupel (snow pellets) precipitation", group: "Weather maps" },
      { name: "Rain precipitation", group: "Weather maps" },
      { name: "Snow precipitation", group: "Weather maps" },
    ]);
  });
});
