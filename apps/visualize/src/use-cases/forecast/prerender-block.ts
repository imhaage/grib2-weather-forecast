import type { ForecastRunState } from "../../domain/forecast-types";
import type { ModelBlockRenderResult } from "../../workers/model-block-worker-contracts";
import type { ForecastAnimationCachePort, ForecastBitmapCacheEntry } from "./runtime-contracts";

export interface CreateForecastPrerenderBlockServiceOptions {
  cache: Pick<ForecastAnimationCachePort, "hasHour" | "setHour">;
  getCurrentRenderGeneration: () => number;
  getCurrentState: () => ForecastRunState | null;
  keepValuesForCurrentVariable: () => boolean;
  mapWorkerEntry: (
    entry: ModelBlockRenderResult,
    options: { keepValues: boolean },
  ) => ForecastBitmapCacheEntry;
  renderHour: (hourIndex: number) => Promise<ModelBlockRenderResult | null>;
  updateWarmupProgress: () => void;
}

interface PrerenderBlockOptions {
  renderGeneration: number;
  state: ForecastRunState;
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

    if (!block) {
      return;
    }

    for (let hour = block.startHour; hour <= block.endHour; hour++) {
      if (getCurrentState() !== state || getCurrentRenderGeneration() !== renderGeneration) {
        return;
      }

      const hourIndex = state.hourList.indexOf(hour);

      if (hourIndex === -1 || cache.hasHour(hour)) {
        continue;
      }

      const entry = await renderHour(hourIndex);

      if (!entry) {
        return;
      }

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
