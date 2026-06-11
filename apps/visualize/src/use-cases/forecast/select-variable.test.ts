import { describe, expect, test, vi } from "vitest";
import { createForecastVariableSelectionUseCase } from "./select-variable";

function createUseCase(overrides = {}) {
  const ports = {
    applyDefaultPalette: vi.fn(),
    findPackageVariable: vi.fn(),
    formatModelPackageSubtitle: vi.fn((packageKey) => `${packageKey} subtitle`),
    parameterDescriptionFor: vi.fn((shortName) => `${shortName} description`),
    updateLevelInfo: vi.fn(),
    updateParamInfo: vi.fn(),
    ...overrides,
  };

  return {
    ports,
    useCase: createForecastVariableSelectionUseCase(ports),
  };
}

describe("forecast variable selection use case", () => {
  test("selects the initial package variable and enables wind direction by default", () => {
    const { ports, useCase } = createUseCase();
    const modelState = { packageKey: "AROME_SP1", variable: null, showWindDirection: false };
    const variableDefinition = {
      shortName: "wind",
      name: "Wind",
      group: "Weather maps",
      units: "km/h",
      level: "10 m above ground",
    };

    const variableKey = useCase.selectInitialVariable(modelState, variableDefinition);

    expect(variableKey).toBe("wind");
    expect(modelState.variable).toBe("wind");
    expect(modelState.showWindDirection).toBe(true);
    expect(ports.applyDefaultPalette).toHaveBeenCalledWith("wind");
    expect(ports.updateLevelInfo).toHaveBeenCalledWith(variableDefinition);
  });

  test("applies a selected package variable and updates presentation metadata", () => {
    const variableDefinition = {
      shortName: "u",
      varKey: "u_10",
      name: "U wind",
      levelValue: 10,
      units: "m s-1",
      level: "10 m above ground",
    };
    const { ports, useCase } = createUseCase({
      findPackageVariable: vi.fn(() => variableDefinition),
    });
    const modelState = { packageKey: "AROME_HP1", variable: "r_10" };

    const variableDefinitionFound = useCase.selectVariable(modelState, "u_10");

    expect(variableDefinitionFound).toBe(variableDefinition);
    expect(modelState.variable).toBe("u_10");
    expect(ports.applyDefaultPalette).toHaveBeenCalledWith("u_10");
    expect(ports.updateParamInfo).toHaveBeenCalledWith(
      "U wind",
      "u description",
      "AROME_HP1 subtitle",
    );
    expect(ports.updateLevelInfo).toHaveBeenCalledWith(variableDefinition);
  });

  test("returns wind direction visibility state for the selected variable", () => {
    const { useCase } = createUseCase();

    expect(
      useCase.windDirectionControlState({ variable: "wind", showWindDirection: false }),
    ).toEqual({
      hidden: false,
      checked: false,
    });
    expect(useCase.windDirectionControlState({ variable: "t", showWindDirection: true })).toEqual({
      hidden: true,
      checked: true,
    });
  });
});
