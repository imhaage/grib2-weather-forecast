interface ForecastBlock {
  endHour: number;
  key: string;
  startHour: number;
}

interface ForecastPrerenderState {
  hourList: number[];
  resources: ForecastBlock[];
}

interface RenderedHourEntry {
  bitmap: {
    close: () => void;
  };
}

interface ForecastBitmapCache {
  hasHour: (hour: number) => boolean;
  setHour: (hour: number, entry: unknown) => void;
}

interface CreateForecastPrerenderBlockServiceOptions {
  cache: ForecastBitmapCache;
  getCurrentRenderGeneration: () => number;
  getCurrentState: () => unknown;
  keepValuesForCurrentVariable: () => boolean;
  mapWorkerEntry: (entry: RenderedHourEntry, options: { keepValues: boolean }) => unknown;
  renderHour: (hourIndex: number) => Promise<RenderedHourEntry | null | undefined>;
  updateWarmupProgress: () => void;
}

interface PrerenderBlockOptions {
  renderGeneration: number;
  state: ForecastPrerenderState;
}

export function createForecastPrerenderBlockService({
  cache,
  getCurrentRenderGeneration,
  getCurrentState,
  keepValuesForCurrentVariable,
  mapWorkerEntry,
  renderHour,
  updateWarmupProgress,
}: CreateForecastPrerenderBlockServiceOptions) {
  async function prerenderBlock(
    blockKey: string,
    { renderGeneration, state }: PrerenderBlockOptions,
  ) {
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
