import { beforeEach, describe, expect, test, vi } from "vitest";
import { createModelBlockWorkerAdapter } from "./model-block-worker-adapter";

describe("model block worker adapter", () => {
  let post: ReturnType<
    typeof vi.fn<(message: unknown, transferables?: Transferable[]) => Promise<unknown>>
  >;

  beforeEach(() => {
    post = vi.fn<(message: unknown, transferables?: Transferable[]) => Promise<unknown>>();
  });

  function createAdapter() {
    return createModelBlockWorkerAdapter({
      createWorkerClient: () => ({
        post: (message, transferables) =>
          transferables
            ? Promise.resolve(post(message, transferables))
            : Promise.resolve(post(message)),
      }),
    });
  }

  test("stores blocks through the worker protocol and transfers ownership", async () => {
    post.mockResolvedValue({ ok: true });
    const adapter = createAdapter();
    const buffer = new Uint8Array([1, 2, 3]);

    await expect(adapter.storeBlock({ key: "01H" }, buffer)).resolves.toBe(true);

    expect(post).toHaveBeenCalledWith(
      {
        type: "storeBlock",
        blockKey: "01H",
        buffer,
      },
      [buffer.buffer],
    );
  });

  test("renders hours by transferring the LUT buffer", async () => {
    post.mockResolvedValue({ bitmap: {}, dataCount: 4 });
    const adapter = createAdapter();
    const request = {
      type: "renderHour",
      lut: new Uint8Array([1, 2, 3]),
    };

    await adapter.renderHour(request);

    expect(post).toHaveBeenCalledWith(request, [request.lut.buffer]);
  });

  test("decodes values by reusing render requests with a decodeValues message type", async () => {
    post.mockResolvedValue({ values: new Float32Array([1]) });
    const adapter = createAdapter();
    const request = {
      type: "renderHour",
      blockKey: "01H",
      lut: new Uint8Array([1, 2, 3]),
    };

    await adapter.decodeValues(request);

    expect(post).toHaveBeenCalledWith({
      ...request,
      type: "decodeValues",
    });
  });
});
