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
  runWithConcurrency,
  isRefreshActive,
  isBlockInMemoryCurrent,
  isBlockInMemoryStale,
  markInMemoryBlockAvailable,
  readCachedBlock,
  readLatestCachedBlock,
  setBlockStatus,
  resetBlockDownloadProgress,
  setBlockDownloadProgress,
  downloadFile,
  writeCachedBlock,
  deleteObsoleteCachedBlocks,
  enqueueAvailableBlock,
  waitForPresentationIdle,
}) {
  async function loadCachedBlock(packageKey, block, downloadKey, onAvailable) {
    const cachedBuffer = await readCachedBlock(packageKey, block);
    if (!isRefreshActive(downloadKey)) return;
    if (cachedBuffer) {
      await onAvailable(block, cachedBuffer, statuses.LOADED_FROM_CACHE);
      return { status: CACHE_LOAD_RESULT.CURRENT, block };
    }

    const staleCachedBlock = await readLatestCachedBlock(packageKey, block);
    if (!isRefreshActive(downloadKey)) return;
    if (staleCachedBlock) {
      await onAvailable(block, staleCachedBlock.buffer, statuses.LOADED_FROM_CACHE);
      return { status: CACHE_LOAD_RESULT.STALE, block };
    }

    return { status: CACHE_LOAD_RESULT.MISSING, block };
  }

  async function refreshBlockFromNetwork(packageKey, block, downloadKey, onAvailable) {
    if (!isRefreshActive(downloadKey)) return;
    setBlockStatus(block, statuses.DOWNLOADING);
    resetBlockDownloadProgress(block);
    const buffer = await downloadFile(block.url, block.filesize, (loaded, total) => {
      if (!isRefreshActive(downloadKey)) return;
      setBlockDownloadProgress(block, `${Math.round((loaded / total) * 100)}%`);
    });
    const cacheWriteSucceeded = await writeCachedBlock(packageKey, block, buffer);
    if (!isRefreshActive(downloadKey)) return;
    await onAvailable(block, buffer, statuses.READY);
    if (cacheWriteSucceeded) await deleteObsoleteCachedBlocks(packageKey, block);
  }

  async function refreshBlocksToLatest(session, { previousResources = [] } = {}) {
    const previousBlocks = resourcesByBlockKey(previousResources);
    const cacheResults = await runWithConcurrency(
      session.resources,
      maxParallelDownloads,
      async (block) => {
        if (!isRefreshActive(session.downloadKey)) return null;
        const previousBlock = previousBlocks.get(block.key);
        if (isBlockInMemoryCurrent(block, previousBlock)) {
          markInMemoryBlockAvailable(block, statuses.LOADED_FROM_CACHE, session);
          return { status: CACHE_LOAD_RESULT.CURRENT, block };
        }
        if (isBlockInMemoryStale(block, previousBlock)) {
          markInMemoryBlockAvailable(block, statuses.LOADED_FROM_CACHE, session);
          return { status: CACHE_LOAD_RESULT.STALE, block };
        }
        return loadCachedBlock(
          session.packageKey,
          block,
          session.downloadKey,
          async (block, buffer, status) => {
            await enqueueAvailableBlock(block, buffer, status, session);
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

    if (!isRefreshActive(session.downloadKey)) return false;
    await runWithConcurrency(missingBlocks, maxParallelDownloads, async (block) => {
      await refreshBlockFromNetwork(
        session.packageKey,
        block,
        session.downloadKey,
        async (block, buffer, status) => {
          await enqueueAvailableBlock(block, buffer, status, session);
        },
      );
    });
    if (!isRefreshActive(session.downloadKey)) return false;
    await waitForPresentationIdle(session);
    if (!isRefreshActive(session.downloadKey)) return false;

    await runWithConcurrency(blocksNeedingRefresh, maxParallelDownloads, async (block) => {
      await refreshBlockFromNetwork(
        session.packageKey,
        block,
        session.downloadKey,
        async (block, buffer, status) => {
          await enqueueAvailableBlock(block, buffer, status, session);
        },
      );
    });
    await waitForPresentationIdle(session);
    return isRefreshActive(session.downloadKey);
  }

  return {
    loadCachedBlock,
    refreshBlockFromNetwork,
    refreshBlocksToLatest,
  };
}
