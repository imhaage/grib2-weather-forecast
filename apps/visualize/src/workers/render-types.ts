import type { NumericFieldValues, UnitTransformKey } from "../domain/field-types";

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
