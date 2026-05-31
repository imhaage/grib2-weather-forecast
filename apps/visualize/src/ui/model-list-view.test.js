// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { renderModelList } from "./model-list-view.js";

describe("model list view", () => {
  test("renders package labels, variables, and map action buttons", () => {
    const container = document.createElement("div");
    renderModelList({
      container,
      modelInfo: {
        AROME: {
          title: "AROME 0.01",
          description: "High-resolution forecast model.",
          resolution: "0.01°",
          horizon: "H+01 to H+51",
          filesInfo: "51 files",
          boundingBox: "12°W – 16°E · 37.5°N – 55.4°N",
          coverage: "Mainland France and Corsica",
        },
      },
      packages: {
        AROME_SP1: {
          model: "AROME",
          variables: [{ name: "Temperature (2m)" }, { name: "Relative humidity (2m)" }],
        },
      },
    });

    expect(container.textContent).toContain("AROME 0.01");
    expect(container.textContent).toContain("SP1");
    expect(container.textContent).toContain("Temperature (2m)");
    expect(container.textContent).toContain("Relative humidity (2m)");

    const button = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Show on map",
    );
    expect(button?.textContent).toBe("Show on map");
    expect(button?.dataset.action).toBe("show-package");
    expect(button?.dataset.packageKey).toBe("AROME_SP1");
  });

  test("groups home parameters by weather maps then component fields", () => {
    const container = document.createElement("div");

    renderModelList({
      container,
      modelInfo: {
        AROME: {
          title: "AROME 0.01",
          description: "High-resolution forecast model.",
          resolution: "0.01°",
          horizon: "H+01 to H+51",
          filesInfo: "51 files",
          boundingBox: "12°W – 16°E · 37.5°N – 55.4°N",
          coverage: "Mainland France and Corsica",
        },
      },
      packages: {
        AROME_SP1: {
          model: "AROME",
          variables: [
            { name: "U (wind, 10m)", group: "Component fields" },
            { name: "Temperature (2m)", group: "Weather maps" },
            { name: "V (wind, 10m)", group: "Component fields" },
          ],
        },
        AROME_HP1: {
          model: "AROME",
          homeVariableGroups: [
            {
              group: "Weather maps",
              names: ["Wind speed (10m, 20m, 50m, 100m)"],
            },
            {
              group: "Component fields",
              names: ["U (wind, 10m, 20m, 50m, 100m)"],
            },
          ],
          variables: [],
        },
      },
    });

    const [sp1, hp1] = container.querySelectorAll(".model-package");
    expect(
      [...sp1.querySelectorAll(".model-package-var-group-title")].map((el) => el.textContent),
    ).toEqual(["Weather maps", "Component fields"]);
    expect(sp1.textContent.indexOf("Temperature (2m)")).toBeLessThan(
      sp1.textContent.indexOf("U (wind, 10m)"),
    );
    expect(hp1.textContent).toContain("Wind speed (10m, 20m, 50m, 100m)");
    expect(hp1.textContent).toContain("U (wind, 10m, 20m, 50m, 100m)");
  });
});
