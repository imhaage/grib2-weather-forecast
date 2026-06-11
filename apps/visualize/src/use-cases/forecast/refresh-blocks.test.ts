import { describe, expect, test, vi } from "vitest";
import type { RemoteResource } from "../../domain/forecast-types";
import {
  makeForecastDownloadSession,
  makeForecastRefreshKey,
  makeRemoteResource,
} from "./forecast-test-fixtures";
import {
  CACHE_LOAD_RESULT,
  createForecastBlockRefreshUseCase,
  type ForecastBlockRefreshUseCaseOptions,
} from "./refresh-blocks";

const BLOCK_STATUS = Object.freeze({
  LOADED_FROM_CACHE: "loaded-from-cache",
  DOWNLOADING: "downloading",
  READY: "ready",
});

interface TestOverrides {
  cache?: Partial<ForecastBlockRefreshUseCaseOptions["cache"]>;
  lifecycle?: Partial<ForecastBlockRefreshUseCaseOptions["lifecycle"]>;
  network?: Partial<ForecastBlockRefreshUseCaseOptions["network"]>;
  presentation?: Partial<ForecastBlockRefreshUseCaseOptions["presentation"]>;
  status?: Partial<ForecastBlockRefreshUseCaseOptions["status"]>;
}

function createService(overrides: TestOverrides = {}) {
  const defaults: Omit<ForecastBlockRefreshUseCaseOptions, "maxParallelDownloads" | "statuses"> = {
    cache: {
      readCachedBlock: vi.fn().mockResolvedValue(null),
      readLatestCachedBlock: vi.fn().mockResolvedValue(null),
      writeCachedBlock: vi.fn().mockResolvedValue(true),
      deleteObsoleteCachedBlocks: vi.fn(),
    },
    lifecycle: {
      isRefreshActive: () => true,
      isBlockInMemoryCurrent: () => false,
      isBlockInMemoryStale: () => false,
    },
    network: {
      downloadFile: vi.fn(async (url) => new Uint8Array([url.endsWith("missing") ? 1 : 2])),
    },
    presentation: {
      enqueueAvailableBlock: vi.fn(),
      waitForPresentationIdle: vi.fn(),
    },
    status: {
      markInMemoryBlockAvailable: vi.fn(),
      setBlockStatus: vi.fn(),
      resetBlockDownloadProgress: vi.fn(),
      setBlockDownloadProgress: vi.fn(),
    },
  };
  const ports = {
    cache: { ...defaults.cache, ...overrides.cache },
    lifecycle: { ...defaults.lifecycle, ...overrides.lifecycle },
    network: { ...defaults.network, ...overrides.network },
    presentation: { ...defaults.presentation, ...overrides.presentation },
    status: { ...defaults.status, ...overrides.status },
  };

  return createForecastBlockRefreshUseCase({
    statuses: BLOCK_STATUS,
    maxParallelDownloads: 6,
    ...ports,
  });
}

describe("forecast block refresh use case", () => {
  test("requires remote resources to provide their download URL", () => {
    // @ts-expect-error Remote resources require a URL.
    const invalidResource: RemoteResource = { key: "01H" };

    expect(invalidResource.key).toBe("01H");
  });

  test("loads cache first, downloads missing blocks before refreshing stale blocks", async () => {
    const events: string[] = [];
    const missingBlock = makeRemoteResource({
      key: "01H",
      url: "https://example.test/missing",
      filesize: 1,
    });
    const staleBlock = makeRemoteResource({
      key: "02H",
      url: "https://example.test/stale",
      filesize: 1,
    });
    const service = createService({
      cache: {
        readLatestCachedBlock: vi.fn(async (_packageKey, block) => {
          if (block.key !== staleBlock.key) {
            return null;
          }

          return { buffer: new Uint8Array([9]) };
        }),
      },
      network: {
        downloadFile: vi.fn(async (url) => {
          events.push(url.endsWith("missing") ? "download-missing" : "download-stale");

          return new Uint8Array([url.endsWith("missing") ? 1 : 2]);
        }),
      },
      presentation: {
        enqueueAvailableBlock: vi.fn(async (block, _buffer, status) => {
          events.push(`${status}:${block.key}`);
        }),
      },
    });

    const result = await service.refreshBlocksToLatest(
      makeForecastDownloadSession({ resources: [missingBlock, staleBlock] }),
    );

    expect(result).toBe(true);
    expect(events).toEqual([
      `${BLOCK_STATUS.LOADED_FROM_CACHE}:02H`,
      "download-missing",
      `${BLOCK_STATUS.READY}:01H`,
      "download-stale",
      `${BLOCK_STATUS.READY}:02H`,
    ]);
  });

  test("returns typed cache load results for current, stale, and missing blocks", async () => {
    const currentBlock = makeRemoteResource({ key: "01H", url: "https://example.test/01H" });
    const staleBlock = makeRemoteResource({ key: "02H", url: "https://example.test/02H" });
    const missingBlock = makeRemoteResource({ key: "03H", url: "https://example.test/03H" });
    const downloadKey = makeForecastRefreshKey();
    const service = createService({
      cache: {
        readCachedBlock: vi.fn(async (_packageKey, block) =>
          block.key === currentBlock.key ? new Uint8Array([1]) : null,
        ),
        readLatestCachedBlock: vi.fn(async (_packageKey, block) =>
          block.key === staleBlock.key ? { buffer: new Uint8Array([2]) } : null,
        ),
      },
    });

    await expect(
      service.loadCachedBlock("AROME_SP1", currentBlock, downloadKey, vi.fn()),
    ).resolves.toEqual({
      status: CACHE_LOAD_RESULT.CURRENT,
      block: currentBlock,
    });
    await expect(
      service.loadCachedBlock("AROME_SP1", staleBlock, downloadKey, vi.fn()),
    ).resolves.toEqual({
      status: CACHE_LOAD_RESULT.STALE,
      block: staleBlock,
    });
    await expect(
      service.loadCachedBlock("AROME_SP1", missingBlock, downloadKey, vi.fn()),
    ).resolves.toEqual({
      status: CACHE_LOAD_RESULT.MISSING,
      block: missingBlock,
    });
  });

  test("does not present a network result after the refresh becomes inactive", async () => {
    let active = true;
    const enqueueAvailableBlock = vi.fn();
    const deleteObsoleteCachedBlocks = vi.fn();
    const service = createService({
      lifecycle: {
        isRefreshActive: () => active,
      },
      network: {
        downloadFile: vi.fn(async () => {
          active = false;

          return new Uint8Array([1]);
        }),
      },
      presentation: {
        enqueueAvailableBlock,
      },
      cache: {
        deleteObsoleteCachedBlocks,
      },
    });

    await service.refreshBlockFromNetwork(
      "AROME_SP1",
      makeRemoteResource({ key: "01H", url: "https://example.test/01H", filesize: 1 }),
      makeForecastRefreshKey(),
      enqueueAvailableBlock,
    );

    expect(enqueueAvailableBlock).not.toHaveBeenCalled();
    expect(deleteObsoleteCachedBlocks).not.toHaveBeenCalled();
  });

  test("presents in-memory stale blocks before refreshing them from network", async () => {
    const events: string[] = [];
    const block = makeRemoteResource({
      key: "01H",
      url: "https://example.test/01H",
      filesize: 1,
    });
    const previousBlock = makeRemoteResource({
      key: "01H",
      url: "https://example.test/previous",
      runId: "2026-05-22T00:00:00Z",
    });
    const service = createService({
      lifecycle: {
        isBlockInMemoryStale: (_block, candidate) => candidate === previousBlock,
      },
      status: {
        markInMemoryBlockAvailable: vi.fn((block, status) => {
          events.push(`${status}:${block.key}`);
        }),
      },
      network: {
        downloadFile: vi.fn(async () => {
          events.push("download");

          return new Uint8Array([1]);
        }),
      },
      presentation: {
        enqueueAvailableBlock: vi.fn(async (block, _buffer, status) => {
          events.push(`${status}:${block.key}`);
        }),
      },
    });

    await service.refreshBlocksToLatest(makeForecastDownloadSession({ resources: [block] }), {
      previousResources: [previousBlock],
    });

    expect(events).toEqual([
      `${BLOCK_STATUS.LOADED_FROM_CACHE}:01H`,
      "download",
      `${BLOCK_STATUS.READY}:01H`,
    ]);
  });

  test("waits for missing block presentation before refreshing stale blocks", async () => {
    const events: string[] = [];
    const missingBlock = makeRemoteResource({
      key: "01H",
      url: "https://example.test/missing",
      filesize: 1,
    });
    const staleBlock = makeRemoteResource({
      key: "02H",
      url: "https://example.test/stale",
      filesize: 1,
    });
    const service = createService({
      cache: {
        readLatestCachedBlock: vi.fn(async (_packageKey, block) =>
          block.key === staleBlock.key ? { buffer: new Uint8Array([2]) } : null,
        ),
      },
      network: {
        downloadFile: vi.fn(async (url) => {
          events.push(url.endsWith("missing") ? "download-missing" : "download-stale");

          return new Uint8Array([1]);
        }),
      },
      presentation: {
        enqueueAvailableBlock: vi.fn(async (block, _buffer, status) => {
          events.push(`${status}:${block.key}`);
        }),
        waitForPresentationIdle: vi.fn(async () => {
          events.push("presentation-idle");
        }),
      },
    });

    await service.refreshBlocksToLatest(
      makeForecastDownloadSession({ resources: [missingBlock, staleBlock] }),
    );

    expect(events).toEqual([
      `${BLOCK_STATUS.LOADED_FROM_CACHE}:02H`,
      "download-missing",
      `${BLOCK_STATUS.READY}:01H`,
      "presentation-idle",
      "download-stale",
      `${BLOCK_STATUS.READY}:02H`,
      "presentation-idle",
    ]);
  });

  test("limits cache loading concurrency with maxParallelDownloads", async () => {
    const blocks = [
      makeRemoteResource({ key: "01H", url: "https://example.test/01H", filesize: 1 }),
      makeRemoteResource({ key: "02H", url: "https://example.test/02H", filesize: 1 }),
      makeRemoteResource({ key: "03H", url: "https://example.test/03H", filesize: 1 }),
    ];
    const releaseReads: Array<() => void> = [];
    let activeReadCount = 0;
    let maxActiveReadCount = 0;
    async function waitForPendingReads(count: number) {
      for (let attempt = 0; attempt < 10 && releaseReads.length < count; attempt += 1) {
        await Promise.resolve();
      }
    }

    const service = createForecastBlockRefreshUseCase({
      statuses: BLOCK_STATUS,
      maxParallelDownloads: 2,
      cache: {
        readCachedBlock: vi.fn(async () => {
          activeReadCount += 1;
          maxActiveReadCount = Math.max(maxActiveReadCount, activeReadCount);
          await new Promise<void>((resolve) => releaseReads.push(resolve));
          activeReadCount -= 1;

          return new Uint8Array([1]);
        }),
        readLatestCachedBlock: vi.fn(),
        writeCachedBlock: vi.fn(),
        deleteObsoleteCachedBlocks: vi.fn(),
      },
      lifecycle: {
        isRefreshActive: () => true,
        isBlockInMemoryCurrent: () => false,
        isBlockInMemoryStale: () => false,
      },
      network: {
        downloadFile: vi.fn(),
      },
      presentation: {
        enqueueAvailableBlock: vi.fn(),
        waitForPresentationIdle: vi.fn(),
      },
      status: {
        markInMemoryBlockAvailable: vi.fn(),
        setBlockStatus: vi.fn(),
        resetBlockDownloadProgress: vi.fn(),
        setBlockDownloadProgress: vi.fn(),
      },
    });

    const resultPromise = service.refreshBlocksToLatest(
      makeForecastDownloadSession({ resources: blocks }),
    );

    await waitForPendingReads(2);
    expect(releaseReads).toHaveLength(2);
    expect(maxActiveReadCount).toBe(2);

    releaseReads.shift()?.();
    await waitForPendingReads(2);
    expect(releaseReads).toHaveLength(2);
    expect(maxActiveReadCount).toBe(2);

    for (const releaseRead of releaseReads.splice(0)) {
      releaseRead();
    }

    await expect(resultPromise).resolves.toBe(true);
  });
});
