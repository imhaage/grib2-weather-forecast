import { makeRemoteResource } from "../use-cases/forecast/forecast-test-fixtures";
import type {
  ModelBlockDecodeValuesResult,
  ModelBlockRenderRequest,
  ModelBlockRenderResult,
} from "./model-block-worker-contracts";

export function makeModelBlockRenderRequest(
  overrides: Partial<ModelBlockRenderRequest> = {},
): ModelBlockRenderRequest {
  const block = overrides.block ?? makeRemoteResource();

  return {
    type: "renderHour",
    renderGeneration: 1,
    blockKey: block.key,
    block,
    hour: block.startHour,
    previousBlockKey: null,
    previousBlock: null,
    previousHour: null,
    variable: { shortName: "t", levelValue: null },
    secondaryVariable: null,
    vectorComposite: null,
    unitTransform: "t",
    staticScale: null,
    renderMin: 0,
    range: 1,
    isLog: false,
    logFloor: 0.1,
    logDenom: 1,
    zeroThreshold: 0,
    displayUnits: "°C",
    lut: new Uint8Array([1, 2, 3]),
    missingValue: -1e100,
    includeValues: false,
    ...overrides,
  };
}

export function makeModelBlockRenderResult(
  overrides: Partial<ModelBlockRenderResult> = {},
): ModelBlockRenderResult {
  return {
    type: "renderHourResult",
    renderGeneration: 1,
    bitmap: { close() {} } as ImageBitmap,
    dataMin: 0,
    dataMax: 1,
    dataMean: 0.5,
    dataCount: 4,
    grid: {
      ni: 2,
      nj: 2,
      dj: 1,
      latitudeOfFirstPoint: 2,
      longitudeOfFirstPoint: 0,
      latitudeOfLastPoint: 1,
      longitudeOfLastPoint: 1,
    },
    product: { shortName: "t" },
    header: {},
    unitTransform: "t",
    renderMin: 0,
    range: 1,
    staticScale: null,
    isLog: false,
    displayUnits: "°C",
    isFallback: false,
    vectorComposite: null,
    vectorUValues: null,
    vectorVValues: null,
    ...overrides,
  };
}

export function makeModelBlockDecodeValuesResult(
  overrides: Partial<ModelBlockDecodeValuesResult> = {},
): ModelBlockDecodeValuesResult {
  return {
    type: "decodeValuesResult",
    renderGeneration: 1,
    values: new Float32Array([1, 2]),
    ...overrides,
  };
}
