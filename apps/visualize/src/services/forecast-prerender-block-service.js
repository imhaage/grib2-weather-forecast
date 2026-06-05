export function createForecastPrerenderBlockService({
  cache,
  getCurrentRenderGeneration,
  getCurrentState,
  keepValuesForCurrentVariable,
  mapWorkerEntry,
  renderHour,
  updateWarmupProgress,
}) {
  async function prerenderBlock(blockKey, { renderGeneration, state }) {
    const block = state.resources.find((resource) => resource.key === blockKey);
    if (!block) return;

    for (let hour = block.startHour; hour <= block.endHour; hour++) {
      if (getCurrentState() !== state || getCurrentRenderGeneration() !== renderGeneration) return;

      const hourIndex = state.hourList.indexOf(hour);
      if (hourIndex === -1 || cache.hasHour(hour)) continue;

      const entry = await renderHour(hourIndex);
      if (!entry) return;

      if (getCurrentState() === state && getCurrentRenderGeneration() === renderGeneration) {
        if (cache.hasHour(hour)) {
          entry.bitmap.close();
        } else {
          cache.setHour(
            hour,
            mapWorkerEntry(entry, {
              keepValues: keepValuesForCurrentVariable(),
            }),
          );
          updateWarmupProgress();
        }
      } else {
        entry.bitmap.close();
        return;
      }
    }
  }

  return {
    prerenderBlock,
  };
}
