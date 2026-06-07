import pLimit from "p-limit";

export const CACHE_LOAD_RESULT = Object.freeze({
  CURRENT: "current",
  STALE: "stale",
  MISSING: "missing",
});

type CacheLoadResultStatus = (typeof CACHE_LOAD_RESULT)[keyof typeof CACHE_LOAD_RESULT];

export interface ForecastBlock {
  filesize?: number | null;
  key: string;
  url: string;
  [key: string]: unknown;
}

interface ForecastSession {
  downloadKey: unknown;
  packageKey: string;
  resources: ForecastBlock[];
  [key: string]: unknown;
}

interface CacheLoadResult {
  block: ForecastBlock;
  status: CacheLoadResultStatus;
}

interface ForecastBlockStatuses {
  DOWNLOADING: string;
  LOADED_FROM_CACHE: string;
  READY: string;
}

interface CachePorts {
  deleteObsoleteCachedBlocks: (packageKey: string, block: ForecastBlock) => Promise<unknown>;
  readCachedBlock: (packageKey: string, block: ForecastBlock) => Promise<Uint8Array | null>;
  readLatestCachedBlock: (
    packageKey: string,
    block: ForecastBlock,
  ) => Promise<{ buffer: Uint8Array } | null>;
  writeCachedBlock: (
    packageKey: string,
    block: ForecastBlock,
    buffer: Uint8Array,
  ) => Promise<boolean>;
}

interface LifecyclePorts {
  isBlockInMemoryCurrent: (block: ForecastBlock, previousBlock?: ForecastBlock) => boolean;
  isBlockInMemoryStale: (block: ForecastBlock, previousBlock?: ForecastBlock) => boolean;
  isRefreshActive: (downloadKey: unknown) => boolean;
}

interface NetworkPorts {
  downloadFile: (
    url: string,
    filesize: number | null | undefined,
    onProgress: (loaded: number, total: number) => void,
  ) => Promise<Uint8Array>;
}

interface PresentationPorts {
  enqueueAvailableBlock: (
    block: ForecastBlock,
    buffer: Uint8Array,
    status: string,
    session: ForecastSession,
  ) => Promise<unknown>;
  waitForPresentationIdle: (session: ForecastSession) => Promise<unknown>;
}

interface StatusPorts {
  markInMemoryBlockAvailable: (
    block: ForecastBlock,
    status: string,
    session: ForecastSession,
  ) => void;
  resetBlockDownloadProgress: (block: ForecastBlock) => void;
  setBlockDownloadProgress: (block: ForecastBlock, progress: string) => void;
  setBlockStatus: (block: ForecastBlock, status: string) => void;
}

export interface ForecastBlockRefreshUseCaseOptions {
  cache: CachePorts;
  lifecycle: LifecyclePorts;
  maxParallelDownloads: number;
  network: NetworkPorts;
  presentation: PresentationPorts;
  status: StatusPorts;
  statuses: ForecastBlockStatuses;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R> | R,
) {
  const limit = pLimit(concurrency);

  return Promise.all(items.map((item, index) => limit(() => worker(item, index))));
}

function resourcesByBlockKey(resources: ForecastBlock[]) {
  return new Map(resources.map((block) => [block.key, block]));
}

export function createForecastBlockRefreshUseCase({
  statuses,
  maxParallelDownloads,
  cache,
  lifecycle,
  network,
  presentation,
  status,
}: ForecastBlockRefreshUseCaseOptions) {
  async function loadCachedBlock(
    packageKey: string,
    block: ForecastBlock,
    downloadKey: unknown,
    onAvailable: (block: ForecastBlock, buffer: Uint8Array, status: string) => Promise<unknown>,
  ): Promise<CacheLoadResult | undefined> {
    const cachedBuffer = await cache.readCachedBlock(packageKey, block);

    if (!lifecycle.isRefreshActive(downloadKey)) {
      return;
    }

    if (cachedBuffer) {
      await onAvailable(block, cachedBuffer, statuses.LOADED_FROM_CACHE);

      return { status: CACHE_LOAD_RESULT.CURRENT, block };
    }

    const staleCachedBlock = await cache.readLatestCachedBlock(packageKey, block);

    if (!lifecycle.isRefreshActive(downloadKey)) {
      return;
    }

    if (staleCachedBlock) {
      await onAvailable(block, staleCachedBlock.buffer, statuses.LOADED_FROM_CACHE);

      return { status: CACHE_LOAD_RESULT.STALE, block };
    }

    return { status: CACHE_LOAD_RESULT.MISSING, block };
  }

  async function refreshBlockFromNetwork(
    packageKey: string,
    block: ForecastBlock,
    downloadKey: unknown,
    onAvailable: (block: ForecastBlock, buffer: Uint8Array, status: string) => Promise<unknown>,
  ) {
    if (!lifecycle.isRefreshActive(downloadKey)) {
      return;
    }

    status.setBlockStatus(block, statuses.DOWNLOADING);
    status.resetBlockDownloadProgress(block);
    const buffer = await network.downloadFile(block.url, block.filesize, (loaded, total) => {
      if (!lifecycle.isRefreshActive(downloadKey)) {
        return;
      }

      status.setBlockDownloadProgress(block, `${Math.round((loaded / total) * 100)}%`);
    });
    const cacheWriteSucceeded = await cache.writeCachedBlock(packageKey, block, buffer);

    if (!lifecycle.isRefreshActive(downloadKey)) {
      return;
    }

    await onAvailable(block, buffer, statuses.READY);

    if (cacheWriteSucceeded) {
      await cache.deleteObsoleteCachedBlocks(packageKey, block);
    }
  }

  async function refreshBlocksToLatest(
    session: ForecastSession,
    { previousResources = [] }: { previousResources?: ForecastBlock[] } = {},
  ) {
    const previousBlocks = resourcesByBlockKey(previousResources);
    const enqueueAvailableBlock = async (
      block: ForecastBlock,
      buffer: Uint8Array,
      status: string,
    ) => {
      await presentation.enqueueAvailableBlock(block, buffer, status, session);
    };
    const cacheResults = await mapWithConcurrency(
      session.resources,
      maxParallelDownloads,
      async (block) => {
        if (!lifecycle.isRefreshActive(session.downloadKey)) {
          return null;
        }

        const previousBlock = previousBlocks.get(block.key);

        if (lifecycle.isBlockInMemoryCurrent(block, previousBlock)) {
          status.markInMemoryBlockAvailable(block, statuses.LOADED_FROM_CACHE, session);

          return { status: CACHE_LOAD_RESULT.CURRENT, block };
        }

        if (lifecycle.isBlockInMemoryStale(block, previousBlock)) {
          status.markInMemoryBlockAvailable(block, statuses.LOADED_FROM_CACHE, session);

          return { status: CACHE_LOAD_RESULT.STALE, block };
        }

        return loadCachedBlock(
          session.packageKey,
          block,
          session.downloadKey,
          enqueueAvailableBlock,
        );
      },
    );

    const missingBlocks = cacheResults.flatMap((result) =>
      result?.status === CACHE_LOAD_RESULT.MISSING ? [result.block] : [],
    );
    const blocksNeedingRefresh = cacheResults.flatMap((result) =>
      result?.status === CACHE_LOAD_RESULT.STALE ? [result.block] : [],
    );

    if (!lifecycle.isRefreshActive(session.downloadKey)) {
      return false;
    }

    await mapWithConcurrency(missingBlocks, maxParallelDownloads, async (block) => {
      await refreshBlockFromNetwork(
        session.packageKey,
        block,
        session.downloadKey,
        enqueueAvailableBlock,
      );
    });

    if (!lifecycle.isRefreshActive(session.downloadKey)) {
      return false;
    }

    await presentation.waitForPresentationIdle(session);

    if (!lifecycle.isRefreshActive(session.downloadKey)) {
      return false;
    }

    await mapWithConcurrency(blocksNeedingRefresh, maxParallelDownloads, async (block) => {
      await refreshBlockFromNetwork(
        session.packageKey,
        block,
        session.downloadKey,
        enqueueAvailableBlock,
      );
    });
    await presentation.waitForPresentationIdle(session);

    return lifecycle.isRefreshActive(session.downloadKey);
  }

  return {
    loadCachedBlock,
    refreshBlockFromNetwork,
    refreshBlocksToLatest,
  };
}
