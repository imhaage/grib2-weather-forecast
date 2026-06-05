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

export interface ForecastPackageLike {
  [key: string]: unknown;
}

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

export interface ForecastVariableDefinition {
  shortName: string;
  varKey?: string;
  name: string;
  units?: string;
  levelValue?: number | null;
  [key: string]: unknown;
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
