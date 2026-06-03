import { describe, expect, test, vi } from "vitest";
import { createForecastAnimationService } from "./forecast-animation-service.js";

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
  test("invalidates bitmap cache and exposes render diagnostics", () => {
    const { dom, modelState, service } = createService();

    service.invalidateBitmapCache();

    expect(modelState.animationCacheStatus).toBe("waiting");
    expect(dom.cacheWarmupLabel.textContent).toBe("Preparing animation cache");
    expect(service.getDiagnostics().currentRenderGeneration).toBe(1);
    expect(service.isBitmapCacheComplete()).toBe(false);
  });

  test("explains that cache generation waits for pending downloads", () => {
    const { dom, modelState, service } = createService();
    modelState.animationCacheStatus = "waiting";
    modelState.resources = [{ key: "01H" }, { key: "02H" }];
    modelState.availableBlocks = new Set(["01H"]);

    service.updateWarmupProgress();

    expect(dom.cacheWarmupLabel.textContent).toBe("Waiting for downloads");
  });
});
