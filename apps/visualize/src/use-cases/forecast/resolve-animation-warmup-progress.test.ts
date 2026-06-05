import { describe, expect, test } from "vitest";
import { resolveAnimationWarmupProgress } from "./resolve-animation-warmup-progress";

describe("forecast animation warmup progress use case", () => {
  test("hides progress when no forecast hours are available", () => {
    expect(
      resolveAnimationWarmupProgress({
        modelState: { hourList: [], animationCacheStatus: "waiting", resources: [] },
        ready: 0,
      }),
    ).toEqual({
      cacheStatus: "waiting",
      progress: {
        hidden: true,
        isReady: false,
        isWaiting: false,
        label: "Animation cache",
        percent: 0,
        ready: 0,
        total: 0,
      },
    });
  });

  test("marks a complete building cache as ready", () => {
    expect(
      resolveAnimationWarmupProgress({
        modelState: {
          hourList: [1, 2],
          animationCacheStatus: "building",
          resources: [],
          availableBlocks: new Set(),
        },
        ready: 2,
      }),
    ).toMatchObject({
      cacheStatus: "ready",
      progress: {
        hidden: true,
        isReady: true,
        isWaiting: false,
        label: "Animation ready",
        percent: 100,
        ready: 2,
        total: 2,
      },
    });
  });

  test("explains that animation generation is waiting for missing downloads", () => {
    expect(
      resolveAnimationWarmupProgress({
        modelState: {
          hourList: [1, 2],
          animationCacheStatus: "waiting",
          resources: [{ key: "01H", status: "downloading" }],
          availableBlocks: new Set(),
        },
        ready: 1,
      }).progress,
    ).toMatchObject({
      hidden: false,
      isReady: false,
      isWaiting: true,
      label: "Animation cache: waiting for downloads",
      percent: 50,
      ready: 1,
      total: 2,
    });
  });
});
