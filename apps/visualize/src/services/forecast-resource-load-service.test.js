import { describe, expect, test, vi } from "vitest";
import { createForecastResourceLoadService } from "./forecast-resource-load-service.js";

describe("forecast resource load service", () => {
  test("loads package resources with the provided loading status", async () => {
    const resources = [{ key: "01H" }];
    const setStatus = vi.fn();
    const service = createForecastResourceLoadService({
      fetchPackageResources: vi.fn(async () => resources),
      isRefreshActive: vi.fn(() => true),
      setStatus,
    });

    await expect(
      service.loadPackageResources({
        packageKey: "AROME_SP1",
        downloadKey: { id: 1 },
        loadingStatus: "Fetching file list...",
      }),
    ).resolves.toBe(resources);

    expect(setStatus).toHaveBeenCalledWith("Fetching file list...");
  });

  test("reports API errors only while the refresh is active", async () => {
    const setStatus = vi.fn();
    const service = createForecastResourceLoadService({
      fetchPackageResources: vi.fn(async () => {
        throw new Error("network down");
      }),
      isRefreshActive: vi.fn(() => true),
      setStatus,
    });

    await expect(
      service.loadPackageResources({
        packageKey: "AROME_SP1",
        downloadKey: { id: 1 },
        loadingStatus: "Checking latest files...",
      }),
    ).resolves.toBeNull();

    expect(setStatus).toHaveBeenLastCalledWith("API error: network down");
  });

  test("does not report API errors after the refresh was superseded", async () => {
    const setStatus = vi.fn();
    const service = createForecastResourceLoadService({
      fetchPackageResources: vi.fn(async () => {
        throw new Error("network down");
      }),
      isRefreshActive: vi.fn(() => false),
      setStatus,
    });

    await service.loadPackageResources({
      packageKey: "AROME_SP1",
      downloadKey: { id: 1 },
      loadingStatus: "Checking latest files...",
    });

    expect(setStatus).toHaveBeenCalledTimes(1);
  });
});
