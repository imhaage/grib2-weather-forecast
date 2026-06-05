export function createForecastTooltipHydrationService({
  clearTimer = clearTimeout,
  decodeValues,
  delayMs = 140,
  getCachedEntry,
  getCurrentRenderGeneration,
  getCurrentState,
  isPlayerPlaying,
  makeGridState,
  onError = console.error,
  setGridState,
  setTimer = setTimeout,
  updateIsobarOverlay,
}) {
  let timer = null;
  let token = 0;

  function clearQueuedTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function invalidate() {
    token++;
    clearQueuedTimer();
  }

  async function hydrate({ hour, hourIndex, renderGeneration, state, hydrationToken }) {
    const data = await decodeValues(hourIndex, hour);
    if (
      !data ||
      getCurrentState() !== state ||
      getCurrentRenderGeneration() !== renderGeneration ||
      token !== hydrationToken ||
      state.currentHour !== hour
    ) {
      return;
    }

    const cachedEntry = getCachedEntry(hour);
    if (!cachedEntry) return;
    const hydratedEntry = {
      ...cachedEntry,
      vectorComposite: data.vectorComposite ?? cachedEntry.vectorComposite,
      vectorUValues: data.vectorUValues ?? cachedEntry.vectorUValues,
      vectorVValues: data.vectorVValues ?? cachedEntry.vectorVValues,
    };
    setGridState(makeGridState(hydratedEntry, data.values));
    updateIsobarOverlay(cachedEntry, data.values);
  }

  function queue({ hour, hourIndex, renderGeneration }) {
    invalidate();
    if (isPlayerPlaying()) return;

    const hydrationToken = token;
    const state = getCurrentState();
    timer = setTimer(() => {
      timer = null;
      if (isPlayerPlaying()) return;
      hydrate({ hour, hourIndex, renderGeneration, state, hydrationToken }).catch((error) =>
        onError("hydrateTooltipValues:", error),
      );
    }, delayMs);
  }

  return {
    invalidate,
    queue,
  };
}
