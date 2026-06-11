import { createDataGouvResourceService } from "../adapters/forecast/data-gouv-resource-adapter";
import {
  deleteObsoleteCachedGribBlocks,
  readCachedGribBlock,
  readLatestCachedGribBlock,
  writeCachedGribBlock,
} from "../adapters/forecast/grib-cache-adapter";
import { buildHourList, markBlockAvailable } from "../domain/forecast-state.js";
import {
  BLOCK_STATUS,
  type BlockStatus,
  type ForecastRunState,
  type RemoteResource,
} from "../domain/forecast-types";
import { formatRunSummary } from "../domain/resources.js";
import type { ForecastDownloadSession, ForecastRefreshKey } from "../use-cases/forecast/contracts";
import { createForecastPackageResourceService } from "../use-cases/forecast/fetch-package-resources";
import { createForecastResourceLoadUseCase } from "../use-cases/forecast/load-resources";
import { createForecastDownloadSessionService } from "../use-cases/forecast/manage-download-session";
import { createForecastPresentationQueueService } from "../use-cases/forecast/manage-presentation-queue";
import { createForecastDownloadPreparationUseCase } from "../use-cases/forecast/prepare-download-session";
import type { createForecastMapPresentationUseCase } from "../use-cases/forecast/present-map";
import { createForecastBlockRefreshUseCase } from "../use-cases/forecast/refresh-blocks";
import type { ForecastAnimationPort } from "../use-cases/forecast/runtime-contracts";
import { createForecastInitialDownloadUseCase } from "../use-cases/forecast/start-initial-download";
import { createForecastAvailableBlockUseCase } from "../use-cases/forecast/store-available-block";
import { createForecastResourceUpdateUseCase } from "../use-cases/forecast/update-resources";
import type {
  ForecastDataStatusSummaryView,
  ForecastDownloadView,
  ForecastHourControlView,
} from "./forecast-runtime-composition-contracts";

const PROXY = "https://grib2-cors-proxy.imh.workers.dev";
const MAX_PARALLEL_DOWNLOADS = 6;

type ForecastMapPresenter = ReturnType<typeof createForecastMapPresentationUseCase>;

interface CreateForecastDownloadRuntimeOptions {
  animationService: ForecastAnimationPort;
  dataStatusSummaryView: ForecastDataStatusSummaryView;
  downloadFile: (
    url: string,
    filesize: number | null | undefined,
    onProgress: (loaded: number, total: number) => void,
  ) => Promise<Uint8Array>;
  fetchImpl?: NonNullable<Parameters<typeof createDataGouvResourceService>[0]["fetchImpl"]>;
  forecastDownloadView: ForecastDownloadView;
  forecastHourControlView: ForecastHourControlView;
  getModelBlockService: () => {
    storeBlock(block: RemoteResource, buffer: Uint8Array): Promise<boolean>;
  };
  getModelState: () => ForecastRunState | null;
  initializeLegendFromBlock: (
    buffer: Uint8Array,
    context: {
      modelState: ForecastRunState;
      session: ForecastDownloadSession;
    },
  ) => boolean;
  isRefreshActive: (downloadKey: ForecastRefreshKey) => boolean;
  presentAvailableMapBlock: ForecastMapPresenter["presentAvailableBlock"];
  scheduleLowPriorityWork: () => Promise<void>;
  updateStorageWarningSizeIfOpen?: () => void;
}

export function createForecastDownloadRuntime({
  animationService,
  dataStatusSummaryView,
  downloadFile,
  fetchImpl,
  forecastDownloadView,
  forecastHourControlView,
  getModelBlockService,
  getModelState,
  initializeLegendFromBlock,
  isRefreshActive,
  presentAvailableMapBlock,
  scheduleLowPriorityWork,
  updateStorageWarningSizeIfOpen,
}: CreateForecastDownloadRuntimeOptions) {
  function requiredModelState() {
    const modelState = getModelState();

    if (!modelState) {
      throw new Error("Forecast model state is required");
    }

    return modelState;
  }

  function updateDataStatusSummary() {
    const modelState = getModelState();

    if (!modelState?.resources.length) {
      return;
    }

    dataStatusSummaryView.render(modelState.resources);
  }

  function setBlockStatus(block: RemoteResource, status: BlockStatus) {
    block.status = status;
    getModelState()?.blockStatus.set(block.key, status);
    forecastDownloadView.setBlockStatus(block, status);
    updateDataStatusSummary();
  }

  function setBlockDownloadProgress(block: RemoteResource, progress: string) {
    forecastDownloadView.setBlockDownloadProgress(block, progress);
  }

  function resetBlockDownloadProgress(block: RemoteResource) {
    forecastDownloadView.resetBlockDownloadProgress(block);
  }

  function applyModelResources(resources: RemoteResource[]) {
    const modelState = requiredModelState();
    modelState.resources = resources;
    modelState.hourList = buildHourList(resources);
    forecastHourControlView.renderHourList(modelState.hourList);
  }

  const downloadSessionService = createForecastDownloadSessionService({
    missingStatus: BLOCK_STATUS.MISSING,
  });

  function resetResourceStatuses(resources: RemoteResource[]) {
    downloadSessionService.resetResourceStatuses(resources, getModelState() ?? undefined);
    updateDataStatusSummary();
  }

  function isModelBlockInMemoryCurrent(block: RemoteResource, previousBlock?: RemoteResource) {
    return downloadSessionService.isBlockInMemoryCurrent(requiredModelState(), {
      block,
      previousBlock,
    });
  }

  function isModelBlockInMemoryStale(block: RemoteResource, previousBlock?: RemoteResource) {
    return downloadSessionService.isBlockInMemoryStale(requiredModelState(), {
      block,
      previousBlock,
    });
  }

  function updateAvailableFileCount(session: ForecastDownloadSession) {
    forecastDownloadView.setStatus(downloadSessionService.fileCountStatus(session));
  }

  function completeModelDownloadIfReady(session: ForecastDownloadSession) {
    if (session.availableCount !== session.resources.length) {
      return;
    }

    updateAvailableFileCount(session);
  }

  const availableBlockUseCase = createForecastAvailableBlockUseCase({
    incrementAvailableCount: downloadSessionService.incrementAvailableCount,
    invalidateBlockRenderCache: animationService.invalidateBlockRenderCache,
    markBlockAvailable,
    setBlockStatus,
    storeBlock: (block, buffer) => getModelBlockService().storeBlock(block, buffer),
  });

  function markInMemoryModelBlockAvailable(
    block: RemoteResource,
    status: BlockStatus,
    session: ForecastDownloadSession,
  ) {
    setBlockStatus(block, status);
    setBlockDownloadProgress(block, "100%");
    downloadSessionService.incrementAvailableCount(session);
    updateAvailableFileCount(session);
    completeModelDownloadIfReady(session);
  }

  async function storeAvailableModelBlock(
    block: RemoteResource,
    buffer: Uint8Array,
    status: BlockStatus,
    session: ForecastDownloadSession,
  ) {
    const storedInWorker = await availableBlockUseCase.storeAvailableBlock({
      block,
      buffer,
      session,
      state: requiredModelState(),
      status,
    });

    if (!storedInWorker) {
      return;
    }

    setBlockDownloadProgress(block, "100%");
    updateAvailableFileCount(session);
  }

  async function presentAvailableModelBlock(
    block: RemoteResource,
    buffer: Uint8Array,
    status: BlockStatus,
    session: ForecastDownloadSession,
  ) {
    if (!isRefreshActive(session.downloadKey)) {
      return;
    }

    initializeLegendFromBlock(buffer, {
      modelState: requiredModelState(),
      session,
    });
    await storeAvailableModelBlock(block, buffer, status, session);

    if (!isRefreshActive(session.downloadKey)) {
      return;
    }

    await presentAvailableMapBlock(block, session, {
      isRefreshActive,
      selectedHourIndex: forecastHourControlView.selectedIndex,
      showHour: animationService.showHour,
    });
    completeModelDownloadIfReady(session);
  }

  async function writeCachedModelBlock(
    packageKey: string,
    block: RemoteResource,
    buffer: Uint8Array,
  ) {
    const cacheWriteSucceeded = await writeCachedGribBlock(packageKey, block, buffer);

    if (cacheWriteSucceeded) {
      updateStorageWarningSizeIfOpen?.();
    }

    return cacheWriteSucceeded;
  }

  const presentationQueueService = createForecastPresentationQueueService({
    readyStatus: BLOCK_STATUS.READY,
    isSessionActive: (session) => isRefreshActive(session.downloadKey),
    presentAvailableBlock: presentAvailableModelBlock,
    scheduleLowPriorityWork,
  });
  const blockRefreshService = createForecastBlockRefreshUseCase({
    statuses: BLOCK_STATUS,
    maxParallelDownloads: MAX_PARALLEL_DOWNLOADS,
    cache: {
      readCachedBlock: readCachedGribBlock,
      readLatestCachedBlock: readLatestCachedGribBlock,
      writeCachedBlock: writeCachedModelBlock,
      deleteObsoleteCachedBlocks: deleteObsoleteCachedGribBlocks,
    },
    lifecycle: {
      isRefreshActive,
      isBlockInMemoryCurrent: isModelBlockInMemoryCurrent,
      isBlockInMemoryStale: isModelBlockInMemoryStale,
    },
    network: {
      downloadFile,
    },
    presentation: {
      enqueueAvailableBlock: presentationQueueService.enqueueAvailableBlock,
      waitForPresentationIdle: presentationQueueService.waitForIdle,
    },
    status: {
      markInMemoryBlockAvailable: markInMemoryModelBlockAvailable,
      setBlockStatus,
      resetBlockDownloadProgress,
      setBlockDownloadProgress,
    },
  });
  const dataGouvResourceService = createDataGouvResourceService({
    proxyBaseUrl: PROXY,
    fetchImpl,
  });
  const packageResourceService = createForecastPackageResourceService({
    fetchResources: dataGouvResourceService.fetchResources,
    isRefreshActive,
  });
  const resourceLoadUseCase = createForecastResourceLoadUseCase({
    fetchPackageResources: packageResourceService.fetchPackageResources,
    isRefreshActive,
    setStatus: forecastDownloadView.setStatus,
  });
  const downloadPreparationUseCase = createForecastDownloadPreparationUseCase({
    applyResources: applyModelResources,
    createSession: downloadSessionService.createSession,
    formatRunSummary,
    renderItems: forecastDownloadView.renderItems,
    resetResourceStatuses,
  });
  const resourceUpdateUseCase = createForecastResourceUpdateUseCase({
    isRefreshActive,
    loadPackageResources: resourceLoadUseCase.loadPackageResources,
    prepareSession: downloadPreparationUseCase.prepareSession,
    refreshBlocksToLatest: blockRefreshService.refreshBlocksToLatest,
    refreshStatus: downloadSessionService.refreshStatus,
    setStatus: forecastDownloadView.setStatus,
  });
  const initialDownloadUseCase = createForecastInitialDownloadUseCase({
    downloadStatus: downloadSessionService.downloadStatus,
    isRefreshActive,
    loadPackageResources: resourceLoadUseCase.loadPackageResources,
    prepareSession: downloadPreparationUseCase.prepareSession,
    refreshBlocksToLatest: blockRefreshService.refreshBlocksToLatest,
    setStatus: forecastDownloadView.setStatus,
  });

  return {
    downloadInitialForecast: initialDownloadUseCase.startInitialDownload,
    downloadWorkerProxyUrl: dataGouvResourceService.proxyResourceUrl,
    refreshCurrentResourcesToLatest: resourceUpdateUseCase.refreshCurrentResourcesToLatest,
  };
}
