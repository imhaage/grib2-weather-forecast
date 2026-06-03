import { describe, expect, test, vi } from "vitest";
import { createModelBlockWorkerClient } from "./model-block-worker-client.js";

describe("model block worker client", () => {
  test("routes legacy post messages to Comlink methods with transferables", async () => {
    const worker = {};
    const remote = {
      decodeValues: vi.fn(async (request) => ({ values: request.values })),
      renderHour: vi.fn(async (request) => ({ renderGeneration: request.value.renderGeneration })),
      storeBlock: vi.fn(async (request) => ({ ok: Boolean(request.value.buffer) })),
    };
    const comlink = {
      transfer: vi.fn((value, transferables) => ({ value, transferables })),
      wrap: vi.fn(() => remote),
    };
    const client = createModelBlockWorkerClient({
      comlink,
      createWorker: () => worker,
    });
    const buffer = new Uint8Array([1, 2]);
    const lut = new Uint8Array([3, 4]);

    await expect(
      client.post({ type: "storeBlock", blockKey: "01H", buffer }, [buffer.buffer]),
    ).resolves.toEqual({ ok: true });
    await expect(
      client.post({ type: "renderHour", renderGeneration: 2, lut }, [lut.buffer]),
    ).resolves.toEqual({ renderGeneration: 2 });
    await client.post({ type: "decodeValues", values: new Float32Array([1]) });

    expect(comlink.wrap).toHaveBeenCalledWith(worker);
    expect(remote.storeBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        value: expect.objectContaining({ type: "storeBlock", blockKey: "01H", buffer }),
        transferables: [buffer.buffer],
      }),
    );
    expect(remote.renderHour).toHaveBeenCalledWith(
      expect.objectContaining({
        value: expect.objectContaining({ type: "renderHour", renderGeneration: 2, lut }),
        transferables: [lut.buffer],
      }),
    );
    expect(remote.decodeValues).toHaveBeenCalledWith(
      expect.objectContaining({ type: "decodeValues" }),
    );
  });

  test("maps model block worker errors to null", async () => {
    const onError = vi.fn();
    const client = createModelBlockWorkerClient({
      comlink: {
        transfer: (value) => value,
        wrap: () => ({
          renderHour: vi.fn(async () => {
            throw new Error("render failed");
          }),
        }),
      },
      createWorker: () => ({}),
      onError,
    });

    await expect(client.post({ type: "renderHour" })).resolves.toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
