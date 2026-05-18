function bitmapCacheKey(hour) {
  return `${hour}`;
}

function closeBitmapEntry(entry) {
  entry?.bitmap?.close();
}

export function createAnimationCacheService() {
  let bitmapCache = new Map();
  let prerenderQueue = [];
  let queuedPrerenderKeys = new Set();
  let isPrerendering = false;
  let idleResolvers = [];

  function resolveIdleIfNeeded() {
    if (isPrerendering || prerenderQueue.length > 0) return;
    const resolvers = idleResolvers;
    idleResolvers = [];
    for (const resolve of resolvers) resolve();
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

    keyForHour(hour) {
      return bitmapCacheKey(hour);
    },

    getHour(hour) {
      return bitmapCache.get(bitmapCacheKey(hour));
    },

    hasHour(hour) {
      return bitmapCache.has(bitmapCacheKey(hour));
    },

    setHour(hour, entry) {
      bitmapCache.set(bitmapCacheKey(hour), entry);
    },

    removeHour(hour) {
      const key = bitmapCacheKey(hour);
      const entry = bitmapCache.get(key);
      closeBitmapEntry(entry);
      bitmapCache.delete(key);
    },

    clear() {
      for (const entry of bitmapCache.values()) closeBitmapEntry(entry);
      bitmapCache = new Map();
      prerenderQueue = [];
      queuedPrerenderKeys = new Set();
      resolveIdleIfNeeded();
    },

    readyCount(hours = []) {
      let count = 0;
      for (const hour of hours) {
        if (this.hasHour(hour)) count++;
      }
      return count;
    },

    isComplete(hours = []) {
      return Boolean(hours.length) && this.readyCount(hours) === hours.length;
    },

    enqueueBlock(blockKey, gen, state) {
      const queueKey = `${gen}:${blockKey}`;
      if (queuedPrerenderKeys.has(queueKey)) return false;
      queuedPrerenderKeys.add(queueKey);
      prerenderQueue.push({ blockKey, gen, state, queueKey });
      return true;
    },

    beginDrain() {
      if (isPrerendering) return false;
      isPrerendering = true;
      return true;
    },

    nextJob() {
      return prerenderQueue.shift() ?? null;
    },

    completeJob(job) {
      queuedPrerenderKeys.delete(job.queueKey);
    },

    endDrain() {
      isPrerendering = false;
      resolveIdleIfNeeded();
    },

    waitForIdle() {
      if (!isPrerendering && prerenderQueue.length === 0) return Promise.resolve();
      return new Promise((resolve) => {
        idleResolvers.push(resolve);
      });
    },
  };
}
