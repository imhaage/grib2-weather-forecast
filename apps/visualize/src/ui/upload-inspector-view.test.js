// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { renderUploadedMessageCard } from "./upload-inspector-view.js";

describe("upload inspector view", () => {
  test("renders decoded message metadata and grid action", () => {
    const html = renderUploadedMessageCard(
      {
        index: 3,
        header: {},
        product: {
          shortName: "t",
          name: "Temperature",
          units: "K",
          typeOfGeneratingProcess: 2,
        },
        grid: {
          ni: 100,
          nj: 80,
          di: 0.01,
          dj: 0.01,
        },
      },
      {
        code: () => "Forecast",
        formatGrid: (grid) => `${grid.ni} x ${grid.nj}`,
        formatLevel: () => "2 m",
        formatValidTime: () => "2026-05-22 12:00 UTC",
        generatingProcess: {},
      },
    );
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    expect(wrapper.textContent).toContain("Temperature");
    expect(wrapper.textContent).toContain("Forecast time (UTC)");
    expect(wrapper.textContent).toContain("2026-05-22 12:00 UTC");
    expect(wrapper.textContent).toContain("100 x 80");
    expect(wrapper.querySelector("button")?.dataset.var).toBe("t");
    expect(wrapper.querySelector("button")?.textContent).toBe("View grid");
  });
});
