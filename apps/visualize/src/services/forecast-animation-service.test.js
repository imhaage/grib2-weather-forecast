import { describe, expect, test, vi } from "vitest";
import {
  createForecastAnimationService,
  makeBitmapCacheEntryFromWorker,
} from "./forecast-animation-service.js";

function createDom() {
  return {
    cacheWarmup: { hidden: false, classList: { toggle: vi.fn() } },
    cacheWarmupBar: { style: { width: "" } },
    cacheWarmupCount: { textContent: "" },
    cacheWarmupLabel: { textContent: "" },
    forecastHourLabel: { textContent: "" },
    forecastSlider: { value: "0" },
  };
}

function createService(overrides = {}) {
  const modelState = {
    animationCacheStatus: "ready",
    availableBlocks: new Set(),
    hourList: [1, 2],
    resources: [],
  };
  const dom = createDom();
  const service = createForecastAnimationService({
    dom,
    getCurrentPalette: () => "Temperature",
    getGridState: () => null,
    getModelBlockService: () => ({
      decodeValues: vi.fn(),
      renderHour: vi.fn(),
    }),
    getModelState: () => modelState,
    isPlayerPlaying: () => false,
    makeGridState: (entry, values) => ({ entry, values }),
    missingValue: 9999,
    notifyDiagnostics: vi.fn(),
    presentBitmapEntry: vi.fn(),
    setGridState: vi.fn(),
    showUnavailableHour: vi.fn(),
    syncPlayButtonAvailability: vi.fn(),
    updateIsobarOverlay: vi.fn(),
    ...overrides,
  });
  return { dom, modelState, service };
}

describe("forecast animation service", () => {
  test("copies vector component values and optionally keeps speed values in bitmap cache entries", () => {
    const values = new Float32Array([1, 2]);
    const vectorUValues = new Float32Array([1, 2]);
    const vectorVValues = new Float32Array([3, 4]);
    const entry = makeBitmapCacheEntryFromWorker(
      {
        bitmap: {},
        values,
        vectorUValues,
        vectorVValues,
      },
      { keepValues: true },
    );

    expect(entry.values).toBe(values);
    expect(entry.vectorUValues).toBe(vectorUValues);
    expect(entry.vectorVValues).toBe(vectorVValues);
  });

  test("invalidates bitmap cache and exposes render diagnostics", () => {
    const renderWarmupProgress = vi.fn();
    const { modelState, service } = createService({ dom: undefined, renderWarmupProgress });

    service.invalidateBitmapCache();

    expect(modelState.animationCacheStatus).toBe("waiting");
    expect(renderWarmupProgress).toHaveBeenLastCalledWith({
      hidden: false,
      isReady: false,
      isWaiting: true,
      label: "Preparing animation cache",
      percent: 0,
      ready: 0,
      total: 2,
    });
    expect(service.getDiagnostics().currentRenderGeneration).toBe(1);
    expect(service.isBitmapCacheComplete()).toBe(false);
  });

  test("explains that cache generation waits for pending downloads", () => {
    const renderWarmupProgress = vi.fn();
    const { modelState, service } = createService({ dom: undefined, renderWarmupProgress });
    modelState.animationCacheStatus = "waiting";
    modelState.resources = [{ key: "01H" }, { key: "02H" }];
    modelState.availableBlocks = new Set(["01H"]);

    service.updateWarmupProgress();

    expect(renderWarmupProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: "Animation cache: waiting for downloads",
      }),
    );
  });

  test("keeps waiting for downloads while an available block is updating", () => {
    const renderWarmupProgress = vi.fn();
    const { modelState, service } = createService({ dom: undefined, renderWarmupProgress });
    modelState.animationCacheStatus = "waiting";
    modelState.resources = [
      { key: "01H", status: "loaded-from-cache" },
      { key: "02H", status: "downloading" },
    ];
    modelState.availableBlocks = new Set(["01H", "02H"]);

    service.updateWarmupProgress();

    expect(renderWarmupProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: "Animation cache: waiting for downloads",
      }),
    );
  });
});
