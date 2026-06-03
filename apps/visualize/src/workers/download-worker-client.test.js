import { describe, expect, test, vi } from "vitest";
import { createDownloadWorkerClient } from "./download-worker-client.js";

describe("download worker client", () => {
  test("downloads through a Comlink proxy and proxies progress callbacks", async () => {
    const worker = {};
    const buffer = new ArrayBuffer(2);
    const onProgress = vi.fn();
    const proxiedProgress = vi.fn();
    const remote = {
      download: vi.fn(async (_url, _filesize, progress) => {
        await progress({ loaded: 1, total: 2 });
        return { buffer };
      }),
    };
    const comlink = {
      proxy: vi.fn(() => proxiedProgress),
      wrap: vi.fn(() => remote),
    };
    proxiedProgress.mockImplementation((progress) => onProgress(progress));
    const client = createDownloadWorkerClient({
      comlink,
      createWorker: () => worker,
    });

    const result = await client.post({ url: "https://example.test/file.grib2", filesize: 2 }, [], {
      onProgress,
    });

    expect(result).toEqual({ buffer });
    expect(comlink.wrap).toHaveBeenCalledWith(worker);
    expect(comlink.proxy).toHaveBeenCalledWith(onProgress);
    expect(remote.download).toHaveBeenCalledWith(
      "https://example.test/file.grib2",
      2,
      proxiedProgress,
    );
    expect(onProgress).toHaveBeenCalledWith({ loaded: 1, total: 2 });
  });

  test("maps download worker errors to null", async () => {
    const onError = vi.fn();
    const client = createDownloadWorkerClient({
      comlink: {
        proxy: (value) => value,
        wrap: () => ({
          download: vi.fn(async () => {
            throw new Error("download failed");
          }),
        }),
      },
      createWorker: () => ({}),
      onError,
    });

    await expect(client.post({ url: "https://example.test/file.grib2" })).resolves.toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
