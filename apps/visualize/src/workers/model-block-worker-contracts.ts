import type {
  GridDefinition,
  MessageHeader,
  ProductDefinition,
  StaticScale,
  UnitTransformKey,
} from "../domain/field-types";
import type { RemoteResource } from "../domain/forecast-types";

export interface ModelBlockVariable {
  shortName: string;
  levelValue: number | null;
}

export interface ModelBlockVectorComposite {
  shortName: string;
  uComponent: string;
  vComponent: string;
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
  variable: ModelBlockVariable;
  secondaryVariable: ModelBlockVariable | null;
  vectorComposite: ModelBlockVectorComposite | null;
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

export interface ModelBlockStoreResult {
  type: "storeBlockResult";
  ok: boolean;
}

export interface ModelBlockRenderResult {
  type: "renderHourResult";
  renderGeneration: number;
  bitmap: ImageBitmap;
  dataMin: number;
  dataMax: number;
  dataMean: number;
  dataCount: number;
  grid: GridDefinition;
  product: ProductDefinition;
  header: MessageHeader;
  unitTransform: UnitTransformKey;
  renderMin: number;
  range: number;
  staticScale: StaticScale | null | undefined;
  isLog: boolean;
  displayUnits: string | null | undefined;
  isFallback: boolean;
  vectorComposite: ModelBlockVectorComposite | null;
  vectorUValues: Float32Array | null;
  vectorVValues: Float32Array | null;
  values?: Float32Array;
  isobars?: unknown;
}

export interface ModelBlockDecodeValuesResult {
  type: "decodeValuesResult";
  renderGeneration: number;
  values?: Float32Array;
  grid?: GridDefinition;
  product?: ProductDefinition;
  header?: MessageHeader;
  displayUnits?: string | null;
  isFallback?: boolean;
  vectorComposite?: ModelBlockVectorComposite | null;
  vectorUValues?: Float32Array | null;
  vectorVValues?: Float32Array | null;
}

export type ModelBlockWorkerResult =
  | ModelBlockStoreResult
  | ModelBlockRenderResult
  | ModelBlockDecodeValuesResult;
