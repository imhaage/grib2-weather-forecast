export const BLOCK_STATUS = {
  MISSING: "missing",
  LOADED_FROM_CACHE: "loaded-from-cache",
  DOWNLOADING: "downloading",
  READY: "ready",
} as const;

export type BlockStatus = (typeof BLOCK_STATUS)[keyof typeof BLOCK_STATUS];
export type AnimationCacheStatus = "waiting" | "building" | "ready";
export type CacheLoadStatus = "current" | "stale" | "missing";
export type PackageKey = string;
export type ModelName = "AROME" | "ARPEGE" | string;

export interface ForecastVariable {
  shortName: string;
  varKey?: string;
  levelValue?: number;
  name: string;
  units: string;
  level: string;
  group?: string;
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
  homeVariableGroups?: Array<{
    group: string;
    names: string[];
  }>;
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

export interface ForecastRunState {
  packageKey: PackageKey;
  resourceRefreshId: number;
  resources: RemoteResource[];
  availableBlocks: Set<string>;
  hourList: number[];
  blockStatus: Map<string, BlockStatus>;
  variable: string | null;
  currentHour: number | null;
  lastRunInfo: string | null;
  animationCacheStatus: AnimationCacheStatus;
  showWindDirection: boolean;
}
