import type {
  BlockStatus,
  ForecastPackage,
  ForecastRunState,
  ForecastVariable,
  RemoteResource,
} from "../../domain/forecast-types";
import type { ForecastDownloadSession, ForecastRefreshKey } from "./contracts";

export type ForecastAnimationCacheStatus = "waiting" | "building" | "ready";

export interface ForecastAnimationCacheState {
  animationCacheStatus: ForecastAnimationCacheStatus;
}

export interface ForecastRefreshSession {
  downloadKey: ForecastRefreshKey;
}

export interface ForecastAnimationCacheBuildPorts {
  getModelState(): ForecastAnimationCacheState;
  isBitmapCacheComplete(): boolean;
  isRefreshActive(downloadKey: ForecastRefreshKey): boolean;
  queuePrerenderForAllBlocks(): void;
  updateWarmupProgress(): void;
  waitForPrerenderIdle(): Promise<void>;
}

export interface ForecastInitialDownloadRequest {
  packageKey: string;
  pkg: ForecastPackage;
  downloadKey: ForecastRefreshKey;
}

export interface ForecastResourceLoadRequest {
  packageKey: string;
  downloadKey: ForecastRefreshKey;
  loadingStatus: string;
}

export interface ForecastSessionPreparationRequest {
  packageKey: string;
  pkg: ForecastPackage;
  resources: RemoteResource[];
  downloadKey: ForecastRefreshKey;
}

export interface ForecastInitialDownloadPorts {
  downloadStatus(session: ForecastDownloadSession): string;
  isRefreshActive(downloadKey: ForecastRefreshKey): boolean;
  loadPackageResources(request: ForecastResourceLoadRequest): Promise<RemoteResource[] | null>;
  prepareSession(request: ForecastSessionPreparationRequest): ForecastDownloadSession;
  refreshBlocksToLatest(session: ForecastDownloadSession): Promise<boolean>;
  setStatus(status: string): void;
}

export interface ForecastDownloadPreparationPorts {
  applyResources(resources: RemoteResource[]): void;
  createSession(
    request: ForecastSessionPreparationRequest & {
      runSummary: string;
    },
  ): ForecastDownloadSession;
  formatRunSummary(resources: RemoteResource[]): string;
  renderItems(resources: RemoteResource[]): void;
  resetResourceStatuses(resources: RemoteResource[]): void;
}

export interface ForecastResourceUpdatePorts {
  isRefreshActive(downloadKey: ForecastRefreshKey): boolean;
  loadPackageResources(request: ForecastResourceLoadRequest): Promise<RemoteResource[] | null>;
  packages?: Readonly<Record<string, ForecastPackage>>;
  prepareSession(request: ForecastSessionPreparationRequest): ForecastDownloadSession;
  refreshBlocksToLatest(
    session: ForecastDownloadSession,
    options: {
      previousResources: RemoteResource[];
    },
  ): Promise<boolean>;
  refreshStatus(session: ForecastDownloadSession): string;
  setStatus(status: string): void;
}

export interface ForecastResourceLoadPorts {
  fetchPackageResources(
    packageKey: string,
    downloadKey: ForecastRefreshKey,
  ): Promise<RemoteResource[] | null>;
  isRefreshActive(downloadKey: ForecastRefreshKey): boolean;
  setStatus(status: string): void;
}

export interface ForecastAvailableBlockStoreRequest {
  block: RemoteResource;
  buffer: Uint8Array;
  session: ForecastDownloadSession;
  state: ForecastRunState;
  status: BlockStatus;
}

export interface ForecastAvailableBlockPorts {
  incrementAvailableCount(session: ForecastDownloadSession): void;
  invalidateBlockRenderCache(block: RemoteResource): void;
  markBlockAvailable(state: ForecastRunState, block: RemoteResource): void;
  setBlockStatus(block: RemoteResource, status: BlockStatus): void;
  storeBlock(block: RemoteResource, buffer: Uint8Array): Promise<boolean>;
}

export type ForecastVariableDefinition = ForecastVariable;

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
  variable: string | null;
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
  displayUnitsFor?(shortName: string, units: string | undefined): string;
  findPackageVariable?(
    packageKey: string,
    variableKey: string,
  ): ForecastVariableDefinition | undefined;
  formatModelPackageSubtitle(packageKey: string): string;
  formatRefTime?(header: unknown): string;
  iterateMessages?(buffer: Uint8Array): Iterable<ForecastLegendMessage>;
  parameterDescriptionFor?(shortName: string): string;
  showColorScale(
    min: number,
    max: number,
    units: string,
    options: {
      isLog: boolean;
    },
  ): void;
  staticScaleFor?(shortName: string): ForecastStaticScale | null | undefined;
  updateLevelInfo(variableDefinition: ForecastVariableDefinition | undefined): void;
  updateParamInfo(name: string, description: string, subtitle: string): void;
}
