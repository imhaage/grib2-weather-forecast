import type {
  DecodedField,
  NumericFieldValues,
  StaticScale,
  UnitTransformKey,
} from "../domain/field-types";
import type { RemoteResource } from "../domain/forecast-types";

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
