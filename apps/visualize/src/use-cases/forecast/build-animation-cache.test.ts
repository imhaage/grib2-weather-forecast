import { describe, expect, test, vi } from "vitest";
import { createForecastAnimationCacheBuildUseCase } from "./build-animation-cache";
import { makeForecastRefreshKey } from "./forecast-test-fixtures";
import type { ForecastAnimationCacheState } from "./ports";

describe("forecast animation cache build use case", () => {
  test("builds the animation cache and marks it ready when complete", async () => {
    const modelState: ForecastAnimationCacheState = { animationCacheStatus: "waiting" };
    const ports = {
      getModelState: vi.fn(() => modelState),
      isBitmapCacheComplete: vi.fn(() => true),
      isRefreshActive: vi.fn(() => true),
      queuePrerenderForAllBlocks: vi.fn(),
      updateWarmupProgress: vi.fn(),
      waitForPrerenderIdle: vi.fn(async () => {}),
    };
    const useCase = createForecastAnimationCacheBuildUseCase(ports);

    await useCase.buildAfterNetworkSettles({ downloadKey: makeForecastRefreshKey() });

    expect(modelState.animationCacheStatus).toBe("ready");
    expect(ports.queuePrerenderForAllBlocks).toHaveBeenCalled();
    expect(ports.waitForPrerenderIdle).toHaveBeenCalled();
    expect(ports.updateWarmupProgress).toHaveBeenCalledTimes(2);
  });

  test("keeps the animation cache waiting when prerender does not complete", async () => {
    const modelState: ForecastAnimationCacheState = { animationCacheStatus: "waiting" };
    const useCase = createForecastAnimationCacheBuildUseCase({
      getModelState: vi.fn(() => modelState),
      isBitmapCacheComplete: vi.fn(() => false),
      isRefreshActive: vi.fn(() => true),
      queuePrerenderForAllBlocks: vi.fn(),
      updateWarmupProgress: vi.fn(),
      waitForPrerenderIdle: vi.fn(async () => {}),
    });

    await useCase.buildAfterNetworkSettles({ downloadKey: makeForecastRefreshKey() });

    expect(modelState.animationCacheStatus).toBe("waiting");
  });

  test("does not update final status after the refresh becomes inactive", async () => {
    const modelState: ForecastAnimationCacheState = { animationCacheStatus: "waiting" };
    const updateWarmupProgress = vi.fn();
    const useCase = createForecastAnimationCacheBuildUseCase({
      getModelState: vi.fn(() => modelState),
      isBitmapCacheComplete: vi.fn(() => true),
      isRefreshActive: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
      queuePrerenderForAllBlocks: vi.fn(),
      updateWarmupProgress,
      waitForPrerenderIdle: vi.fn(async () => {}),
    });

    await useCase.buildAfterNetworkSettles({ downloadKey: makeForecastRefreshKey() });

    expect(modelState.animationCacheStatus).toBe("building");
    expect(updateWarmupProgress).toHaveBeenCalledTimes(1);
  });
});
