import { beforeEach, describe, expect, test, vi } from "vitest";
import { makeRemoteResource } from "../../use-cases/forecast/forecast-test-fixtures";
import type {
  ModelBlockWorkerRequest,
  ModelBlockWorkerResult,
} from "../../workers/model-block-worker-contracts";
import {
  makeModelBlockDecodeValuesResult,
  makeModelBlockRenderRequest,
  makeModelBlockRenderResult,
} from "../../workers/model-block-worker-test-fixtures";
import { createModelBlockWorkerAdapter } from "./model-block-worker-adapter";

describe("model block worker adapter", () => {
  let post: ReturnType<
    typeof vi.fn<
      (
        message: ModelBlockWorkerRequest,
        transferables?: Transferable[],
      ) => Promise<ModelBlockWorkerResult | null>
    >
  >;

  beforeEach(() => {
    post =
      vi.fn<
        (
          message: ModelBlockWorkerRequest,
          transferables?: Transferable[],
        ) => Promise<ModelBlockWorkerResult | null>
      >();
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
    post.mockResolvedValue({ type: "storeBlockResult", ok: true });
    const adapter = createAdapter();
    const buffer = new Uint8Array([1, 2, 3]);

    await expect(adapter.storeBlock(makeRemoteResource(), buffer)).resolves.toBe(true);

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
    post.mockResolvedValue(makeModelBlockRenderResult());
    const adapter = createAdapter();
    const request = makeModelBlockRenderRequest();

    await adapter.renderHour(request);

    expect(post).toHaveBeenCalledWith(request, [request.lut.buffer]);
  });

  test("decodes values by reusing render requests with a decodeValues message type", async () => {
    post.mockResolvedValue(makeModelBlockDecodeValuesResult());
    const adapter = createAdapter();
    const request = makeModelBlockRenderRequest();

    await adapter.decodeValues(request);

    expect(post).toHaveBeenCalledWith({
      ...request,
      type: "decodeValues",
    });
  });
});
