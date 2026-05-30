import { describe, expect, test } from "vitest";
import {
  createForecastHomeHash,
  createForecastPackageHash,
  createInspectHomeHash,
  createInspectVariableHash,
  parseForecastRoute,
} from "./forecast-route.js";

describe("forecast route", () => {
  test("parses canonical home tab routes", () => {
    expect(parseForecastRoute("#forecast")).toEqual({
      type: "home",
      tab: "model",
    });
    expect(parseForecastRoute("#inspect")).toEqual({
      type: "home",
      tab: "upload",
    });
  });

  test("redirects empty hash to the forecast home tab", () => {
    expect(parseForecastRoute("")).toEqual({
      type: "home",
      tab: "model",
      canonicalHash: "#forecast",
    });
  });

  test("parses uploaded file inspection routes", () => {
    expect(parseForecastRoute("#inspect/Temperature%20(2m)")).toEqual({
      type: "inspect",
      variableShortName: "Temperature (2m)",
    });
  });

  test("parses legacy uploaded grid routes as inspections", () => {
    expect(parseForecastRoute("#grid/Temperature%20(2m)")).toEqual({
      type: "inspect",
      variableShortName: "Temperature (2m)",
      canonicalHash: "#inspect/Temperature%20(2m)",
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
      canonicalHash: "#forecast/ARPEGE_SP1",
    });
  });

  test("falls back to home for unknown hashes", () => {
    expect(parseForecastRoute("#unknown")).toEqual({
      type: "home",
      tab: "model",
      canonicalHash: "#forecast",
    });
  });

  test("creates canonical forecast package hashes", () => {
    expect(createForecastHomeHash()).toBe("#forecast");
    expect(createForecastPackageHash("AROME_SP2")).toBe("#forecast/AROME_SP2");
  });

  test("creates canonical inspect hashes", () => {
    expect(createInspectHomeHash()).toBe("#inspect");
    expect(createInspectVariableHash("Temperature (2m)")).toBe("#inspect/Temperature%20(2m)");
  });
});
