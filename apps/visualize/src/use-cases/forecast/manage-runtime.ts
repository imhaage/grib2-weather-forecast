interface ForecastAnimationPlayer {
  isPlaying: () => boolean;
  stopPlayer: () => void;
  syncPlayButtonAvailability: () => void;
}

interface ForecastAnimationService {
  currentRenderGeneration: number;
  getDiagnostics: () => unknown;
  invalidateBitmapCache: () => void;
  isAnimationCacheReadyForPlayback: () => boolean;
  isBitmapCacheComplete: () => boolean;
  queueCurrentTooltipValueHydration: () => void;
  resetDecoding: () => void;
  showHour: (index: number) => Promise<unknown> | unknown;
  updateWarmupProgress: () => void;
}

interface ForecastRuntimeModelState {
  packageKey?: string;
  showWindDirection?: boolean;
  [key: string]: unknown;
}

interface DownloadWorkerClient {
  post: (
    message: { filesize?: number | null; url: string },
    transferables?: Transferable[],
    options?: { onProgress?: (progress: { loaded: number; total: number }) => void },
  ) => Promise<{ buffer?: ArrayBuffer } | null>;
}

export interface CreateForecastRuntimeUseCaseOptions {
  animationService: ForecastAnimationService;
  buildAnimationCacheAfterNetworkSettles: (session: unknown) => Promise<unknown>;
  beginResourceRefresh: () => unknown;
  configureModelVariableControls: (pkg: unknown) => void;
  createModelBlockServiceClient: () => unknown;
  createModelState: (packageKey: string) => ForecastRuntimeModelState;
  createDownloadWorkerClient: () => DownloadWorkerClient;
  downloadInitialForecast: (request: {
    packageKey: string;
    pkg: unknown;
    downloadKey: unknown;
  }) => Promise<unknown | null>;
  downloadWorkerProxyUrl: (url: string) => string;
  getSelectedHourIndex: () => number;
  getPackage: (packageKey: string) => unknown;
  isResourceRefreshActive: (downloadKey: unknown) => boolean;
  mapRenderer: {
    setVisible: (visible: boolean) => void;
  };
  refreshCurrentResourcesToLatest: (downloadKey: unknown) => Promise<unknown | null>;
  refreshWindSymbolOverlay: () => void;
  resetDownloadView: () => void;
  resetForecastHourControl: () => void;
  resetRuntimePresentation: () => void;
  selectVariable: (varKey: string) => void;
  setRendering: (rendering: boolean) => void;
  setGridState: (gridState: unknown) => void;
  syncWindDirectionControl: () => void;
  waitForNextFrame: () => Promise<unknown>;
}

export function createForecastRuntimeUseCase({
  animationService,
  buildAnimationCacheAfterNetworkSettles,
  beginResourceRefresh,
  configureModelVariableControls,
  createModelBlockServiceClient,
  createModelState,
  createDownloadWorkerClient,
  downloadInitialForecast,
  downloadWorkerProxyUrl,
  getSelectedHourIndex,
  getPackage,
  isResourceRefreshActive,
  mapRenderer,
  refreshCurrentResourcesToLatest,
  refreshWindSymbolOverlay,
  resetDownloadView,
  resetForecastHourControl,
  resetRuntimePresentation,
  selectVariable,
  setRendering,
  setGridState,
  syncWindDirectionControl,
  waitForNextFrame,
}: CreateForecastRuntimeUseCaseOptions) {
  const runtimeState: {
    animationPlayer: ForecastAnimationPlayer | null;
    downloadWorkerClient: DownloadWorkerClient | null;
    modelBlockService: unknown;
    modelState: ForecastRuntimeModelState | null;
  } = {
    modelState: null,
    modelBlockService: null,
    downloadWorkerClient: null,
    animationPlayer: null,
  };

  function getModelState() {
    return runtimeState.modelState;
  }

  function getModelBlockService() {
    if (!runtimeState.modelBlockService) {
      runtimeState.modelBlockService = createModelBlockServiceClient();
    }

    return runtimeState.modelBlockService;
  }

  function initDownloadWorker() {
    if (runtimeState.downloadWorkerClient) {
      return;
    }

    runtimeState.downloadWorkerClient = createDownloadWorkerClient();
  }

  async function downloadFileInWorker(
    url: string,
    filesize: number | null | undefined,
    onProgress: (loaded: number, total: number) => void,
  ) {
    initDownloadWorker();
    const result = await runtimeState.downloadWorkerClient?.post({ url, filesize }, [], {
      onProgress: ({ loaded, total }) => onProgress(loaded, total),
    });

    if (!result?.buffer) {
      throw new Error("Download failed");
    }

    return new Uint8Array(result.buffer);
  }

  async function downloadFileWithProgress(
    url: string,
    filesize: number | null | undefined,
    onProgress: (loaded: number, total: number) => void,
  ) {
    return downloadFileInWorker(downloadWorkerProxyUrl(url), filesize, onProgress);
  }

  function stopPlayer() {
    runtimeState.animationPlayer?.stopPlayer();
  }

  function syncPlayButtonAvailability() {
    runtimeState.animationPlayer?.syncPlayButtonAvailability();
  }

  function isPlayerPlaying() {
    return Boolean(runtimeState.animationPlayer?.isPlaying());
  }

  async function startDownload(packageKey: string) {
    const pkg = getPackage(packageKey);
    runtimeState.modelState = createModelState(packageKey);
    mapRenderer.setVisible(false);
    const downloadKey = beginResourceRefresh();

    configureModelVariableControls(pkg);
    resetForecastHourControl();

    const session = await downloadInitialForecast({
      packageKey,
      pkg,
      downloadKey,
    });

    if (!session) {
      return;
    }

    animationService.updateWarmupProgress();

    await buildAnimationCacheAfterNetworkSettles(session);
  }

  async function refreshCurrentModelVisuals() {
    const downloadKey = beginResourceRefresh();
    stopPlayer();
    await waitForNextFrame();
    setRendering(false);
    animationService.invalidateBitmapCache();
    const capturedRenderGeneration = animationService.currentRenderGeneration;
    await animationService.showHour(getSelectedHourIndex());
    const session = await refreshCurrentResourcesToLatest(downloadKey);

    if (
      session &&
      animationService.currentRenderGeneration === capturedRenderGeneration &&
      isResourceRefreshActive(downloadKey)
    ) {
      await buildAnimationCacheAfterNetworkSettles(session);
    }
  }

  async function handleVariableChange(varKey: string) {
    if (!runtimeState.modelState) {
      return;
    }

    selectVariable(varKey);
    syncWindDirectionControl();
    await refreshCurrentModelVisuals();
  }

  function setWindDirectionVisible(visible: boolean) {
    if (!runtimeState.modelState) {
      return;
    }

    runtimeState.modelState.showWindDirection = Boolean(visible);
    syncWindDirectionControl();
    refreshWindSymbolOverlay();
  }

  function onForecastSliderInput() {
    if (!runtimeState.modelState) {
      return;
    }

    animationService.showHour(getSelectedHourIndex());
  }

  function resetModelState() {
    stopPlayer();
    animationService.invalidateBitmapCache();
    setRendering(false);
    runtimeState.modelState = null;
    animationService.resetDecoding();
    setGridState(null);
    animationService.updateWarmupProgress();
    resetRuntimePresentation();
    resetDownloadView();
  }

  const api = {
    getDiagnostics: animationService.getDiagnostics,
    getModelState,
    getPackageKey: () => runtimeState.modelState?.packageKey ?? null,
    handleVariableChange,
    hasModelState: () => Boolean(runtimeState.modelState),
    isAnimationCacheReadyForPlayback: animationService.isAnimationCacheReadyForPlayback,
    isBitmapCacheComplete: animationService.isBitmapCacheComplete,
    onForecastSliderInput,
    queueCurrentTooltipValueHydration: animationService.queueCurrentTooltipValueHydration,
    refreshCurrentModelVisuals,
    resetModelState,
    setAnimationPlayer(player: ForecastAnimationPlayer) {
      runtimeState.animationPlayer = player;
      animationService.updateWarmupProgress();
    },
    setWindDirectionVisible,
    showHour: animationService.showHour,
    startDownload,
  };

  const runtimePorts = {
    downloadFileWithProgress,
    getModelBlockService,
    isPlayerPlaying,
    syncPlayButtonAvailability,
  };

  return {
    api,
    runtimePorts,
  };
}
