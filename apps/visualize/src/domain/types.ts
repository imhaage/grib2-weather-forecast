export type PackageKey = string;
export type ModelName = "AROME" | "ARPEGE" | string;
export type BlockStatus = "missing" | "loaded-from-cache" | "downloading" | "ready";
export type CacheLoadStatus = "current" | "stale" | "missing";
export type AnimationCacheStatus = "waiting" | "building" | "ready";

export interface ForecastVariable {
  shortName: string;
  varKey?: string;
  levelValue?: number;
  name: string;
  units: string;
  level: string;
}

export interface ForecastPackage {
  model: ModelName;
  label: string;
  provider: string;
  datasetId: string;
  titlePattern: string;
  skipHour0?: boolean;
  bounds: [[number, number], [number, number]];
  variables: ForecastVariable[];
}

export interface VariableKeySource {
  shortName: string;
  varKey?: string;
}

export interface StaticScale {
  min: number;
  max: number;
  log?: boolean;
  zeroThreshold?: number;
}

export interface VariableMetadata {
  description?: string;
  defaultPalette?: string;
  staticScale?: StaticScale;
}

export interface RemoteResource {
  startHour: number;
  endHour: number;
  key: string;
  runId: string;
  title: string;
  url: string;
  filesize?: number | null;
  status?: BlockStatus;
}

export interface CachedGribBlockRecord {
  id: string;
  packageKey: PackageKey;
  blockKey: string;
  runId: string;
  url: string;
  filesize: number | null;
  savedAt: string;
  buffer?: ArrayBuffer;
}

export interface CacheLoadResult {
  status: CacheLoadStatus;
  block: RemoteResource;
}

export interface DownloadSummary {
  ready: number;
  loadedFromCache: number;
  downloading: number;
  missing: number;
  runSummary: string;
}

export interface AnimationCacheState {
  status: AnimationCacheStatus;
  readyFrames: number;
  totalFrames: number;
}
