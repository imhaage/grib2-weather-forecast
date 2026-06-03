import { openDB } from "idb";
import { runTimeValue } from "../domain/resources.js";

const GRIB_CACHE_DB_NAME = "grib2-visualizer-cache";
const GRIB_CACHE_DB_VERSION = 2;
const GRIB_BLOCK_STORE = "gribBlocks";

let gribCacheDbPromise = null;

function openGribCacheDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (gribCacheDbPromise) return gribCacheDbPromise;

  gribCacheDbPromise = openDB(GRIB_CACHE_DB_NAME, GRIB_CACHE_DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      const store = db.objectStoreNames.contains(GRIB_BLOCK_STORE)
        ? transaction.objectStore(GRIB_BLOCK_STORE)
        : db.createObjectStore(GRIB_BLOCK_STORE, { keyPath: "id" });
      if (!store.indexNames.contains("byPackageBlock")) {
        store.createIndex("byPackageBlock", ["packageKey", "blockKey"]);
      }
    },
    blocked() {
      console.warn("IndexedDB cache upgrade is blocked by another tab.");
    },
  }).catch((error) => {
    console.warn("IndexedDB cache unavailable:", error);
    gribCacheDbPromise = null;
    return null;
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

export function createIndexedDbGribCacheStorage({ openDb = openGribCacheDb } = {}) {
  return {
    async get(id) {
      const db = await openDb();
      if (!db) return null;
      return db.get(GRIB_BLOCK_STORE, id);
    },

    async put(record) {
      const db = await openDb();
      if (!db) return false;
      await db.put(GRIB_BLOCK_STORE, record);
      return true;
    },

    async findByPackageBlock(packageKey, blockKey, predicate) {
      const db = await openDb();
      if (!db) return null;
      let match = null;
      const records = await db.getAllFromIndex(GRIB_BLOCK_STORE, "byPackageBlock", [
        packageKey,
        blockKey,
      ]);
      for (const record of records) {
        if (predicate(record) && (!match || String(record.savedAt) > String(match.savedAt))) {
          match = record;
        }
      }
      return match;
    },

    async deleteObsolete(packageKey, blockKey, currentId) {
      const db = await openDb();
      if (!db) return;
      const transaction = db.transaction(GRIB_BLOCK_STORE, "readwrite");
      const index = transaction.objectStore(GRIB_BLOCK_STORE).index("byPackageBlock");
      const records = await index.getAll([packageKey, blockKey]);
      await Promise.all(
        records
          .filter((record) => record.id !== currentId)
          .map((record) => transaction.objectStore(GRIB_BLOCK_STORE).delete(record.id)),
      );
      await transaction.done;
    },

    async clear() {
      const db = await openDb();
      if (!db) return;
      await db.clear(GRIB_BLOCK_STORE);
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
