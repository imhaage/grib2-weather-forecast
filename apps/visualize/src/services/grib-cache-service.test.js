import { describe, expect, test } from "vitest";
import { createGribCacheService } from "./grib-cache-service.js";

function createMemoryStorage() {
  const records = new Map();
  return {
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
}

describe("grib cache service", () => {
  test("stores and reads cached GRIB blocks through an injected storage adapter", async () => {
    const service = createGribCacheService({ storage: createMemoryStorage() });
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
});
