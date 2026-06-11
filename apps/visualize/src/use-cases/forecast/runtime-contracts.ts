import type {
  ForecastPackage,
  ForecastRunState,
  RemoteResource,
} from "../../domain/forecast-types";
import type {
  ModelBlockDecodeValuesResult,
  ModelBlockRenderRequest,
  ModelBlockRenderResult,
} from "../../workers/model-block-worker-contracts";
import type { ForecastDownloadSession, ForecastRefreshKey } from "./contracts";
import type { ForecastMapEntry, ForecastMapRendererPort } from "./map-contracts";

export interface ForecastModelBlockRenderPort {
  decodeValues(request: ModelBlockRenderRequest): Promise<ModelBlockDecodeValuesResult | null>;
  renderHour(request: ModelBlockRenderRequest): Promise<ModelBlockRenderResult | null>;
}

export interface ForecastModelBlockPort extends ForecastModelBlockRenderPort {
  storeBlock(block: RemoteResource, buffer: Uint8Array): Promise<boolean>;
}

export type ForecastBitmapCacheEntry = ForecastMapEntry;

export interface ForecastPrerenderJob {
  blockKey: string;
  queueKey: string;
  renderGeneration: number;
  state: ForecastRunState;
}

export interface ForecastAnimationCachePort {
  readonly isPrerendering: boolean;
  readonly queueLength: number;
  readonly size: number;
  beginDrain(): boolean;
  clear(): void;
  completeJob(job: ForecastPrerenderJob): void;
  endDrain(): void;
  enqueueBlock(blockKey: string, renderGeneration: number, state: ForecastRunState): boolean;
  getHour(hour: number): ForecastBitmapCacheEntry | undefined;
  hasHour(hour: number): boolean;
  isComplete(hours?: number[]): boolean;
  keyForHour(hour: number): string;
  nextJob(): ForecastPrerenderJob | null;
  readyCount(hours?: number[]): number;
  removeHour(hour: number): void;
  setHour(hour: number, entry: ForecastBitmapCacheEntry): void;
  waitForIdle(): Promise<void>;
}

export interface ForecastAnimationDiagnostics {
  currentRenderGeneration: number;
  isPrerendering: boolean;
  lastDecodeMs: number | null;
  lastRenderMs: number | null;
  queueLength: number;
  readyBitmaps: number;
  totalBitmaps: number;
}

export interface ForecastWarmupProgress {
  hidden: boolean;
  isReady: boolean;
  isWaiting: boolean;
  label: string;
  percent: number;
  ready: number;
  total: number;
}

export interface ForecastAnimationPort {
  readonly currentRenderGeneration: number;
  bitmapCacheReadyCount(): number;
  getDiagnostics(): ForecastAnimationDiagnostics;
  invalidateBitmapCache(): void;
  invalidateBlockRenderCache(block: RemoteResource | null | undefined): void;
  isAnimationCacheReadyForPlayback(): boolean;
  isBitmapCacheComplete(): boolean;
  queueCurrentTooltipValueHydration(): void;
  queuePrerenderBlock(blockKey: string): void;
  queuePrerenderForAllBlocks(): void;
  resetDecoding(): void;
  showHour(index: number): Promise<void>;
  updateWarmupProgress(): void;
  waitForPrerenderIdle(): Promise<void>;
}

export type ForecastPrerenderQueuePort = Pick<
  ForecastAnimationCachePort,
  "beginDrain" | "completeJob" | "endDrain" | "nextJob" | "queueLength"
>;

export interface ForecastAnimationPlayerPort {
  isPlaying(): boolean;
  stopPlayer(): void;
  syncPlayButtonAvailability(): void;
}

export interface ForecastDownloadWorkerResult {
  buffer?: ArrayBuffer;
}

export interface ForecastDownloadWorkerPort {
  post(
    message: { filesize?: number | null; url: string },
    transferables?: Transferable[],
    options?: { onProgress?: (progress: { loaded: number; total: number }) => void },
  ): Promise<ForecastDownloadWorkerResult | null>;
}

export interface ForecastRuntimeState {
  animationPlayer: ForecastAnimationPlayerPort | null;
  downloadWorkerClient: ForecastDownloadWorkerPort | null;
  modelBlockService: ForecastModelBlockPort | null;
  modelState: ForecastRunState | null;
}

export interface ForecastRuntimeApi {
  getDiagnostics(): ForecastAnimationDiagnostics;
  getModelState(): ForecastRunState | null;
  getPackageKey(): string | null;
  handleVariableChange(varKey: string): Promise<void>;
  hasModelState(): boolean;
  isAnimationCacheReadyForPlayback(): boolean;
  isBitmapCacheComplete(): boolean;
  onForecastSliderInput(): void;
  queueCurrentTooltipValueHydration(): void;
  refreshCurrentModelVisuals(): Promise<void>;
  resetModelState(): void;
  setAnimationPlayer(player: ForecastAnimationPlayerPort): void;
  setWindDirectionVisible(visible: boolean): void;
  showHour(index: number): Promise<void>;
  startDownload(packageKey: string): Promise<void>;
}

export interface ForecastRuntimePorts {
  downloadFileWithProgress(
    url: string,
    filesize: number | null | undefined,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<Uint8Array>;
  getModelBlockService(): ForecastModelBlockPort;
  isPlayerPlaying(): boolean;
  syncPlayButtonAvailability(): void;
}

export interface ForecastRuntimeResult {
  api: ForecastRuntimeApi;
  runtimePorts: ForecastRuntimePorts;
}

export interface CreateForecastRuntimeUseCaseOptions {
  animationService: ForecastAnimationPort;
  buildAnimationCacheAfterNetworkSettles(session: ForecastDownloadSession): Promise<unknown>;
  beginResourceRefresh(): ForecastRefreshKey;
  configureModelVariableControls(pkg: ForecastPackage): void;
  createModelBlockServiceClient(): ForecastModelBlockPort;
  createModelState(packageKey: string): ForecastRunState;
  createDownloadWorkerClient(): ForecastDownloadWorkerPort;
  downloadInitialForecast(request: {
    packageKey: string;
    pkg: ForecastPackage;
    downloadKey: ForecastRefreshKey;
  }): Promise<ForecastDownloadSession | null>;
  downloadWorkerProxyUrl(url: string): string;
  getSelectedHourIndex(): number;
  getPackage(packageKey: string): ForecastPackage;
  isResourceRefreshActive(downloadKey: ForecastRefreshKey): boolean;
  mapRenderer: Pick<ForecastMapRendererPort, "setVisible">;
  refreshCurrentResourcesToLatest(
    downloadKey: ForecastRefreshKey,
  ): Promise<ForecastDownloadSession | null>;
  refreshWindSymbolOverlay(): void;
  resetDownloadView(): void;
  resetForecastHourControl(): void;
  resetRuntimePresentation(): void;
  selectVariable(varKey: string): void;
  setRendering(rendering: boolean): void;
  setGridState(gridState: unknown): void;
  syncWindDirectionControl(): void;
  waitForNextFrame(): Promise<unknown>;
}
