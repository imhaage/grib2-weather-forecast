import { describe, expect, test, vi } from "vitest";
import { createRenderWorkerClient } from "./render-worker-client.js";

describe("render worker client", () => {
  test("renders through a Comlink proxy and transfers render buffers", async () => {
    const worker = {};
    const bitmap = { close: vi.fn() };
    const remote = {
      render: vi.fn(async (request) => ({
        renderGeneration: request.value.renderGeneration,
        bitmap,
        dataMin: 1,
        dataMax: 1,
      })),
    };
    const comlink = {
      transfer: vi.fn((value, transferables) => ({ value, transferables })),
      wrap: vi.fn(() => remote),
    };
    const client = createRenderWorkerClient({
      createWorker: () => worker,
      comlink,
    });
    const values = new Float32Array([1]);

    const result = await client.render(
      {
        renderGeneration: 7,
        values,
        outW: 1,
        outH: 1,
      },
      [values.buffer],
    );

    expect(result).toMatchObject({
      renderGeneration: 7,
      bitmap,
      dataMin: 1,
      dataMax: 1,
    });
    expect(comlink.wrap).toHaveBeenCalledWith(worker);
    expect(comlink.transfer).toHaveBeenCalledWith(
      expect.objectContaining({ renderGeneration: 7, values }),
      [values.buffer],
    );
  });

  test("maps render worker errors to null", async () => {
    const onError = vi.fn();
    const client = createRenderWorkerClient({
      comlink: {
        transfer: (value) => value,
        wrap: () => ({
          render: vi.fn(async () => {
            throw new Error("render failed");
          }),
        }),
      },
      createWorker: () => ({}),
      onError,
    });

    await expect(client.render({ renderGeneration: 1 }, [])).resolves.toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
