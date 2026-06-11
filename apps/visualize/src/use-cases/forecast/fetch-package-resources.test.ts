import { describe, expect, test, vi } from "vitest";
import { createForecastPackageResourceService } from "./fetch-package-resources";
import {
  makeForecastPackage,
  makeForecastRefreshKey,
  makeRemoteResource,
} from "./forecast-test-fixtures";

describe("forecast package resource use case", () => {
  test("fetches resources for a package and filters skipped hour zero resources", async () => {
    const hourZero = makeRemoteResource({ key: "00H", startHour: 0, endHour: 0 });
    const hourOne = makeRemoteResource();
    const fetchResources = vi.fn(async () => [hourZero, hourOne]);
    const service = createForecastPackageResourceService({
      fetchResources,
      isRefreshActive: vi.fn(() => true),
      packages: {
        AROME_SP1: makeForecastPackage({
          datasetId: "dataset-id",
          titlePattern: "__SP1__",
          skipHour0: true,
        }),
      },
    });

    await expect(
      service.fetchPackageResources("AROME_SP1", makeForecastRefreshKey()),
    ).resolves.toEqual([hourOne]);
    expect(fetchResources).toHaveBeenCalledWith("dataset-id", "__SP1__");
  });

  test("returns null when the refresh is no longer active after fetching", async () => {
    const service = createForecastPackageResourceService({
      fetchResources: vi.fn(async () => [makeRemoteResource()]),
      isRefreshActive: vi.fn(() => false),
      packages: {
        AROME_SP1: makeForecastPackage({
          datasetId: "dataset-id",
          titlePattern: "__SP1__",
        }),
      },
    });

    await expect(
      service.fetchPackageResources("AROME_SP1", makeForecastRefreshKey()),
    ).resolves.toBeNull();
  });
});
