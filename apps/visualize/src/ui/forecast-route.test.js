import { describe, expect, test } from "vitest";
import { createForecastPackageHash, parseForecastRoute } from "./forecast-route.js";

describe("forecast route", () => {
  test("parses uploaded grid routes", () => {
    expect(parseForecastRoute("#grid/Temperature%20(2m)")).toEqual({
      type: "grid",
      variableShortName: "Temperature (2m)",
    });
  });

  test("parses forecast package routes and legacy arome routes", () => {
    expect(parseForecastRoute("#forecast/AROME_SP1")).toEqual({
      type: "forecast",
      packageKey: "AROME_SP1",
    });
    expect(parseForecastRoute("#arome/ARPEGE_SP1")).toEqual({
      type: "forecast",
      packageKey: "ARPEGE_SP1",
    });
  });

  test("falls back to home for unknown hashes", () => {
    expect(parseForecastRoute("")).toEqual({ type: "home" });
    expect(parseForecastRoute("#unknown")).toEqual({ type: "home" });
  });

  test("creates canonical forecast package hashes", () => {
    expect(createForecastPackageHash("AROME_SP2")).toBe("#forecast/AROME_SP2");
  });
});
