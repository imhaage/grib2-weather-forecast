import { describe, expect, test } from "vitest";
import type {
  ModelBlockRenderRequest,
  ModelBlockRenderResult,
  ModelBlockStoreRequest,
} from "./model-block-worker-contracts";

describe("model block worker contracts", () => {
  test("uses discriminated request and result types", () => {
    const store = {
      type: "storeBlock",
      blockKey: "01H",
      buffer: new Uint8Array([1]),
    } satisfies ModelBlockStoreRequest;
    const render = {
      type: "renderHour",
      renderGeneration: 1,
      blockKey: "01H",
      hour: 1,
    } as ModelBlockRenderRequest;
    const result = {
      type: "renderHourResult",
      renderGeneration: 1,
      bitmap: {} as ImageBitmap,
      dataMin: 0,
      dataMax: 1,
      dataMean: 0.5,
      dataCount: 4,
    } as ModelBlockRenderResult;

    expect(store.type).toBe("storeBlock");
    expect(render.type).toBe("renderHour");
    expect(result.type).toBe("renderHourResult");
  });
});
