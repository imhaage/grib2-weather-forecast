// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import {
  appendGroupedVariableOptions,
  defaultVariableForPackage,
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
});
