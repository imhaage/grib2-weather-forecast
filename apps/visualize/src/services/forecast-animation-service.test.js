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
    getSelectedHourIndex: () => Number.parseInt(dom.forecastSlider.value, 10),
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
    renderForecastHourLabel: (label) => {
      dom.forecastHourLabel.textContent = label;
    },
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

  test("renders hour labels through an injected view port", async () => {
    const renderForecastHourLabel = vi.fn();
    const { service } = createService({
      dom: undefined,
      getSelectedHourIndex: () => 0,
      getModelBlockService: () => ({
        decodeValues: vi.fn(),
        renderHour: vi.fn(async () => ({
          bitmap: {},
          dataMin: 1,
          dataMax: 2,
          dataMean: 1.5,
          dataCount: 2,
          displayUnits: "K",
          grid: {},
          header: {},
          product: { shortName: "t" },
          values: new Float32Array([1, 2]),
        })),
      }),
      renderForecastHourLabel,
    });

    await service.showHour(0);

    expect(renderForecastHourLabel).toHaveBeenCalledWith("+01H");
  });
});
