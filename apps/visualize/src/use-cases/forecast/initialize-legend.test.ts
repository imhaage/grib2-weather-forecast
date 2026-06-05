import { describe, expect, test, vi } from "vitest";
import { createForecastLegendInitializerUseCase } from "./initialize-legend";

describe("forecast legend initializer use case", () => {
  test("initializes the map legend from the first matching GRIB message", () => {
    const session = {
      legendInitialized: false,
      packageKey: "TEST_MODEL",
    };
    const modelState = {
      packageKey: "TEST_MODEL",
      variable: "temperature",
      lastRunInfo: null,
    };
    const variableDefinition = {
      key: "temperature",
      name: "Temperature",
      shortName: "t",
      units: "K",
      levelValue: 2,
    };
    const ports = {
      applyDefaultPalette: vi.fn(),
      displayUnitsFor: vi.fn(() => "degC"),
      findPackageVariable: vi.fn(() => variableDefinition),
      formatModelPackageSubtitle: vi.fn(() => "Test model"),
      formatRefTime: vi.fn(() => "2026-06-04 06Z"),
      iterateMessages: vi.fn(function* () {
        yield {
          header: { refTime: "ignored" },
          product: { shortName: "u", name: "Wind U", levelValue: 10 },
        };
        yield {
          header: { refTime: "used" },
          product: { shortName: "t", name: "Temperature", levelValue: 2 },
        };
      }),
      parameterDescriptionFor: vi.fn(() => "Air temperature"),
      showColorScale: vi.fn(),
      staticScaleFor: vi.fn(() => ({ min: -10, max: 40, log: false })),
      updateLevelInfo: vi.fn(),
      updateParamInfo: vi.fn(),
    };
    const useCase = createForecastLegendInitializerUseCase(ports);

    expect(useCase.initializeFromBlock(new Uint8Array([1]), { modelState, session })).toBe(true);

    expect(session.legendInitialized).toBe(true);
    expect(modelState.lastRunInfo).toBe("TEST_MODEL · run 2026-06-04 06Z");
    expect(ports.applyDefaultPalette).toHaveBeenCalledWith("temperature");
    expect(ports.updateParamInfo).toHaveBeenCalledWith(
      "Temperature",
      "Air temperature",
      "Test model",
    );
    expect(ports.updateLevelInfo).toHaveBeenCalledWith(variableDefinition);
    expect(ports.showColorScale).toHaveBeenCalledWith(-10, 40, "degC", {
      isLog: false,
    });
  });

  test("does not scan messages twice for the same session", () => {
    const iterateMessages = vi.fn(function* () {
      yield {
        header: {},
        product: { shortName: "t", name: "Temperature" },
      };
    });
    const useCase = createForecastLegendInitializerUseCase({
      applyDefaultPalette: vi.fn(),
      displayUnitsFor: vi.fn(),
      findPackageVariable: vi.fn(() => ({ shortName: "t", name: "Temperature", units: "K" })),
      formatModelPackageSubtitle: vi.fn(() => "Test model"),
      formatRefTime: vi.fn(() => "run"),
      iterateMessages,
      parameterDescriptionFor: vi.fn(() => "Air temperature"),
      showColorScale: vi.fn(),
      staticScaleFor: vi.fn(() => null),
      updateLevelInfo: vi.fn(),
      updateParamInfo: vi.fn(),
    });
    const session = { legendInitialized: true, packageKey: "TEST_MODEL" };

    expect(
      useCase.initializeFromBlock(new Uint8Array([1]), {
        modelState: { packageKey: "TEST_MODEL", variable: "temperature" },
        session,
      }),
    ).toBe(false);

    expect(iterateMessages).not.toHaveBeenCalled();
  });
});
