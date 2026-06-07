import { describe, expect, test } from "vitest";
import {
  createGribCacheService,
  type GribCacheRecord,
  type GribCacheStorage,
} from "./grib-cache-adapter";

type MemoryRecord = GribCacheRecord;

interface MemoryDbStore {
  clear: () => void;
  delete: (id: string) => void;
  get: (id: string) => MemoryRecord | null;
  index: () => {
    getAll: (key: [string, string]) => MemoryRecord[];
  };
  put: (record: MemoryRecord) => void;
}

interface MemoryDb {
  clear: (storeName: string) => void;
  get: (storeName: string, id: string) => MemoryRecord | null;
  getAllFromIndex: (storeName: string, indexName: string, key: [string, string]) => MemoryRecord[];
  put: (storeName: string, record: MemoryRecord) => void;
  transaction: () => {
    done: Promise<void>;
    objectStore: () => MemoryDbStore;
  };
}

function createMemoryStorage() {
  const records = new Map<string, MemoryRecord>();
  const storage: GribCacheStorage = {
    get(id: string) {
      return Promise.resolve(records.get(id) ?? null);
    },
    put(record: MemoryRecord) {
      records.set(record.id, record);

      return Promise.resolve(true);
    },
    findByPackageBlock(
      packageKey: string,
      blockKey: string,
      predicate: (record: MemoryRecord) => boolean,
    ) {
      let match: MemoryRecord | null = null;

      for (const record of records.values()) {
        if (record.packageKey !== packageKey || record.blockKey !== blockKey) {
          continue;
        }

        if (predicate(record) && (!match || String(record.savedAt) > String(match.savedAt))) {
          match = record;
        }
      }

      return Promise.resolve(match);
    },
    deleteObsolete(packageKey: string, blockKey: string, currentId: string) {
      for (const record of records.values()) {
        if (
          record.packageKey === packageKey &&
          record.blockKey === blockKey &&
          record.id !== currentId
        ) {
          records.delete(record.id);
        }
      }

      return Promise.resolve();
    },
    clear() {
      records.clear();

      return Promise.resolve();
    },
  };

  return { records, storage };
}

function bufferFrom(values: number[]) {
  return new Uint8Array(values).buffer;
}

describe("grib cache adapter", () => {
  test("stores and reads cached GRIB blocks through an injected storage adapter", async () => {
    const { storage } = createMemoryStorage();
    const service = createGribCacheService({ storage });
    const block = {
      key: "01H",
      runId: "2026-05-22T03:00:00Z",
      filesize: 3,
      url: "https://example.test/arome__SP1__01H.grib2",
    };
    const buffer = new Uint8Array([1, 2, 3]);

    await expect(service.writeCachedGribBlock("AROME_SP1", block, buffer)).resolves.toBe(true);
    await expect(service.readCachedGribBlock("AROME_SP1", block)).resolves.toEqual(buffer);
  });

  test("reads the latest older cached block as stale fallback", async () => {
    const { records, storage } = createMemoryStorage();
    const service = createGribCacheService({ storage });
    const block = {
      key: "01H",
      runId: "2026-05-22T06:00:00Z",
      filesize: 3,
      url: "https://example.test/latest.grib2",
    };
    records.set("old", {
      id: "old",
      packageKey: "AROME_SP1",
      blockKey: "01H",
      runId: "2026-05-22T00:00:00Z",
      savedAt: "2026-05-22T00:30:00Z",
      buffer: bufferFrom([1]),
    });
    records.set("newer-old", {
      id: "newer-old",
      packageKey: "AROME_SP1",
      blockKey: "01H",
      runId: "2026-05-22T03:00:00Z",
      savedAt: "2026-05-22T03:30:00Z",
      buffer: bufferFrom([2]),
    });

    const fallback = await service.readLatestCachedGribBlock("AROME_SP1", block);

    expect([...(fallback?.buffer ?? [])]).toEqual([2]);
    expect(fallback?.runId).toBe("2026-05-22T03:00:00Z");
  });

  test("uses a compatible cached block from the same or newer run", async () => {
    const { records, storage } = createMemoryStorage();
    const service = createGribCacheService({ storage });
    const block = {
      key: "01H",
      runId: "2026-05-22T03:00:00Z",
      filesize: 3,
      url: "https://example.test/requested.grib2",
    };
    records.set("compatible", {
      id: "compatible",
      packageKey: "AROME_SP1",
      blockKey: "01H",
      runId: "2026-05-22T06:00:00Z",
      filesize: 3,
      savedAt: "2026-05-22T06:30:00Z",
      buffer: bufferFrom([7]),
    });

    await expect(service.readCachedGribBlock("AROME_SP1", block)).resolves.toEqual(
      new Uint8Array([7]),
    );
  });

  test("deletes obsolete cached blocks after a current block is stored", async () => {
    const { records, storage } = createMemoryStorage();
    const service = createGribCacheService({ storage });
    const block = {
      key: "01H",
      runId: "2026-05-22T06:00:00Z",
      filesize: 3,
      url: "https://example.test/current.grib2",
    };
    records.set("obsolete", {
      id: "obsolete",
      packageKey: "AROME_SP1",
      blockKey: "01H",
      runId: "2026-05-22T03:00:00Z",
      savedAt: "2026-05-22T03:30:00Z",
      buffer: bufferFrom([1]),
    });

    await service.writeCachedGribBlock("AROME_SP1", block, new Uint8Array([2, 3, 4]));
    await service.deleteObsoleteCachedGribBlocks("AROME_SP1", block);

    expect([...records.keys()]).toHaveLength(1);
    expect([...records.values()][0]).toMatchObject({
      packageKey: "AROME_SP1",
      blockKey: "01H",
      runId: "2026-05-22T06:00:00Z",
    });
  });
});

describe("indexeddb grib cache storage", () => {
  test("finds and deletes records through the package/block index", async () => {
    const records = new Map<string, MemoryRecord>();
    const store: MemoryDbStore = {
      clear: () => {
        records.clear();
      },
      delete: (id: string) => {
        records.delete(id);
      },
      get: (id: string) => records.get(id) ?? null,
      index: () => ({
        getAll: ([packageKey, blockKey]: [string, string]) =>
          [...records.values()].filter(
            (record) => record.packageKey === packageKey && record.blockKey === blockKey,
          ),
      }),
      put: (record: MemoryRecord) => {
        records.set(record.id, record);
      },
    };
    const db: MemoryDb = {
      clear: () => store.clear(),
      get: (_storeName: string, id: string) => store.get(id),
      getAllFromIndex: (_storeName: string, _indexName: string, key: [string, string]) =>
        store.index().getAll(key),
      put: (_storeName: string, record: MemoryRecord) => store.put(record),
      transaction: () => ({
        done: Promise.resolve(),
        objectStore: () => store,
      }),
    };
    const { createIndexedDbGribCacheStorage } = await import("./grib-cache-adapter");
    const storage = createIndexedDbGribCacheStorage({ openDb: async () => db });

    await storage.put({
      id: "old",
      packageKey: "AROME_SP1",
      blockKey: "01H",
      savedAt: "2026-05-22T00:00:00Z",
    });
    await storage.put({
      id: "current",
      packageKey: "AROME_SP1",
      blockKey: "01H",
      savedAt: "2026-05-22T03:00:00Z",
    });

    await expect(
      storage.findByPackageBlock("AROME_SP1", "01H", (record) => record.id !== "current"),
    ).resolves.toMatchObject({ id: "old" });

    await storage.deleteObsolete("AROME_SP1", "01H", "current");

    expect([...records.keys()]).toEqual(["current"]);
  });
});
