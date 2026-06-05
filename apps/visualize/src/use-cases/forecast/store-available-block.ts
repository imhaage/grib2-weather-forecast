import type { ForecastAvailableBlockPorts, ForecastAvailableBlockStoreRequest } from "./ports";

export function createForecastAvailableBlockUseCase({
  incrementAvailableCount,
  invalidateBlockRenderCache,
  markBlockAvailable,
  setBlockStatus,
  storeBlock,
}: ForecastAvailableBlockPorts) {
  async function storeAvailableBlock({
    block,
    buffer,
    session,
    state,
    status,
  }: ForecastAvailableBlockStoreRequest): Promise<boolean> {
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
