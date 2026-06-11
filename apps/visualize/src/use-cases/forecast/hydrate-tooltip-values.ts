interface TooltipHydrationData {
  values?: Float32Array;
  vectorComposite?: unknown;
  vectorUValues?: Float32Array | null;
  vectorVValues?: Float32Array | null;
}

interface TooltipCachedEntry {
  vectorComposite?: unknown;
  vectorUValues?: Float32Array;
  vectorVValues?: Float32Array;
  [key: string]: unknown;
}

interface TooltipState {
  currentHour?: number;
}

interface QueueTooltipHydrationOptions {
  hour: number;
  hourIndex: number;
  renderGeneration: number;
}

interface HydrateTooltipValuesOptions extends QueueTooltipHydrationOptions {
  hydrationToken: number;
  state: TooltipState;
}

interface CreateForecastTooltipHydrationServiceOptions<TTimer> {
  clearTimer?: (timer: TTimer) => void;
  decodeValues: (hourIndex: number, hour: number) => Promise<TooltipHydrationData | null>;
  delayMs?: number;
  getCachedEntry: (hour: number) => TooltipCachedEntry | null | undefined;
  getCurrentRenderGeneration: () => number;
  getCurrentState: () => TooltipState;
  isPlayerPlaying: () => boolean;
  makeGridState: (entry: TooltipCachedEntry, values?: Float32Array) => unknown;
  onError?: (...args: unknown[]) => void;
  setGridState: (gridState: unknown) => void;
  setTimer?: (callback: () => void, delayMs: number) => TTimer;
  updateIsobarOverlay: (cachedEntry: TooltipCachedEntry, values?: Float32Array) => void;
}

export function createForecastTooltipHydrationService<TTimer = ReturnType<typeof setTimeout>>({
  clearTimer = clearTimeout as (timer: TTimer) => void,
  decodeValues,
  delayMs = 140,
  getCachedEntry,
  getCurrentRenderGeneration,
  getCurrentState,
  isPlayerPlaying,
  makeGridState,
  onError = console.error,
  setGridState,
  setTimer = setTimeout as unknown as (callback: () => void, delayMs: number) => TTimer,
  updateIsobarOverlay,
}: CreateForecastTooltipHydrationServiceOptions<TTimer>) {
  let timer: TTimer | null = null;
  let token = 0;

  function clearQueuedTimer() {
    if (timer !== null) {
      clearTimer(timer);
    }

    timer = null;
  }

  function invalidate() {
    token++;
    clearQueuedTimer();
  }

  async function hydrate({
    hour,
    hourIndex,
    renderGeneration,
    state,
    hydrationToken,
  }: HydrateTooltipValuesOptions) {
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

    if (!cachedEntry) {
      return;
    }

    const hydratedEntry = {
      ...cachedEntry,
      vectorComposite: data.vectorComposite ?? cachedEntry.vectorComposite,
      vectorUValues: data.vectorUValues ?? cachedEntry.vectorUValues,
      vectorVValues: data.vectorVValues ?? cachedEntry.vectorVValues,
    };
    setGridState(makeGridState(hydratedEntry, data.values));
    updateIsobarOverlay(cachedEntry, data.values);
  }

  function queue({ hour, hourIndex, renderGeneration }: QueueTooltipHydrationOptions) {
    invalidate();

    if (isPlayerPlaying()) {
      return;
    }

    const hydrationToken = token;
    const state = getCurrentState();
    timer = setTimer(() => {
      timer = null;

      if (isPlayerPlaying()) {
        return;
      }

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
