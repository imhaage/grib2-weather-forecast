import { describe, expect, test, vi } from "vitest";
import { createForecastVariableSelectionService } from "./forecast-variable-selection-service.js";

function createService(overrides = {}) {
  const dependencies = {
    applyDefaultPalette: vi.fn(),
    findPackageVariable: vi.fn(),
    formatModelPackageSubtitle: vi.fn((packageKey) => `${packageKey} subtitle`),
    parameterDescriptionFor: vi.fn((shortName) => `${shortName} description`),
    updateLevelInfo: vi.fn(),
    updateParamInfo: vi.fn(),
    ...overrides,
  };
  return {
    dependencies,
    service: createForecastVariableSelectionService(dependencies),
  };
}

describe("forecast variable selection service", () => {
  test("selects the initial package variable and enables wind direction by default", () => {
    const { dependencies, service } = createService();
    const modelState = { packageKey: "AROME_SP1", variable: null, showWindDirection: false };
    const variableDefinition = {
      shortName: "wind",
      name: "Wind",
      group: "Weather maps",
    };

    const variableKey = service.selectInitialVariable(modelState, variableDefinition);

    expect(variableKey).toBe("wind");
    expect(modelState.variable).toBe("wind");
    expect(modelState.showWindDirection).toBe(true);
    expect(dependencies.applyDefaultPalette).toHaveBeenCalledWith("wind");
    expect(dependencies.updateLevelInfo).toHaveBeenCalledWith(variableDefinition);
  });

  test("applies a selected package variable and updates presentation metadata", () => {
    const variableDefinition = {
      shortName: "u",
      varKey: "u_10",
      name: "U wind",
      levelValue: 10,
    };
    const { dependencies, service } = createService({
      findPackageVariable: vi.fn(() => variableDefinition),
    });
    const modelState = { packageKey: "AROME_HP1", variable: "r_10" };

    const variableDefinitionFound = service.selectVariable(modelState, "u_10");

    expect(variableDefinitionFound).toBe(variableDefinition);
    expect(modelState.variable).toBe("u_10");
    expect(dependencies.applyDefaultPalette).toHaveBeenCalledWith("u_10");
    expect(dependencies.updateParamInfo).toHaveBeenCalledWith(
      "U wind",
      "u description",
      "AROME_HP1 subtitle",
    );
    expect(dependencies.updateLevelInfo).toHaveBeenCalledWith(variableDefinition);
  });

  test("returns wind direction visibility state for the selected variable", () => {
    const { service } = createService();

    expect(
      service.windDirectionControlState({ variable: "wind", showWindDirection: false }),
    ).toEqual({
      hidden: false,
      checked: false,
    });
    expect(service.windDirectionControlState({ variable: "t", showWindDirection: true })).toEqual({
      hidden: true,
      checked: true,
    });
  });
});
