import { describe, expect, test, vi } from "vitest";
import { createForecastAnimationCacheBuildService } from "./forecast-animation-cache-build-service.js";

describe("forecast animation cache build service", () => {
  test("builds the animation cache and marks it ready when complete", async () => {
    const modelState = { animationCacheStatus: "waiting" };
    const dependencies = {
      getModelState: vi.fn(() => modelState),
      isBitmapCacheComplete: vi.fn(() => true),
      isRefreshActive: vi.fn(() => true),
      queuePrerenderForAllBlocks: vi.fn(),
      updateWarmupProgress: vi.fn(),
      waitForPrerenderIdle: vi.fn(async () => {}),
    };
    const service = createForecastAnimationCacheBuildService(dependencies);

    await service.buildAfterNetworkSettles({ downloadKey: { id: 1 } });

    expect(modelState.animationCacheStatus).toBe("ready");
    expect(dependencies.queuePrerenderForAllBlocks).toHaveBeenCalled();
    expect(dependencies.waitForPrerenderIdle).toHaveBeenCalled();
    expect(dependencies.updateWarmupProgress).toHaveBeenCalledTimes(2);
  });

  test("keeps the animation cache waiting when prerender does not complete", async () => {
    const modelState = { animationCacheStatus: "waiting" };
    const service = createForecastAnimationCacheBuildService({
      getModelState: vi.fn(() => modelState),
      isBitmapCacheComplete: vi.fn(() => false),
      isRefreshActive: vi.fn(() => true),
      queuePrerenderForAllBlocks: vi.fn(),
      updateWarmupProgress: vi.fn(),
      waitForPrerenderIdle: vi.fn(async () => {}),
    });

    await service.buildAfterNetworkSettles({ downloadKey: { id: 1 } });

    expect(modelState.animationCacheStatus).toBe("waiting");
  });

  test("does not update final status after the refresh becomes inactive", async () => {
    const modelState = { animationCacheStatus: "waiting" };
    const updateWarmupProgress = vi.fn();
    const service = createForecastAnimationCacheBuildService({
      getModelState: vi.fn(() => modelState),
      isBitmapCacheComplete: vi.fn(() => true),
      isRefreshActive: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
      queuePrerenderForAllBlocks: vi.fn(),
      updateWarmupProgress,
      waitForPrerenderIdle: vi.fn(async () => {}),
    });

    await service.buildAfterNetworkSettles({ downloadKey: { id: 1 } });

    expect(modelState.animationCacheStatus).toBe("building");
    expect(updateWarmupProgress).toHaveBeenCalledTimes(1);
  });
});
