import { describe, expect, test } from "vitest";
import { makeModelBlockRenderResult } from "../../workers/model-block-worker-test-fixtures";
import { makeBitmapCacheEntryFromWorker } from "./create-bitmap-cache-entry";

describe("forecast bitmap cache entry use case", () => {
  test("copies vector component values and optionally keeps rendered values", () => {
    const values = new Float32Array([1, 2]);
    const vectorUValues = new Float32Array([1, 2]);
    const vectorVValues = new Float32Array([3, 4]);
    const entry = makeBitmapCacheEntryFromWorker(
      makeModelBlockRenderResult({
        values,
        vectorUValues,
        vectorVValues,
      }),
      { keepValues: true },
    );

    expect(entry.values).toBe(values);
    expect(entry.vectorUValues).toBe(vectorUValues);
    expect(entry.vectorVValues).toBe(vectorVValues);
  });
});
