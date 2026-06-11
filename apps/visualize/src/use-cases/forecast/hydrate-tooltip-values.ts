import type { ForecastRunState } from "../../domain/forecast-types";
import type { ModelBlockDecodeValuesResult } from "../../workers/model-block-worker-contracts";
import type { ForecastBitmapCacheEntry } from "./runtime-contracts";

interface QueueTooltipHydrationOptions {
  hour: number;
  hourIndex: number;
  renderGeneration: number;
}

interface HydrateTooltipValuesOptions extends QueueTooltipHydrationOptions {
  hydrationToken: number;
  state: ForecastRunState;
}

export interface CreateForecastTooltipHydrationServiceOptions<TTimer> {
  clearTimer: (timer: TTimer) => void;
  decodeValues: (hourIndex: number, hour: number) => Promise<ModelBlockDecodeValuesResult | null>;
  delayMs?: number;
  getCachedEntry: (hour: number) => ForecastBitmapCacheEntry | null | undefined;
  getCurrentRenderGeneration: () => number;
  getCurrentState: () => ForecastRunState;
  isPlayerPlaying: () => boolean;
  makeGridState: (entry: ForecastBitmapCacheEntry, values?: Float32Array) => unknown;
  onError?: (...args: unknown[]) => void;
  setGridState: (gridState: unknown) => void;
  setTimer: (callback: () => void, delayMs: number) => TTimer;
  updateIsobarOverlay: (cachedEntry: ForecastBitmapCacheEntry, values?: Float32Array) => void;
}

export function createForecastTooltipHydrationService<TTimer>({
  clearTimer,
  decodeValues,
  delayMs = 140,
  getCachedEntry,
  getCurrentRenderGeneration,
  getCurrentState,
  isPlayerPlaying,
  makeGridState,
  onError = console.error,
  setGridState,
  setTimer,
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
