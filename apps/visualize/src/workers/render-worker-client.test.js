import { describe, expect, test, vi } from "vitest";
import { createRenderWorkerClient } from "./render-worker-client.js";

function createFakeWorker() {
  const listeners = {
    message: new Set(),
    error: new Set(),
  };
  return {
    addEventListener: vi.fn((type, listener) => listeners[type].add(listener)),
    removeEventListener: vi.fn((type, listener) => listeners[type].delete(listener)),
    postMessage: vi.fn(),
    emit(type, event) {
      for (const listener of listeners[type]) listener(event);
    },
  };
}

describe("render worker client", () => {
  test("posts render requests through the shared worker RPC client", async () => {
    const worker = createFakeWorker();
    const client = createRenderWorkerClient({
      createWorker: () => worker,
    });
    const bitmap = { close: vi.fn() };

    const resultPromise = client.render(
      { gen: 7, values: new Float32Array([1]), outW: 1, outH: 1 },
      [],
    );
    worker.emit("message", {
      data: { callId: 1, gen: 7, bitmap, dataMin: 1, dataMax: 1 },
    });

    await expect(resultPromise).resolves.toMatchObject({
      gen: 7,
      bitmap,
      dataMin: 1,
      dataMax: 1,
    });
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: 1,
        gen: 7,
        outW: 1,
        outH: 1,
      }),
      [],
    );
  });
});
