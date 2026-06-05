import { describe, expect, test, vi } from "vitest";
import { createForecastPackageResourceService } from "./fetch-package-resources";

describe("forecast package resource use case", () => {
  test("fetches resources for a package and filters skipped hour zero resources", async () => {
    const fetchResources = vi.fn(async () => [
      { key: "00H", startHour: 0 },
      { key: "01H", startHour: 1 },
    ]);
    const service = createForecastPackageResourceService({
      fetchResources,
      isRefreshActive: vi.fn(() => true),
      packages: {
        AROME_SP1: {
          datasetId: "dataset-id",
          titlePattern: "__SP1__",
          skipHour0: true,
        },
      },
    });

    await expect(service.fetchPackageResources("AROME_SP1", { id: 1 })).resolves.toEqual([
      { key: "01H", startHour: 1 },
    ]);
    expect(fetchResources).toHaveBeenCalledWith("dataset-id", "__SP1__");
  });

  test("returns null when the refresh is no longer active after fetching", async () => {
    const service = createForecastPackageResourceService({
      fetchResources: vi.fn(async () => [{ key: "01H", startHour: 1 }]),
      isRefreshActive: vi.fn(() => false),
      packages: {
        AROME_SP1: {
          datasetId: "dataset-id",
          titlePattern: "__SP1__",
        },
      },
    });

    await expect(service.fetchPackageResources("AROME_SP1", { id: 1 })).resolves.toBeNull();
  });
});
