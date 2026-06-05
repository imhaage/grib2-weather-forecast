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

export interface ForecastVariableDefinition {
  shortName: string;
  varKey?: string;
  name: string;
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
