import { describe, expect, test, vi } from "vitest";
import { createForecastTooltipHydrationService } from "./hydrate-tooltip-values";

function createService(overrides = {}) {
  let timerId = 0;
  const scheduled = new Map<number, () => Promise<void> | void>();
  const dependencies = {
    clearTimer: vi.fn((id: number) => scheduled.delete(id)),
    decodeValues: vi.fn(async () => ({
      values: new Float32Array([1, 2]),
      vectorUValues: new Float32Array([3, 4]),
      vectorVValues: new Float32Array([5, 6]),
    })),
    delayMs: 140,
    getCachedEntry: vi.fn(() => ({
      product: { shortName: "t" },
    })),
    getCurrentRenderGeneration: vi.fn(() => 1),
    getCurrentState: vi.fn(),
    isPlayerPlaying: vi.fn(() => false),
    makeGridState: vi.fn((entry, values) => ({ entry, values })),
    onError: vi.fn(),
    setGridState: vi.fn(),
    setTimer: vi.fn((callback: () => Promise<void> | void) => {
      timerId++;
      scheduled.set(timerId, callback);

      return timerId;
    }),
    updateIsobarOverlay: vi.fn(),
    ...overrides,
  };

  return {
    dependencies,
    runNextTimer: async () => {
      const callback = scheduled.values().next().value;

      if (callback) {
        await callback();
      }
    },
    service: createForecastTooltipHydrationService(dependencies),
  };
}

describe("forecast tooltip hydration use case", () => {
  test("hydrates cached entries after the debounce delay", async () => {
    const state = { currentHour: 1 };
    const { dependencies, runNextTimer, service } = createService({
      getCurrentState: vi.fn(() => state),
    });

    service.queue({ hour: 1, hourIndex: 0, renderGeneration: 1 });
    await runNextTimer();

    expect(dependencies.decodeValues).toHaveBeenCalledWith(0, 1);
    expect(dependencies.setGridState).toHaveBeenCalledWith({
      entry: expect.objectContaining({
        vectorUValues: expect.any(Float32Array),
        vectorVValues: expect.any(Float32Array),
      }),
      values: expect.any(Float32Array),
    });
    expect(dependencies.updateIsobarOverlay).toHaveBeenCalledWith(
      { product: { shortName: "t" } },
      expect.any(Float32Array),
    );
  });

  test("does not hydrate while the player is running", async () => {
    const { dependencies, runNextTimer, service } = createService({
      isPlayerPlaying: vi.fn(() => true),
    });

    service.queue({ hour: 1, hourIndex: 0, renderGeneration: 1 });
    await runNextTimer();

    expect(dependencies.decodeValues).not.toHaveBeenCalled();
  });

  test("invalidates a previously queued hydration", async () => {
    const { dependencies, service } = createService();

    service.queue({ hour: 1, hourIndex: 0, renderGeneration: 1 });
    service.invalidate();

    expect(dependencies.clearTimer).toHaveBeenCalled();
  });
});
