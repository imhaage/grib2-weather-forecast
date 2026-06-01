import { beforeEach, describe, expect, test, vi } from "vitest";
import { createModelBlockWorkerClient } from "../workers/model-block-worker-client.js";
import { createModelBlockService } from "./model-block-service.js";

vi.mock("../workers/model-block-worker-client.js", () => ({
  createModelBlockWorkerClient: vi.fn(),
}));

describe("model block service", () => {
  let post;

  beforeEach(() => {
    post = vi.fn();
    vi.mocked(createModelBlockWorkerClient).mockReturnValue({ post });
  });

  test("stores blocks through the worker protocol and transfers ownership", async () => {
    post.mockResolvedValue({ ok: true });
    const service = createModelBlockService();
    const buffer = new Uint8Array([1, 2, 3]);

    await expect(service.storeBlock({ key: "01H" }, buffer)).resolves.toBe(true);

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
    const service = createModelBlockService();
    const request = {
      type: "renderHour",
      lut: new Uint8Array([1, 2, 3]),
    };

    await service.renderHour(request);

    expect(post).toHaveBeenCalledWith(request, [request.lut.buffer]);
  });

  test("decodes values by reusing render requests with a decodeValues message type", async () => {
    post.mockResolvedValue({ values: new Float32Array([1]) });
    const service = createModelBlockService();
    const request = {
      type: "renderHour",
      blockKey: "01H",
      lut: new Uint8Array([1, 2, 3]),
    };

    await service.decodeValues(request);

    expect(post).toHaveBeenCalledWith({
      ...request,
      type: "decodeValues",
    });
  });
});
