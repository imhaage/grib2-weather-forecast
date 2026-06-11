import type { ForecastRunState } from "../../domain/forecast-types";
import type {
  ForecastAnimationCachePort,
  ForecastBitmapCacheEntry,
  ForecastPrerenderJob,
} from "./runtime-contracts";

function bitmapCacheKey(hour: number) {
  return `${hour}`;
}

function closeBitmapEntry(entry: ForecastBitmapCacheEntry | undefined) {
  entry?.bitmap?.close();
}

export function createAnimationCacheService(): ForecastAnimationCachePort {
  let bitmapCache = new Map<string, ForecastBitmapCacheEntry>();
  let prerenderQueue: ForecastPrerenderJob[] = [];
  let queuedPrerenderKeys = new Set<string>();
  let isPrerendering = false;
  let idleResolvers: Array<() => void> = [];

  function resolveIdleIfNeeded() {
    if (isPrerendering || prerenderQueue.length > 0) {
      return;
    }

    const resolvers = idleResolvers;
    idleResolvers = [];

    for (const resolve of resolvers) {
      resolve();
    }
  }

  return {
    get size() {
      return bitmapCache.size;
    },

    get queueLength() {
      return prerenderQueue.length;
    },

    get isPrerendering() {
      return isPrerendering;
    },

    keyForHour(hour: number) {
      return bitmapCacheKey(hour);
    },

    getHour(hour: number) {
      return bitmapCache.get(bitmapCacheKey(hour));
    },

    hasHour(hour: number) {
      return bitmapCache.has(bitmapCacheKey(hour));
    },

    setHour(hour: number, entry: ForecastBitmapCacheEntry) {
      bitmapCache.set(bitmapCacheKey(hour), entry);
    },

    removeHour(hour: number) {
      const key = bitmapCacheKey(hour);
      const entry = bitmapCache.get(key);
      closeBitmapEntry(entry);
      bitmapCache.delete(key);
    },

    clear() {
      for (const entry of bitmapCache.values()) {
        closeBitmapEntry(entry);
      }

      bitmapCache = new Map();
      prerenderQueue = [];
      queuedPrerenderKeys = new Set();
      resolveIdleIfNeeded();
    },

    readyCount(hours: number[] = []) {
      let count = 0;

      for (const hour of hours) {
        if (this.hasHour(hour)) {
          count++;
        }
      }

      return count;
    },

    isComplete(hours: number[] = []) {
      return Boolean(hours.length) && this.readyCount(hours) === hours.length;
    },

    enqueueBlock(blockKey: string, renderGeneration: number, state: ForecastRunState) {
      const queueKey = `${renderGeneration}:${blockKey}`;

      if (queuedPrerenderKeys.has(queueKey)) {
        return false;
      }

      queuedPrerenderKeys.add(queueKey);
      prerenderQueue.push({ blockKey, renderGeneration, state, queueKey });

      return true;
    },

    beginDrain() {
      if (isPrerendering) {
        return false;
      }

      isPrerendering = true;

      return true;
    },

    nextJob() {
      return prerenderQueue.shift() ?? null;
    },

    completeJob(job: ForecastPrerenderJob) {
      queuedPrerenderKeys.delete(job.queueKey);
    },

    endDrain() {
      isPrerendering = false;
      resolveIdleIfNeeded();
    },

    waitForIdle() {
      if (!isPrerendering && prerenderQueue.length === 0) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        idleResolvers.push(resolve);
      });
    },
  };
}
