import { describe, expect, test, vi } from "vitest";
import {
  makeForecastDownloadSession,
  makeForecastPackage,
  makeForecastRefreshKey,
  makeForecastRunState,
} from "./forecast-test-fixtures";
import {
  type CreateForecastRuntimeUseCaseOptions,
  createForecastRuntimeUseCase,
} from "./manage-runtime";

function createRuntime(overrides: Partial<CreateForecastRuntimeUseCaseOptions> = {}) {
  const ports = {
    animationService: {
      currentRenderGeneration: 0,
      bitmapCacheReadyCount: vi.fn(() => 0),
      getDiagnostics: vi.fn(() => ({
        currentRenderGeneration: 0,
        isPrerendering: false,
        lastDecodeMs: null,
        lastRenderMs: null,
        queueLength: 0,
        readyBitmaps: 0,
        totalBitmaps: 0,
      })),
      invalidateBitmapCache: vi.fn(),
      invalidateBlockRenderCache: vi.fn(),
      isAnimationCacheReadyForPlayback: vi.fn(() => false),
      isBitmapCacheComplete: vi.fn(() => false),
      queueCurrentTooltipValueHydration: vi.fn(),
      queuePrerenderBlock: vi.fn(),
      queuePrerenderForAllBlocks: vi.fn(),
      resetDecoding: vi.fn(),
      showHour: vi.fn(async () => {}),
      updateWarmupProgress: vi.fn(),
      waitForPrerenderIdle: vi.fn(async () => {}),
    },
    buildAnimationCacheAfterNetworkSettles: vi.fn(async () => {}),
    beginResourceRefresh: vi.fn(() => makeForecastRefreshKey()),
    configureModelVariableControls: vi.fn(),
    createModelBlockServiceClient: vi.fn(() => ({
      decodeValues: vi.fn(),
      renderHour: vi.fn(),
      storeBlock: vi.fn(),
    })),
    createModelState: vi.fn((packageKey) => makeForecastRunState({ packageKey })),
    createDownloadWorkerClient: vi.fn(() => ({
      post: vi.fn(async () => ({ buffer: new Uint8Array([1]).buffer })),
    })),
    downloadInitialForecast: vi.fn(async () => makeForecastDownloadSession()),
    downloadWorkerProxyUrl: vi.fn((url) => `proxy:${url}`),
    getSelectedHourIndex: vi.fn(() => 0),
    getPackage: vi.fn(() => makeForecastPackage()),
    isResourceRefreshActive: vi.fn(() => true),
    mapRenderer: {
      setVisible: vi.fn(),
    },
    refreshCurrentResourcesToLatest: vi.fn(async () => null),
    refreshWindSymbolOverlay: vi.fn(),
    resetDownloadView: vi.fn(),
    resetForecastHourControl: vi.fn(),
    resetRuntimePresentation: vi.fn(),
    selectVariable: vi.fn(),
    setRendering: vi.fn(),
    setGridState: vi.fn(),
    syncWindDirectionControl: vi.fn(),
    waitForNextFrame: vi.fn(async () => {}),
    ...overrides,
  } satisfies CreateForecastRuntimeUseCaseOptions;
  const runtime = createForecastRuntimeUseCase(ports);

  return {
    ports,
    runtime,
    async startDownload(packageKey = "AROME_SP1") {
      await runtime.api.startDownload(packageKey);

      return runtime.api.getModelState();
    },
  };
}

describe("forecast runtime use case", () => {
  test("exposes api and explicit factory-facing runtime ports", () => {
    const { runtime } = createRuntime();

    expect(runtime.api).toEqual(expect.any(Object));
    expect(runtime.runtimePorts).toEqual({
      downloadFileWithProgress: expect.any(Function),
      getModelBlockService: expect.any(Function),
      isPlayerPlaying: expect.any(Function),
      syncPlayButtonAvailability: expect.any(Function),
    });
    expect("internals" in runtime).toBe(false);
  });

  test("setAnimationPlayer updates warmup progress", async () => {
    const { ports, runtime, startDownload } = createRuntime();
    await startDownload();
    vi.mocked(ports.animationService.updateWarmupProgress).mockClear();

    runtime.api.setAnimationPlayer({
      isPlaying: vi.fn(() => false),
      stopPlayer: vi.fn(),
      syncPlayButtonAvailability: vi.fn(),
    });

    expect(ports.animationService.updateWarmupProgress).toHaveBeenCalledOnce();
  });

  test("setWindDirectionVisible changes runtime state and refreshes wind overlay", async () => {
    const { ports, runtime, startDownload } = createRuntime();
    await startDownload();

    runtime.api.setWindDirectionVisible(false);

    expect(runtime.api.getModelState()?.showWindDirection).toBe(false);
    expect(ports.syncWindDirectionControl).toHaveBeenCalledOnce();
    expect(ports.refreshWindSymbolOverlay).toHaveBeenCalledOnce();
  });

  test("resetModelState clears runtime state and calls reset ports", async () => {
    const { ports, runtime, startDownload } = createRuntime();
    const player = {
      isPlaying: vi.fn(() => true),
      stopPlayer: vi.fn(),
      syncPlayButtonAvailability: vi.fn(),
    };
    await startDownload();
    runtime.api.setAnimationPlayer(player);
    vi.mocked(ports.animationService.updateWarmupProgress).mockClear();

    runtime.api.resetModelState();

    expect(runtime.api.getModelState()).toBeNull();
    expect(player.stopPlayer).toHaveBeenCalledOnce();
    expect(ports.animationService.invalidateBitmapCache).toHaveBeenCalledOnce();
    expect(ports.setRendering).toHaveBeenCalledWith(false);
    expect(ports.animationService.resetDecoding).toHaveBeenCalledOnce();
    expect(ports.setGridState).toHaveBeenCalledWith(null);
    expect(ports.animationService.updateWarmupProgress).toHaveBeenCalledOnce();
    expect(ports.resetRuntimePresentation).toHaveBeenCalledOnce();
    expect(ports.resetDownloadView).toHaveBeenCalledOnce();
  });
});
