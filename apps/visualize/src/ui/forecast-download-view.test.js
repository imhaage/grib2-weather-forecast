// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { BLOCK_STATUS } from "./data-status-summary.js";
import { createForecastDownloadView } from "./forecast-download-view.js";

function createView() {
  const barsEl = document.createElement("div");
  const fileListEl = document.createElement("ol");
  const statusEl = document.createElement("p");
  const view = createForecastDownloadView({
    document,
    barsEl,
    fileListEl,
    statusEl,
    formatRunSummary: (resources) => resources.map((resource) => resource.key).join(", "),
    formatSize: (bytes) => `${bytes} B`,
  });

  return { barsEl, fileListEl, statusEl, view };
}

function createResource(overrides = {}) {
  return {
    key: "01H",
    filesize: 1234,
    url: "https://example.test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2",
    ...overrides,
  };
}

describe("forecast download view", () => {
  test("renders a bar and file list item with filename and formatted size", () => {
    const { barsEl, fileListEl, view } = createView();

    view.renderItems([createResource()]);

    const bar = barsEl.querySelector("#dl-01H");
    const fileItem = fileListEl.querySelector("#dl-file-01H");

    expect(bar.textContent).toBe("01H");
    expect(bar.className).toBe("forecast-download-bar missing");
    expect(bar.title).toBe("01H");
    expect(fileItem.className).toBe("forecast-download-file missing");
    expect(fileItem.firstElementChild.textContent).toBe(
      "arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2 · 1234 B",
    );
    expect(fileItem.querySelector(".forecast-download-file__status").textContent).toBe("missing");
  });

  test("updates classes and file status label for ready and cache statuses", () => {
    const { barsEl, fileListEl, view } = createView();
    const resource = createResource();
    view.renderItems([resource]);

    view.setBlockStatus(resource, BLOCK_STATUS.READY);

    const bar = barsEl.querySelector("#dl-01H");
    const fileItem = fileListEl.querySelector("#dl-file-01H");
    expect(bar.className).toBe("forecast-download-bar ready done");
    expect(bar.title).toBe("01H · ready");
    expect(fileItem.className).toBe("forecast-download-file ready done");
    expect(fileItem.querySelector(".forecast-download-file__status").textContent).toBe(
      "loaded from network",
    );

    view.setBlockStatus(resource, BLOCK_STATUS.LOADED_FROM_CACHE);

    expect(bar.className).toBe("forecast-download-bar loaded-from-cache");
    expect(bar.title).toBe("01H · loaded-from-cache");
    expect(fileItem.className).toBe("forecast-download-file loaded-from-cache");
    expect(fileItem.querySelector(".forecast-download-file__status").textContent).toBe(
      "loaded from cache",
    );
  });

  test("updates and resets download progress", () => {
    const { barsEl, view } = createView();
    const resource = createResource();
    view.renderItems([resource]);

    view.setBlockDownloadProgress(resource, "42%");

    const bar = barsEl.querySelector("#dl-01H");
    expect(bar.style.getPropertyValue("--pct")).toBe("42%");

    view.resetBlockDownloadProgress(resource);

    expect(bar.style.getPropertyValue("--pct")).toBe("0%");
  });

  test("updates rendered items without scanning child lists again", () => {
    const { barsEl, fileListEl, view } = createView();
    const resource = createResource();
    view.renderItems([resource]);
    const bar = barsEl.querySelector("#dl-01H");
    const fileItem = fileListEl.querySelector("#dl-file-01H");

    Object.defineProperty(barsEl, "children", {
      configurable: true,
      get() {
        throw new Error("bars children should not be scanned");
      },
    });
    Object.defineProperty(fileListEl, "children", {
      configurable: true,
      get() {
        throw new Error("file children should not be scanned");
      },
    });

    view.setBlockStatus(resource, BLOCK_STATUS.READY);
    view.setBlockDownloadProgress(resource, "67%");

    expect(bar.className).toBe("forecast-download-bar ready done");
    expect(fileItem.className).toBe("forecast-download-file ready done");
    expect(bar.style.getPropertyValue("--pct")).toBe("67%");
  });

  test("sets status text and clears rendered items", () => {
    const { barsEl, fileListEl, statusEl, view } = createView();
    view.renderItems([createResource()]);

    view.setStatus("Checking latest files…");
    view.clear();

    expect(statusEl.textContent).toBe("Checking latest files…");
    expect(barsEl.children).toHaveLength(0);
    expect(fileListEl.children).toHaveLength(0);
  });

  test("clears rendered items without writing HTML strings", () => {
    const { barsEl, fileListEl, view } = createView();
    view.renderItems([createResource()]);

    Object.defineProperty(barsEl, "innerHTML", {
      configurable: true,
      set() {
        throw new Error("bars should be cleared as DOM nodes");
      },
    });
    Object.defineProperty(fileListEl, "innerHTML", {
      configurable: true,
      set() {
        throw new Error("file list should be cleared as DOM nodes");
      },
    });

    view.clear();

    expect(barsEl.children).toHaveLength(0);
    expect(fileListEl.children).toHaveLength(0);
  });
});
