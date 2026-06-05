export function createForecastRuntime({
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
}) {
  const runtimeState = {
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
    if (runtimeState.downloadWorkerClient) return;
    runtimeState.downloadWorkerClient = createDownloadWorkerClient();
  }

  async function downloadFileInWorker(url, filesize, onProgress) {
    initDownloadWorker();
    const result = await runtimeState.downloadWorkerClient.post({ url, filesize }, [], {
      onProgress: ({ loaded, total }) => onProgress(loaded, total),
    });
    if (!result?.buffer) throw new Error("Download failed");
    return new Uint8Array(result.buffer);
  }

  async function downloadFileProg(url, filesize, onProgress) {
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

  async function startDownload(packageKey) {
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
    if (!session) return;
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

  async function handleVariableChange(varKey) {
    if (!runtimeState.modelState) return;
    selectVariable(varKey);
    syncWindDirectionControl();
    await refreshCurrentModelVisuals();
  }

  function setWindDirectionVisible(visible) {
    if (!runtimeState.modelState) return;
    runtimeState.modelState.showWindDirection = Boolean(visible);
    syncWindDirectionControl();
    refreshWindSymbolOverlay();
  }

  function onForecastSliderInput() {
    if (!runtimeState.modelState) return;
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
    setAnimationPlayer(player) {
      runtimeState.animationPlayer = player;
      animationService.updateWarmupProgress();
    },
    setWindDirectionVisible,
    showHour: animationService.showHour,
    startDownload,
  };

  const internals = {
    downloadFileProg,
    getModelBlockService,
    isPlayerPlaying,
    syncPlayButtonAvailability,
  };

  return {
    api,
    internals,
  };
}
