import type {
  AnimationCacheStatus,
  CacheLoadStatus,
  ForecastPackage,
  ForecastRunState,
  ForecastVariable,
  PackageKey,
  RemoteResource,
} from "./forecast-types";

export type {
  AnimationCacheStatus,
  BlockStatus,
  CacheLoadStatus,
  ForecastPackage,
  ForecastRunState,
  ForecastVariable,
  ModelName,
  PackageKey,
  RemoteResource,
} from "./forecast-types";

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

export type NumericFieldValues = Float32Array | Float64Array;
export type UnitTransformKey = "t" | "wspd" | "p" | "msl" | "tcc" | null;

export interface GridDefinition {
  ni: number;
  nj: number;
  di?: number;
  dj: number;
  latitudeOfFirstPoint: number;
  longitudeOfFirstPoint: number;
  latitudeOfLastPoint: number;
  longitudeOfLastPoint: number;
}

export interface ProductDefinition {
  shortName: string;
  name?: string;
  units?: string;
  level?: string;
  levelValue?: number;
  forecastTime?: number;
  timeUnit?: number;
  pdtNumber?: number;
}

export interface MessageHeader {
  centre?: number;
  refTime?: string | Date;
  [key: string]: unknown;
}

export interface DecodedField {
  values: NumericFieldValues;
  grid: GridDefinition;
  product: ProductDefinition;
  header: MessageHeader;
}

export interface RenderFieldInput {
  values: NumericFieldValues;
  unitTransform: UnitTransformKey;
  lut: Uint8ClampedArray | Uint8Array;
  missingValue: number;
  renderMin: number;
  range: number;
  isLog: boolean;
  logFloor: number;
  logDenom: number;
  zeroThreshold: number;
  outW: number;
  outH: number;
  ni: number;
  nj: number;
  dj: number;
  isStoN: boolean;
  northLat: number;
  southLat: number;
  northY: number;
  spanY: number;
}

export interface RenderFieldResult {
  image: ImageData;
  dataMin: number;
  dataMax: number;
  dataMean: number;
  dataCount: number;
}

export interface RenderWorkerRequest extends RenderFieldInput {
  renderGeneration: number;
}

export interface RenderWorkerResult {
  renderGeneration: number;
  bitmap?: ImageBitmap;
  dataMin?: number;
  dataMax?: number;
  dataMean?: number;
  dataCount?: number;
  error?: string;
}

export interface ModelBlockRenderRequest {
  type: "renderHour";
  renderGeneration: number;
  blockKey: string;
  block: RemoteResource;
  hour: number;
  previousBlockKey: string | null;
  previousBlock: RemoteResource | null;
  previousHour: number | null;
  variable: {
    shortName: string;
    levelValue: number | null;
  };
  unitTransform: UnitTransformKey;
  staticScale: StaticScale | null | undefined;
  renderMin: number;
  range: number;
  isLog: boolean;
  logFloor: number;
  logDenom: number;
  zeroThreshold: number;
  displayUnits: string | undefined;
  lut: Uint8ClampedArray | Uint8Array;
  missingValue: number;
  includeValues: boolean;
}

export interface ModelBlockStoreRequest {
  type: "storeBlock";
  blockKey: string;
  buffer: Uint8Array;
}

export interface ModelBlockDecodeValuesRequest extends Omit<ModelBlockRenderRequest, "type"> {
  type: "decodeValues";
}

export type ModelBlockWorkerRequest =
  | ModelBlockStoreRequest
  | ModelBlockRenderRequest
  | ModelBlockDecodeValuesRequest;

export interface ModelBlockRenderResult extends Omit<DecodedField, "values"> {
  renderGeneration: number;
  bitmap: ImageBitmap;
  dataMin: number;
  dataMax: number;
  dataMean: number;
  dataCount: number;
  unitTransform: UnitTransformKey;
  renderMin: number;
  range: number;
  staticScale: StaticScale | null | undefined;
  isLog: boolean;
  displayUnits: string | null | undefined;
  isFallback: boolean;
  values?: Float32Array;
  isobars?: unknown;
}

export interface ForecastDownloadSession {
  packageKey: PackageKey;
  pkg: ForecastPackage;
  pkgVars: ForecastVariable[];
  resources: RemoteResource[];
  runSummary: string;
  downloadKey: {
    state: ForecastRunState;
    refreshId: number;
  } | null;
  slider: HTMLInputElement;
  availableCount: number;
  legendInitialized: boolean;
  presentationQueue: unknown[];
  presentationIdleResolvers: Array<() => void>;
  isPresentingQueuedBlock: boolean;
}

export interface UploadedFileState {
  messages: UploadedMessage[];
}

export interface UploadedMessage {
  index: number;
  buffer: Uint8Array;
  header: MessageHeader;
  product: ProductDefinition;
}

export interface SelectedUploadedMessageRoute {
  messageIndex?: number | null;
  variableShortName?: string | null;
}
