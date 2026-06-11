import pLimit from "p-limit";
import type { BlockStatus, CacheLoadStatus, RemoteResource } from "../../domain/forecast-types";
import type { ForecastDownloadSession, ForecastRefreshKey } from "./contracts";

export const CACHE_LOAD_RESULT = Object.freeze({
  CURRENT: "current",
  STALE: "stale",
  MISSING: "missing",
});

interface CacheLoadResult {
  block: RemoteResource;
  status: CacheLoadStatus;
}

interface ForecastBlockStatuses {
  DOWNLOADING: BlockStatus;
  LOADED_FROM_CACHE: BlockStatus;
  READY: BlockStatus;
}

interface CachePorts {
  deleteObsoleteCachedBlocks: (packageKey: string, block: RemoteResource) => Promise<void>;
  readCachedBlock: (packageKey: string, block: RemoteResource) => Promise<Uint8Array | null>;
  readLatestCachedBlock: (
    packageKey: string,
    block: RemoteResource,
  ) => Promise<{ buffer: Uint8Array } | null>;
  writeCachedBlock: (
    packageKey: string,
    block: RemoteResource,
    buffer: Uint8Array,
  ) => Promise<boolean>;
}

interface LifecyclePorts {
  isBlockInMemoryCurrent: (block: RemoteResource, previousBlock?: RemoteResource) => boolean;
  isBlockInMemoryStale: (block: RemoteResource, previousBlock?: RemoteResource) => boolean;
  isRefreshActive: (downloadKey: ForecastRefreshKey) => boolean;
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
    block: RemoteResource,
    buffer: Uint8Array,
    status: BlockStatus,
    session: ForecastDownloadSession,
  ) => Promise<void>;
  waitForPresentationIdle: (session: ForecastDownloadSession) => Promise<void>;
}

interface StatusPorts {
  markInMemoryBlockAvailable: (
    block: RemoteResource,
    status: BlockStatus,
    session: ForecastDownloadSession,
  ) => void;
  resetBlockDownloadProgress: (block: RemoteResource) => void;
  setBlockDownloadProgress: (block: RemoteResource, progress: string) => void;
  setBlockStatus: (block: RemoteResource, status: BlockStatus) => void;
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

function resourcesByBlockKey(resources: RemoteResource[]) {
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
    block: RemoteResource,
    downloadKey: ForecastRefreshKey,
    onAvailable: (block: RemoteResource, buffer: Uint8Array, status: BlockStatus) => Promise<void>,
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
    block: RemoteResource,
    downloadKey: ForecastRefreshKey,
    onAvailable: (block: RemoteResource, buffer: Uint8Array, status: BlockStatus) => Promise<void>,
  ): Promise<void> {
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
    session: ForecastDownloadSession,
    { previousResources = [] }: { previousResources?: RemoteResource[] } = {},
  ): Promise<boolean> {
    const previousBlocks = resourcesByBlockKey(previousResources);
    const enqueueAvailableBlock = async (
      block: RemoteResource,
      buffer: Uint8Array,
      status: BlockStatus,
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
