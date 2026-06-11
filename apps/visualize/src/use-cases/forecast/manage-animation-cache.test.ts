import { describe, expect, test, vi } from "vitest";
import { makeForecastRunState } from "./forecast-test-fixtures";
import { createAnimationCacheService } from "./manage-animation-cache";
import { makeForecastMapEntry } from "./map-test-fixtures";

describe("forecast animation cache use case", () => {
  test("closes bitmaps when removing an hour or clearing the cache", () => {
    const cache = createAnimationCacheService();
    const firstBitmap = { close: vi.fn() };
    const secondBitmap = { close: vi.fn() };

    cache.setHour(1, makeForecastMapEntry({ bitmap: firstBitmap }));
    cache.setHour(2, makeForecastMapEntry({ bitmap: secondBitmap }));

    cache.removeHour(1);
    cache.clear();

    expect(firstBitmap.close).toHaveBeenCalledTimes(1);
    expect(secondBitmap.close).toHaveBeenCalledTimes(1);
  });

  test("deduplicates prerender jobs by generation and block key", () => {
    const cache = createAnimationCacheService();
    const state = makeForecastRunState();

    expect(cache.enqueueBlock("01H", 1, state)).toBe(true);
    expect(cache.enqueueBlock("01H", 1, state)).toBe(false);
    expect(cache.enqueueBlock("01H", 2, state)).toBe(true);

    expect(cache.queueLength).toBe(2);
    expect(cache.beginDrain()).toBe(true);
    const firstJob = cache.nextJob();
    expect(firstJob).toMatchObject({ blockKey: "01H", renderGeneration: 1, state });
    expect(firstJob).not.toBeNull();

    if (!firstJob) {
      throw new Error("Expected a queued prerender job");
    }

    cache.completeJob(firstJob);
    expect(cache.enqueueBlock("01H", 1, state)).toBe(true);
  });
});
