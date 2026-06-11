// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { BLOCK_STATUS } from "../domain/forecast-types";
import {
  countBlockStatuses,
  createDataStatusSummaryNodes,
  createDataStatusSummaryView,
} from "./data-status-summary.js";

describe("data status summary", () => {
  test("renders cache, missing, network, updating counts in display order", () => {
    const nodes = createDataStatusSummaryNodes(document, [
      { status: BLOCK_STATUS.READY },
      { status: BLOCK_STATUS.LOADED_FROM_CACHE },
      { status: BLOCK_STATUS.DOWNLOADING },
      {},
    ]);

    const wrapper = document.createElement("div");
    wrapper.replaceChildren(...nodes);

    const items = [...wrapper.querySelectorAll(".data-status-count")];

    expect(items.map((node) => node.textContent)).toEqual([
      "1 loaded from cache",
      "1 missing",
      "1 loaded from network",
      "1 updating",
    ]);
    expect(items.map((node) => node.classList.item(1))).toEqual([
      BLOCK_STATUS.LOADED_FROM_CACHE,
      BLOCK_STATUS.MISSING,
      BLOCK_STATUS.READY,
      BLOCK_STATUS.DOWNLOADING,
    ]);
  });

  test("counts unknown block statuses as missing", () => {
    expect(
      countBlockStatuses([{ status: BLOCK_STATUS.READY }, { status: BLOCK_STATUS.READY }, {}]),
    ).toMatchObject({
      [BLOCK_STATUS.READY]: 2,
      [BLOCK_STATUS.MISSING]: 1,
    });
  });

  test("renders summary nodes into the configured container", () => {
    const container = document.createElement("div");
    const view = createDataStatusSummaryView({ document, container });

    view.render([{ status: BLOCK_STATUS.READY }, {}]);

    expect(
      [...container.querySelectorAll(".data-status-count")].map((node) => node.textContent),
    ).toEqual(["0 loaded from cache", "1 missing", "1 loaded from network", "0 updating"]);
  });
});
