export type ForecastAnimationCacheStatus = "waiting" | "building" | "ready";

export interface ForecastAnimationCacheState {
  animationCacheStatus: ForecastAnimationCacheStatus;
}

export interface ForecastRefreshSession {
  downloadKey: unknown;
}

export interface ForecastAnimationCacheBuildPorts {
  getModelState(): ForecastAnimationCacheState;
  isBitmapCacheComplete(): boolean;
  isRefreshActive(downloadKey: unknown): boolean;
  queuePrerenderForAllBlocks(): void;
  updateWarmupProgress(): void;
  waitForPrerenderIdle(): Promise<void>;
}

export interface ForecastResourceRefreshState {
  resourceRefreshId?: number;
}

export interface ForecastResourceRefreshKey {
  state: ForecastResourceRefreshState;
  refreshId: number;
}

export type ForecastPackageLike = object;

export interface ForecastResourceLike {
  [key: string]: unknown;
}

export interface ForecastDownloadSessionLike {
  [key: string]: unknown;
}

export interface ForecastInitialDownloadRequest {
  packageKey: string;
  pkg: ForecastPackageLike;
  downloadKey: unknown;
}

export interface ForecastResourceLoadRequest {
  packageKey: string;
  downloadKey: unknown;
  loadingStatus: string;
}

export interface ForecastSessionPreparationRequest {
  packageKey: string;
  pkg: ForecastPackageLike;
  resources: ForecastResourceLike[];
  downloadKey: unknown;
}

export interface ForecastInitialDownloadPorts {
  downloadStatus(session: ForecastDownloadSessionLike): string;
  isRefreshActive(downloadKey: unknown): boolean;
  loadPackageResources(
    request: ForecastResourceLoadRequest,
  ): Promise<ForecastResourceLike[] | null>;
  prepareSession(request: ForecastSessionPreparationRequest): ForecastDownloadSessionLike;
  refreshBlocksToLatest(session: ForecastDownloadSessionLike): Promise<boolean>;
  setStatus(status: string): void;
}

export interface ForecastDownloadPreparationPorts {
  applyResources(resources: ForecastResourceLike[]): void;
  createSession(
    request: ForecastSessionPreparationRequest & {
      runSummary: string;
    },
  ): ForecastDownloadSessionLike;
  formatRunSummary(resources: ForecastResourceLike[]): string;
  renderItems(resources: ForecastResourceLike[]): void;
  resetResourceStatuses(resources: ForecastResourceLike[]): void;
}

export interface ForecastResourceUpdateState {
  packageKey: string;
  resources: ForecastResourceLike[];
}

export interface ForecastResourceUpdateKey {
  state: ForecastResourceUpdateState;
}

export interface ForecastResourceUpdatePorts {
  isRefreshActive(downloadKey: ForecastResourceUpdateKey): boolean;
  loadPackageResources(
    request: ForecastResourceLoadRequest,
  ): Promise<ForecastResourceLike[] | null>;
  packages: Record<string, ForecastPackageLike>;
  prepareSession(request: ForecastSessionPreparationRequest): ForecastDownloadSessionLike;
  refreshBlocksToLatest(
    session: ForecastDownloadSessionLike,
    options: {
      previousResources: ForecastResourceLike[];
    },
  ): Promise<boolean>;
  refreshStatus(session: ForecastDownloadSessionLike): string;
  setStatus(status: string): void;
}

export interface ForecastResourceLoadPorts {
  fetchPackageResources(
    packageKey: string,
    downloadKey: unknown,
  ): Promise<ForecastResourceLike[] | null>;
  isRefreshActive(downloadKey: unknown): boolean;
  setStatus(status: string): void;
}

export interface ForecastBlockLike {
  key: string;
  [key: string]: unknown;
}

export interface ForecastAvailableBlockState {
  availableBlocks: Set<string>;
}

export interface ForecastAvailableBlockSession {
  availableCount: number;
  [key: string]: unknown;
}

export interface ForecastAvailableBlockStoreRequest {
  block: ForecastBlockLike;
  buffer: Uint8Array;
  session: ForecastAvailableBlockSession;
  state: ForecastAvailableBlockState;
  status: string;
}

export interface ForecastAvailableBlockPorts {
  incrementAvailableCount(session: ForecastAvailableBlockSession): void;
  invalidateBlockRenderCache(block: ForecastBlockLike): void;
  markBlockAvailable(state: ForecastAvailableBlockState, block: ForecastBlockLike): void;
  setBlockStatus(block: ForecastBlockLike, status: string): void;
  storeBlock(block: ForecastBlockLike, buffer: Uint8Array): Promise<boolean>;
}

export interface ForecastVariableDefinition {
  shortName: string;
  varKey?: string;
  name: string;
  units?: string;
  levelValue?: number | null;
}

export interface ForecastVariableSelectionState {
  packageKey?: string | null;
  variable?: string | null;
  showWindDirection?: boolean;
}

export interface ForecastVariableSelectionPorts {
  applyDefaultPalette(variableKey: string): void;
  findPackageVariable?(
    packageKey: string | null | undefined,
    variableKey: string,
  ): ForecastVariableDefinition | undefined;
  formatModelPackageSubtitle(packageKey: string | null | undefined): string;
  parameterDescriptionFor?(shortName: string): string;
  updateLevelInfo(variableDefinition: ForecastVariableDefinition | undefined): void;
  updateParamInfo(name: string, description: string, subtitle: string): void;
}

export interface ForecastLegendState {
  packageKey: string;
  variable: string;
  lastRunInfo?: string | null;
}

export interface ForecastLegendSession {
  legendInitialized?: boolean;
  packageKey: string;
}

export interface ForecastLegendMessage {
  header: unknown;
  product?: {
    shortName?: string;
    name: string;
    units?: string;
    levelValue?: number | null;
  };
}

export interface ForecastStaticScale {
  min: number;
  max: number;
  log?: boolean;
}

export interface ForecastLegendInitializerPorts {
  applyDefaultPalette(variableKey: string): void;
  displayUnitsFor(shortName: string, units: string | undefined): string;
  findPackageVariable(
    packageKey: string,
    variableKey: string,
  ): ForecastVariableDefinition | undefined;
  formatModelPackageSubtitle(packageKey: string): string;
  formatRefTime(header: unknown): string;
  iterateMessages(buffer: Uint8Array): Iterable<ForecastLegendMessage>;
  parameterDescriptionFor(shortName: string): string;
  showColorScale(
    min: number,
    max: number,
    units: string,
    options: {
      isLog: boolean;
    },
  ): void;
  staticScaleFor(shortName: string): ForecastStaticScale | null | undefined;
  updateLevelInfo(variableDefinition: ForecastVariableDefinition | undefined): void;
  updateParamInfo(name: string, description: string, subtitle: string): void;
}
