export const CACHE_LOAD_RESULT = Object.freeze({
  CURRENT: "current",
  STALE: "stale",
  MISSING: "missing",
});

function resourcesByBlockKey(resources) {
  return new Map(resources.map((block) => [block.key, block]));
}

export function createForecastBlockRefreshService({
  statuses,
  maxParallelDownloads,
  cache,
  lifecycle,
  network,
  presentation,
  status,
}) {
  async function loadCachedBlock(packageKey, block, downloadKey, onAvailable) {
    const cachedBuffer = await cache.readCachedBlock(packageKey, block);
    if (!lifecycle.isRefreshActive(downloadKey)) return;
    if (cachedBuffer) {
      await onAvailable(block, cachedBuffer, statuses.LOADED_FROM_CACHE);
      return { status: CACHE_LOAD_RESULT.CURRENT, block };
    }

    const staleCachedBlock = await cache.readLatestCachedBlock(packageKey, block);
    if (!lifecycle.isRefreshActive(downloadKey)) return;
    if (staleCachedBlock) {
      await onAvailable(block, staleCachedBlock.buffer, statuses.LOADED_FROM_CACHE);
      return { status: CACHE_LOAD_RESULT.STALE, block };
    }

    return { status: CACHE_LOAD_RESULT.MISSING, block };
  }

  async function refreshBlockFromNetwork(packageKey, block, downloadKey, onAvailable) {
    if (!lifecycle.isRefreshActive(downloadKey)) return;
    status.setBlockStatus(block, statuses.DOWNLOADING);
    status.resetBlockDownloadProgress(block);
    const buffer = await network.downloadFile(block.url, block.filesize, (loaded, total) => {
      if (!lifecycle.isRefreshActive(downloadKey)) return;
      status.setBlockDownloadProgress(block, `${Math.round((loaded / total) * 100)}%`);
    });
    const cacheWriteSucceeded = await cache.writeCachedBlock(packageKey, block, buffer);
    if (!lifecycle.isRefreshActive(downloadKey)) return;
    await onAvailable(block, buffer, statuses.READY);
    if (cacheWriteSucceeded) await cache.deleteObsoleteCachedBlocks(packageKey, block);
  }

  async function refreshBlocksToLatest(session, { previousResources = [] } = {}) {
    const previousBlocks = resourcesByBlockKey(previousResources);
    const cacheResults = await lifecycle.runWithConcurrency(
      session.resources,
      maxParallelDownloads,
      async (block) => {
        if (!lifecycle.isRefreshActive(session.downloadKey)) return null;
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
          async (block, buffer, status) => {
            await presentation.enqueueAvailableBlock(block, buffer, status, session);
          },
        );
      },
    );

    const missingBlocks = cacheResults
      .filter((result) => result?.status === CACHE_LOAD_RESULT.MISSING)
      .map((result) => result.block);
    const blocksNeedingRefresh = cacheResults
      .filter((result) => result?.status === CACHE_LOAD_RESULT.STALE)
      .map((result) => result.block);

    if (!lifecycle.isRefreshActive(session.downloadKey)) return false;
    await lifecycle.runWithConcurrency(missingBlocks, maxParallelDownloads, async (block) => {
      await refreshBlockFromNetwork(
        session.packageKey,
        block,
        session.downloadKey,
        async (block, buffer, status) => {
          await presentation.enqueueAvailableBlock(block, buffer, status, session);
        },
      );
    });
    if (!lifecycle.isRefreshActive(session.downloadKey)) return false;
    await presentation.waitForPresentationIdle(session);
    if (!lifecycle.isRefreshActive(session.downloadKey)) return false;

    await lifecycle.runWithConcurrency(
      blocksNeedingRefresh,
      maxParallelDownloads,
      async (block) => {
        await refreshBlockFromNetwork(
          session.packageKey,
          block,
          session.downloadKey,
          async (block, buffer, status) => {
            await presentation.enqueueAvailableBlock(block, buffer, status, session);
          },
        );
      },
    );
    await presentation.waitForPresentationIdle(session);
    return lifecycle.isRefreshActive(session.downloadKey);
  }

  return {
    loadCachedBlock,
    refreshBlockFromNetwork,
    refreshBlocksToLatest,
  };
}
