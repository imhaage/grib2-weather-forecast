// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import {
  BLOCK_STATUS,
  countBlockStatuses,
  createDataStatusSummaryNodes,
} from "./data-status-summary.js";

describe("data status summary", () => {
  test("renders cache, network, updating, and missing counts in display order", () => {
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
      "1 loaded from network",
      "1 updating",
      "1 missing",
    ]);
    expect(items.map((node) => node.classList.item(1))).toEqual([
      BLOCK_STATUS.LOADED_FROM_CACHE,
      BLOCK_STATUS.READY,
      BLOCK_STATUS.DOWNLOADING,
      BLOCK_STATUS.MISSING,
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
});
