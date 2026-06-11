import { openDB } from "idb";
import type { RemoteResource } from "../../domain/forecast-types";
import { runTimeValue } from "../../domain/resources.js";

const GRIB_CACHE_DB_NAME = "grib2-visualizer-cache";
const GRIB_CACHE_DB_VERSION = 2;
const GRIB_BLOCK_STORE = "gribBlocks";

export interface GribCacheRecord {
  blockKey: string;
  buffer?: ArrayBuffer | Uint8Array | null;
  filesize?: number | null;
  id: string;
  packageKey: string;
  runId?: string | null;
  savedAt?: string;
  url?: string;
}

export interface GribCacheStorage {
  clear: () => Promise<void>;
  deleteObsolete: (packageKey: string, blockKey: string, currentId: string) => Promise<void>;
  findByPackageBlock: (
    packageKey: string,
    blockKey: string,
    predicate: (record: GribCacheRecord) => boolean,
  ) => Promise<GribCacheRecord | null>;
  get: (id: string) => Promise<GribCacheRecord | null>;
  put: (record: GribCacheRecord) => Promise<boolean>;
}

interface GribCacheIndex {
  getAll: (key: [string, string]) => Promise<GribCacheRecord[]> | GribCacheRecord[];
}

interface GribCacheObjectStore {
  delete: (id: string) => Promise<void> | void;
  index: (name: string) => GribCacheIndex;
}

interface GribCacheTransaction {
  done: Promise<void>;
  objectStore: (storeName: string) => GribCacheObjectStore;
}

interface GribCacheDb {
  clear: (storeName: string) => Promise<void> | void;
  get: (storeName: string, id: string) => Promise<GribCacheRecord | null> | GribCacheRecord | null;
  getAllFromIndex: (
    storeName: string,
    indexName: string,
    key: [string, string],
  ) => Promise<GribCacheRecord[]> | GribCacheRecord[];
  put: (storeName: string, record: GribCacheRecord) => Promise<unknown> | unknown;
  transaction: (storeName: string, mode: "readwrite") => GribCacheTransaction;
}

type OpenGribCacheDb = () => Promise<GribCacheDb | null>;

let gribCacheDbPromise: Promise<GribCacheDb | null> | null = null;

function openGribCacheDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  if (gribCacheDbPromise) {
    return gribCacheDbPromise;
  }

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
  })
    .then((db) => db as unknown as GribCacheDb)
    .catch((error) => {
      console.warn("IndexedDB cache unavailable:", error);
      gribCacheDbPromise = null;

      return null;
    });

  return gribCacheDbPromise;
}

function gribBlockCacheKey(packageKey: string, block: RemoteResource) {
  return [
    "grib2",
    packageKey,
    block.key,
    block.runId,
    block.filesize ?? "unknown-size",
    block.url,
  ].join(":");
}

function cachedGribBlockBuffer(record?: GribCacheRecord | null) {
  return record?.buffer ? new Uint8Array(record.buffer) : null;
}

function copyToArrayBuffer(buffer: Uint8Array) {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);

  return copy.buffer;
}

function hasCompatibleCachedGribBlockSize(record: GribCacheRecord, block: RemoteResource) {
  return record.filesize == null || block.filesize == null || record.filesize === block.filesize;
}

function isUsableCachedGribBlock(record: GribCacheRecord, block: RemoteResource) {
  return (
    runTimeValue(record.runId) >= runTimeValue(block.runId) &&
    hasCompatibleCachedGribBlockSize(record, block)
  );
}

function isOlderCachedGribBlock(record: GribCacheRecord, block: RemoteResource) {
  return runTimeValue(record.runId) < runTimeValue(block.runId);
}

export function createIndexedDbGribCacheStorage({
  openDb = openGribCacheDb,
}: {
  openDb?: OpenGribCacheDb;
} = {}) {
  return {
    async get(id: string) {
      const db = await openDb();

      if (!db) {
        return null;
      }

      return db.get(GRIB_BLOCK_STORE, id);
    },

    async put(record: GribCacheRecord) {
      const db = await openDb();

      if (!db) {
        return false;
      }

      await db.put(GRIB_BLOCK_STORE, record);

      return true;
    },

    async findByPackageBlock(
      packageKey: string,
      blockKey: string,
      predicate: (record: GribCacheRecord) => boolean,
    ) {
      const db = await openDb();

      if (!db) {
        return null;
      }

      let match: GribCacheRecord | null = null;
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

    async deleteObsolete(packageKey: string, blockKey: string, currentId: string) {
      const db = await openDb();

      if (!db) {
        return;
      }

      const transaction = db.transaction(GRIB_BLOCK_STORE, "readwrite");
      const index = transaction.objectStore(GRIB_BLOCK_STORE).index("byPackageBlock");
      const records = await index.getAll([packageKey, blockKey]);
      await Promise.all(
        records
          .filter((record: GribCacheRecord) => record.id !== currentId)
          .map((record: GribCacheRecord) =>
            transaction.objectStore(GRIB_BLOCK_STORE).delete(record.id),
          ),
      );
      await transaction.done;
    },

    async clear() {
      const db = await openDb();

      if (!db) {
        return;
      }

      await db.clear(GRIB_BLOCK_STORE);
    },
  };
}

export function createGribCacheService({
  storage = createIndexedDbGribCacheStorage(),
}: {
  storage?: GribCacheStorage;
} = {}) {
  return {
    async readCachedGribBlock(packageKey: string, block: RemoteResource) {
      try {
        const record = await storage.get(gribBlockCacheKey(packageKey, block));
        const exactBuffer = cachedGribBlockBuffer(record);

        if (exactBuffer) {
          return exactBuffer;
        }

        const runRecord = await storage.findByPackageBlock(packageKey, block.key, (record) =>
          isUsableCachedGribBlock(record, block),
        );

        return cachedGribBlockBuffer(runRecord);
      } catch (error) {
        console.warn("IndexedDB cache read failed:", error);

        return null;
      }
    },

    async readLatestCachedGribBlock(packageKey: string, block: RemoteResource) {
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

    async writeCachedGribBlock(packageKey: string, block: RemoteResource, buffer: Uint8Array) {
      try {
        const cacheBuffer = copyToArrayBuffer(buffer);
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

    async deleteObsoleteCachedGribBlocks(packageKey: string, block: RemoteResource) {
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

export async function readCachedGribBlock(packageKey: string, block: RemoteResource) {
  return defaultGribCacheService.readCachedGribBlock(packageKey, block);
}

export async function readLatestCachedGribBlock(packageKey: string, block: RemoteResource) {
  return defaultGribCacheService.readLatestCachedGribBlock(packageKey, block);
}

export async function writeCachedGribBlock(
  packageKey: string,
  block: RemoteResource,
  buffer: Uint8Array,
) {
  return defaultGribCacheService.writeCachedGribBlock(packageKey, block, buffer);
}

export async function deleteObsoleteCachedGribBlocks(packageKey: string, block: RemoteResource) {
  return defaultGribCacheService.deleteObsoleteCachedGribBlocks(packageKey, block);
}

export async function clearGribCache() {
  return defaultGribCacheService.clearGribCache();
}
