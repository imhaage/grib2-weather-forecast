import { runTimeValue } from "../domain/resources.js";

const GRIB_CACHE_DB_NAME = "grib2-visualizer-cache";
const GRIB_CACHE_DB_VERSION = 2;
const GRIB_BLOCK_STORE = "gribBlocks";

let gribCacheDbPromise = null;

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbTransactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function openGribCacheDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (gribCacheDbPromise) return gribCacheDbPromise;

  gribCacheDbPromise = new Promise((resolve) => {
    const request = indexedDB.open(GRIB_CACHE_DB_NAME, GRIB_CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(GRIB_BLOCK_STORE)
        ? request.transaction.objectStore(GRIB_BLOCK_STORE)
        : db.createObjectStore(GRIB_BLOCK_STORE, { keyPath: "id" });
      if (!store.indexNames.contains("byPackageBlock")) {
        store.createIndex("byPackageBlock", ["packageKey", "blockKey"]);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn("IndexedDB cache unavailable:", request.error);
      gribCacheDbPromise = null;
      resolve(null);
    };
    request.onblocked = () => {
      console.warn("IndexedDB cache upgrade is blocked by another tab.");
    };
  });

  return gribCacheDbPromise;
}

function gribBlockCacheKey(packageKey, block) {
  return [
    "grib2",
    packageKey,
    block.key,
    block.runId,
    block.filesize ?? "unknown-size",
    block.url,
  ].join(":");
}

function cachedGribBlockBuffer(record) {
  return record?.buffer ? new Uint8Array(record.buffer) : null;
}

function hasCompatibleCachedGribBlockSize(record, block) {
  return record.filesize == null || block.filesize == null || record.filesize === block.filesize;
}

function isUsableCachedGribBlock(record, block) {
  return (
    runTimeValue(record.runId) >= runTimeValue(block.runId) &&
    hasCompatibleCachedGribBlockSize(record, block)
  );
}

function isOlderCachedGribBlock(record, block) {
  return runTimeValue(record.runId) < runTimeValue(block.runId);
}

export function createIndexedDbGribCacheStorage() {
  return {
    async get(id) {
      const db = await openGribCacheDb();
      if (!db) return null;
      const transaction = db.transaction(GRIB_BLOCK_STORE, "readonly");
      return idbRequest(transaction.objectStore(GRIB_BLOCK_STORE).get(id));
    },

    async put(record) {
      const db = await openGribCacheDb();
      if (!db) return false;
      const transaction = db.transaction(GRIB_BLOCK_STORE, "readwrite");
      transaction.objectStore(GRIB_BLOCK_STORE).put(record);
      await idbTransactionDone(transaction);
      return true;
    },

    async findByPackageBlock(packageKey, blockKey, predicate) {
      const db = await openGribCacheDb();
      if (!db) return null;
      const transaction = db.transaction(GRIB_BLOCK_STORE, "readonly");
      const index = transaction.objectStore(GRIB_BLOCK_STORE).index("byPackageBlock");
      const range = IDBKeyRange.only([packageKey, blockKey]);
      let match = null;
      await new Promise((resolve, reject) => {
        const request = index.openCursor(range);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          const record = cursor.value;
          if (predicate(record) && (!match || String(record.savedAt) > String(match.savedAt))) {
            match = record;
          }
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
      return match;
    },

    async deleteObsolete(packageKey, blockKey, currentId) {
      const db = await openGribCacheDb();
      if (!db) return;
      const transaction = db.transaction(GRIB_BLOCK_STORE, "readwrite");
      const index = transaction.objectStore(GRIB_BLOCK_STORE).index("byPackageBlock");
      const range = IDBKeyRange.only([packageKey, blockKey]);
      await new Promise((resolve, reject) => {
        const request = index.openCursor(range);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          if (cursor.value.id !== currentId) cursor.delete();
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
      await idbTransactionDone(transaction);
    },

    async clear() {
      const db = await openGribCacheDb();
      if (!db) return;
      const transaction = db.transaction(GRIB_BLOCK_STORE, "readwrite");
      transaction.objectStore(GRIB_BLOCK_STORE).clear();
      await idbTransactionDone(transaction);
    },
  };
}

export function createGribCacheService({ storage = createIndexedDbGribCacheStorage() } = {}) {
  return {
    async readCachedGribBlock(packageKey, block) {
      try {
        const record = await storage.get(gribBlockCacheKey(packageKey, block));
        const exactBuffer = cachedGribBlockBuffer(record);
        if (exactBuffer) return exactBuffer;

        const runRecord = await storage.findByPackageBlock(packageKey, block.key, (record) =>
          isUsableCachedGribBlock(record, block),
        );
        return cachedGribBlockBuffer(runRecord);
      } catch (error) {
        console.warn("IndexedDB cache read failed:", error);
        return null;
      }
    },

    async readLatestCachedGribBlock(packageKey, block) {
      try {
        const currentId = gribBlockCacheKey(packageKey, block);
        const latest = await storage.findByPackageBlock(
          packageKey,
          block.key,
          (record) => record.id !== currentId && isOlderCachedGribBlock(record, block),
        );
        const buffer = cachedGribBlockBuffer(latest);
        return buffer ? { ...latest, buffer } : null;
      } catch (error) {
        console.warn("IndexedDB stale cache read failed:", error);
        return null;
      }
    },

    async writeCachedGribBlock(packageKey, block, buffer) {
      try {
        const cacheBuffer =
          buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength
            ? buffer.buffer
            : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const record = {
          id: gribBlockCacheKey(packageKey, block),
          packageKey,
          blockKey: block.key,
          runId: block.runId,
          url: block.url,
          filesize: block.filesize ?? null,
          savedAt: new Date().toISOString(),
          buffer: cacheBuffer,
        };
        return storage.put(record);
      } catch (error) {
        console.warn("IndexedDB cache write failed:", error);
        return false;
      }
    },

    async deleteObsoleteCachedGribBlocks(packageKey, block) {
      try {
        await storage.deleteObsolete(packageKey, block.key, gribBlockCacheKey(packageKey, block));
      } catch (error) {
        console.warn("IndexedDB obsolete cache cleanup failed:", error);
      }
    },

    async clearGribCache() {
      try {
        await storage.clear();
      } catch (error) {
        console.warn("IndexedDB cache clear failed:", error);
      }
    },
  };
}

const defaultGribCacheService = createGribCacheService();

export async function readCachedGribBlock(packageKey, block) {
  return defaultGribCacheService.readCachedGribBlock(packageKey, block);
}

export async function readLatestCachedGribBlock(packageKey, block) {
  return defaultGribCacheService.readLatestCachedGribBlock(packageKey, block);
}

export async function writeCachedGribBlock(packageKey, block, buffer) {
  return defaultGribCacheService.writeCachedGribBlock(packageKey, block, buffer);
}

export async function deleteObsoleteCachedGribBlocks(packageKey, block) {
  return defaultGribCacheService.deleteObsoleteCachedGribBlocks(packageKey, block);
}

export async function clearGribCache() {
  return defaultGribCacheService.clearGribCache();
}
