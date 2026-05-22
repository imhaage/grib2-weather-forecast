import { describe, expect, test, vi } from "vitest";
import {
  CACHE_LOAD_RESULT,
  createForecastBlockRefreshService,
} from "./forecast-block-refresh-service.js";

const BLOCK_STATUS = Object.freeze({
  LOADED_FROM_CACHE: "loaded-from-cache",
  DOWNLOADING: "downloading",
  READY: "ready",
});

function createService(overrides = {}) {
  return createForecastBlockRefreshService({
    statuses: BLOCK_STATUS,
    maxParallelDownloads: 6,
    runWithConcurrency: async (items, _limit, worker) => {
      const results = [];
      for (const item of items) results.push(await worker(item));
      return results;
    },
    isRefreshActive: () => true,
    isBlockInMemoryCurrent: () => false,
    isBlockInMemoryStale: () => false,
    markInMemoryBlockAvailable: vi.fn(),
    readCachedBlock: vi.fn().mockResolvedValue(null),
    readLatestCachedBlock: vi.fn().mockResolvedValue(null),
    setBlockStatus: vi.fn(),
    resetBlockDownloadProgress: vi.fn(),
    setBlockDownloadProgress: vi.fn(),
    downloadFile: vi.fn(async (url) => new Uint8Array([url.endsWith("missing") ? 1 : 2])),
    writeCachedBlock: vi.fn().mockResolvedValue(true),
    deleteObsoleteCachedBlocks: vi.fn(),
    enqueueAvailableBlock: vi.fn(),
    waitForPresentationIdle: vi.fn(),
    ...overrides,
  });
}

describe("forecast block refresh service", () => {
  test("loads cache first, downloads missing blocks before refreshing stale blocks", async () => {
    const events = [];
    const missingBlock = { key: "01H", url: "https://example.test/missing", filesize: 1 };
    const staleBlock = { key: "02H", url: "https://example.test/stale", filesize: 1 };
    const service = createService({
      readLatestCachedBlock: vi.fn(async (_packageKey, block) => {
        if (block.key !== staleBlock.key) return null;
        return { buffer: new Uint8Array([9]) };
      }),
      downloadFile: vi.fn(async (url) => {
        events.push(url.endsWith("missing") ? "download-missing" : "download-stale");
        return new Uint8Array([url.endsWith("missing") ? 1 : 2]);
      }),
      enqueueAvailableBlock: vi.fn(async (block, _buffer, status) => {
        events.push(`${status}:${block.key}`);
      }),
    });

    const result = await service.refreshBlocksToLatest({
      packageKey: "AROME_SP1",
      resources: [missingBlock, staleBlock],
      downloadKey: {},
    });

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
    const currentBlock = { key: "01H" };
    const staleBlock = { key: "02H" };
    const missingBlock = { key: "03H" };
    const service = createService({
      readCachedBlock: vi.fn(async (_packageKey, block) =>
        block.key === currentBlock.key ? new Uint8Array([1]) : null,
      ),
      readLatestCachedBlock: vi.fn(async (_packageKey, block) =>
        block.key === staleBlock.key ? { buffer: new Uint8Array([2]) } : null,
      ),
    });

    await expect(service.loadCachedBlock("AROME_SP1", currentBlock, {}, vi.fn())).resolves.toEqual({
      status: CACHE_LOAD_RESULT.CURRENT,
      block: currentBlock,
    });
    await expect(service.loadCachedBlock("AROME_SP1", staleBlock, {}, vi.fn())).resolves.toEqual({
      status: CACHE_LOAD_RESULT.STALE,
      block: staleBlock,
    });
    await expect(service.loadCachedBlock("AROME_SP1", missingBlock, {}, vi.fn())).resolves.toEqual({
      status: CACHE_LOAD_RESULT.MISSING,
      block: missingBlock,
    });
  });

  test("does not present a network result after the refresh becomes inactive", async () => {
    let active = true;
    const enqueueAvailableBlock = vi.fn();
    const deleteObsoleteCachedBlocks = vi.fn();
    const service = createService({
      isRefreshActive: () => active,
      downloadFile: vi.fn(async () => {
        active = false;
        return new Uint8Array([1]);
      }),
      enqueueAvailableBlock,
      deleteObsoleteCachedBlocks,
    });

    await service.refreshBlockFromNetwork(
      "AROME_SP1",
      { key: "01H", url: "https://example.test/01H", filesize: 1 },
      {},
      enqueueAvailableBlock,
    );

    expect(enqueueAvailableBlock).not.toHaveBeenCalled();
    expect(deleteObsoleteCachedBlocks).not.toHaveBeenCalled();
  });

  test("presents in-memory stale blocks before refreshing them from network", async () => {
    const events = [];
    const block = { key: "01H", url: "https://example.test/01H", filesize: 1 };
    const previousBlock = { key: "01H", runId: "2026-05-22T00:00:00Z" };
    const service = createService({
      isBlockInMemoryStale: (_block, candidate) => candidate === previousBlock,
      markInMemoryBlockAvailable: vi.fn((block, status) => {
        events.push(`${status}:${block.key}`);
      }),
      downloadFile: vi.fn(async () => {
        events.push("download");
        return new Uint8Array([1]);
      }),
      enqueueAvailableBlock: vi.fn(async (block, _buffer, status) => {
        events.push(`${status}:${block.key}`);
      }),
    });

    await service.refreshBlocksToLatest(
      {
        packageKey: "AROME_SP1",
        resources: [block],
        downloadKey: {},
      },
      { previousResources: [previousBlock] },
    );

    expect(events).toEqual([
      `${BLOCK_STATUS.LOADED_FROM_CACHE}:01H`,
      "download",
      `${BLOCK_STATUS.READY}:01H`,
    ]);
  });
});
