// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { renderUploadedMessageCard } from "./upload-inspector-view.js";

describe("upload inspector view", () => {
  test("renders decoded message metadata and grid action", () => {
    const card = renderUploadedMessageCard(
      document,
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

    expect(card.textContent).toContain("Temperature");
    expect(card.textContent).toContain("Forecast time (UTC)");
    expect(card.textContent).toContain("2026-05-22 12:00 UTC");
    expect(card.textContent).toContain("100 x 80");
    expect(card.querySelector("button")?.dataset.var).toBe("t");
    expect(card.querySelector("button")?.dataset.messageIndex).toBe("3");
    expect(card.querySelector("button")?.textContent).toBe("Show on map");
  });

  test("keeps decoded metadata as text content", () => {
    const card = renderUploadedMessageCard(
      document,
      {
        index: 3,
        header: {},
        product: {
          shortName: "t",
          name: "<img src=x onerror=alert(1)>",
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
        code: () => "<script>bad()</script>",
        formatGrid: (grid) => `${grid.ni} x ${grid.nj}`,
        formatLevel: () => "2 m",
        formatValidTime: () => "2026-05-22 12:00 UTC",
        generatingProcess: {},
      },
    );

    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector("script")).toBeNull();
    expect(card.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(card.textContent).toContain("<script>bad()</script>");
  });
});
