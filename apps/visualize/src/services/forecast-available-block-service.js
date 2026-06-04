export function createForecastAvailableBlockService({
  incrementAvailableCount,
  invalidateBlockRenderCache,
  markBlockAvailable,
  setBlockStatus,
  storeBlock,
}) {
  async function storeAvailableBlock({ block, buffer, session, state, status }) {
    const hadBuffer = state.availableBlocks.has(block.key);
    if (hadBuffer) {
      invalidateBlockRenderCache(block);
    }

    const storedInWorker = await storeBlock(block, buffer);
    if (!storedInWorker) return false;

    markBlockAvailable(state, block);
    setBlockStatus(block, status);
    if (!hadBuffer) incrementAvailableCount(session);
    return true;
  }

  return {
    storeAvailableBlock,
  };
}
