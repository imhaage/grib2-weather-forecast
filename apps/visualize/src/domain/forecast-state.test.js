import { describe, expect, test } from "vitest";
import {
  blockForHour,
  buildHourList,
  createModelState,
  markBlockAvailable,
} from "./forecast-state.js";

describe("forecast state", () => {
  test("creates model state with explicit defaults and no stale main-thread decode state", () => {
    const state = createModelState("AROME_SP1");

    expect(state).toEqual({
      packageKey: "AROME_SP1",
      resourceRefreshId: 0,
      resources: [],
      availableBlocks: expect.any(Set),
      hourList: [],
      blockStatus: expect.any(Map),
      variable: null,
      currentHour: null,
      lastRunInfo: null,
      animationCacheStatus: "waiting",
      showWindDirection: true,
    });
    expect(state.availableBlocks.size).toBe(0);
    expect(state.blockStatus.size).toBe(0);
    expect(state).not.toHaveProperty("buffers");
    expect(state).not.toHaveProperty("messageIndex");
    expect(state).not.toHaveProperty("decoded");
    expect(state).not.toHaveProperty("decodedOrder");
  });

  test("builds a flat hour list from resource ranges", () => {
    expect(
      buildHourList([
        { startHour: 1, endHour: 2 },
        { startHour: 4, endHour: 4 },
      ]),
    ).toEqual([1, 2, 4]);
  });

  test("finds the block covering an hour", () => {
    const resources = [
      { key: "01-03H", startHour: 1, endHour: 3 },
      { key: "04H", startHour: 4, endHour: 4 },
    ];

    expect(blockForHour(resources, 2)).toBe(resources[0]);
    expect(blockForHour(resources, 4)).toBe(resources[1]);
    expect(blockForHour(resources, 5)).toBeNull();
  });

  test("marks a block as available", () => {
    const state = createModelState("AROME_SP1");

    markBlockAvailable(state, { key: "01H" });

    expect(state.availableBlocks).toContain("01H");
  });
});
