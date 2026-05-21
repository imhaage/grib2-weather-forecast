// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import {
  BLOCK_STATUS,
  BLOCK_STATUS_CLASSES,
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

    expect(wrapper.textContent).toBe(
      "1 loaded from cache · 1 loaded from network · 1 updating · 1 missing",
    );
    expect(
      [...wrapper.querySelectorAll(".data-status-count")].map((node) => node.className),
    ).toEqual([
      "data-status-count loaded-from-cache",
      "data-status-count ready",
      "data-status-count downloading",
      "data-status-count missing",
    ]);
  });

  test("exports every status class used by download items", () => {
    expect(BLOCK_STATUS_CLASSES).toEqual([
      "missing",
      "loaded-from-cache",
      "downloading",
      "ready",
      "done",
      "cached",
    ]);
  });
});
