// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { renderModelList } from "./model-list-view.js";

describe("model list view", () => {
  test("renders package labels, variables, and map action buttons", () => {
    const container = document.createElement("div");
    const onPackageSelect = vi.fn();

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
      onPackageSelect,
    });

    expect(container.querySelector(".model-section-title")?.textContent).toBe("AROME 0.01");
    expect(container.querySelector(".model-package-label")?.textContent).toBe("SP1");
    expect(
      [...container.querySelectorAll(".model-package-vars li")].map((item) => item.textContent),
    ).toEqual(["Temperature (2m)", "Relative humidity (2m)"]);

    const button = container.querySelector(".model-package .btn-primary");
    expect(button?.textContent).toBe("Show on map");
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPackageSelect).toHaveBeenCalledWith("AROME_SP1");
  });
});
