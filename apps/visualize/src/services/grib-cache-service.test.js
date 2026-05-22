import { describe, expect, test } from "vitest";
import { createGribCacheService } from "./grib-cache-service.js";

function createMemoryStorage() {
  const records = new Map();
  const storage = {
    get(id) {
      return Promise.resolve(records.get(id) ?? null);
    },
    put(record) {
      records.set(record.id, record);
      return Promise.resolve(true);
    },
    findByPackageBlock(packageKey, blockKey, predicate) {
      let match = null;
      for (const record of records.values()) {
        if (record.packageKey !== packageKey || record.blockKey !== blockKey) continue;
        if (predicate(record) && (!match || String(record.savedAt) > String(match.savedAt))) {
          match = record;
        }
      }
      return Promise.resolve(match);
    },
    deleteObsolete(packageKey, blockKey, currentId) {
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

function bufferFrom(values) {
  return new Uint8Array(values).buffer;
}

describe("grib cache service", () => {
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

    expect([...fallback.buffer]).toEqual([2]);
    expect(fallback.runId).toBe("2026-05-22T03:00:00Z");
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
