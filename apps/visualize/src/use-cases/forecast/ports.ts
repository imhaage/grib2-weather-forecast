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
