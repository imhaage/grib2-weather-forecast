import { describe, expect, test, vi } from "vitest";
import { createForecastPrerenderBlockService } from "./prerender-block";

describe("forecast prerender block use case", () => {
  test("renders missing hours from a block into the bitmap cache", async () => {
    const state = {
      hourList: [1, 2],
      resources: [{ key: "block-1", startHour: 1, endHour: 2 }],
    };
    const cache = {
      hasHour: vi.fn(() => false),
      setHour: vi.fn(),
    };
    const renderHour = vi.fn(async (index) => ({
      bitmap: { close: vi.fn() },
      hourIndex: index,
    }));
    const service = createForecastPrerenderBlockService({
      cache,
      getCurrentRenderGeneration: vi.fn(() => 1),
      getCurrentState: vi.fn(() => state),
      keepValuesForCurrentVariable: vi.fn(() => true),
      mapWorkerEntry: vi.fn((entry) => ({ cachedFrom: entry.hourIndex })),
      renderHour,
      updateWarmupProgress: vi.fn(),
    });

    await service.prerenderBlock("block-1", { renderGeneration: 1, state });

    expect(renderHour).toHaveBeenCalledWith(0);
    expect(renderHour).toHaveBeenCalledWith(1);
    expect(cache.setHour).toHaveBeenCalledWith(1, { cachedFrom: 0 });
    expect(cache.setHour).toHaveBeenCalledWith(2, { cachedFrom: 1 });
  });

  test("closes stale rendered bitmaps when the hour was cached concurrently", async () => {
    const state = {
      hourList: [1],
      resources: [{ key: "block-1", startHour: 1, endHour: 1 }],
    };
    const bitmap = { close: vi.fn() };
    const cache = {
      hasHour: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
      setHour: vi.fn(),
    };
    const service = createForecastPrerenderBlockService({
      cache,
      getCurrentRenderGeneration: vi.fn(() => 1),
      getCurrentState: vi.fn(() => state),
      keepValuesForCurrentVariable: vi.fn(() => false),
      mapWorkerEntry: vi.fn(),
      renderHour: vi.fn(async () => ({ bitmap })),
      updateWarmupProgress: vi.fn(),
    });

    await service.prerenderBlock("block-1", { renderGeneration: 1, state });

    expect(bitmap.close).toHaveBeenCalled();
    expect(cache.setHour).not.toHaveBeenCalled();
  });

  test("stops when the render generation changes", async () => {
    const state = {
      hourList: [1],
      resources: [{ key: "block-1", startHour: 1, endHour: 1 }],
    };
    const bitmap = { close: vi.fn() };
    const service = createForecastPrerenderBlockService({
      cache: { hasHour: vi.fn(() => false), setHour: vi.fn() },
      getCurrentRenderGeneration: vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2),
      getCurrentState: vi.fn(() => state),
      keepValuesForCurrentVariable: vi.fn(() => false),
      mapWorkerEntry: vi.fn(),
      renderHour: vi.fn(async () => ({ bitmap })),
      updateWarmupProgress: vi.fn(),
    });

    await service.prerenderBlock("block-1", { renderGeneration: 1, state });

    expect(bitmap.close).toHaveBeenCalled();
  });
});
