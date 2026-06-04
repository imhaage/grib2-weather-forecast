// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import {
  appendGroupedVariableOptions,
  createForecastVariableControlsView,
  defaultVariableForPackage,
  replaceGroupedVariableOptions,
} from "./forecast-variable-select.js";

describe("forecast variable select", () => {
  test("appends preferred variable groups before other groups", () => {
    const select = document.createElement("select");
    const variables = [
      { shortName: "x", name: "Other X", group: "Other" },
      { shortName: "u", name: "Wind U", group: "Component fields" },
      { shortName: "t", name: "Temperature", group: "Weather maps" },
      { shortName: "raw", name: "Raw field" },
    ];

    appendGroupedVariableOptions(document, select, variables);

    expect([...select.children].map((child) => child.tagName)).toEqual([
      "OPTION",
      "OPTGROUP",
      "OPTGROUP",
      "OPTGROUP",
    ]);
    expect([...select.children].map((child) => child.label || child.textContent)).toEqual([
      "Raw field",
      "Weather maps",
      "Component fields",
      "Other",
    ]);
    expect(select.querySelector('[label="Weather maps"] option')?.value).toBe("t");
  });

  test("selects the first weather map variable as package default", () => {
    const pkg = {
      variables: [
        { shortName: "u", name: "Wind U", group: "Component fields" },
        { shortName: "cape", name: "CAPE", group: "Weather maps" },
        { shortName: "t", name: "Temperature", group: "Weather maps" },
      ],
    };

    expect(defaultVariableForPackage(pkg)).toEqual(pkg.variables[1]);
  });

  test("replaces existing options without writing HTML strings", () => {
    const select = document.createElement("select");
    const staleOption = document.createElement("option");
    staleOption.textContent = "Stale";
    select.append(staleOption);
    const variables = [{ shortName: "t", name: "Temperature", group: "Weather maps" }];

    Object.defineProperty(select, "innerHTML", {
      configurable: true,
      set() {
        throw new Error("select should be cleared as DOM nodes");
      },
    });

    replaceGroupedVariableOptions(document, select, variables);

    expect(select.children).toHaveLength(1);
    expect(select.firstElementChild.label).toBe("Weather maps");
    expect(select.querySelector("option")?.textContent).toBe("Temperature");
  });

  test("renders variable choices and wind direction toggle state", () => {
    const variableSelect = document.createElement("select");
    const windDirectionControl = document.createElement("label");
    const windDirectionToggle = document.createElement("input");
    windDirectionToggle.type = "checkbox";
    const view = createForecastVariableControlsView({
      document,
      variableSelect,
      windDirectionControl,
      windDirectionToggle,
    });

    view.renderVariableOptions({
      variables: [
        { shortName: "t", name: "Temperature", group: "Weather maps" },
        { shortName: "wind", name: "Wind", group: "Weather maps" },
      ],
      selectedVariable: "wind",
    });
    view.renderWindDirectionToggle({ hidden: false, checked: true });

    expect(variableSelect.value).toBe("wind");
    expect([...variableSelect.querySelectorAll("option")].map((option) => option.value)).toEqual([
      "t",
      "wind",
    ]);
    expect(windDirectionControl.hidden).toBe(false);
    expect(windDirectionToggle.checked).toBe(true);
  });
});
