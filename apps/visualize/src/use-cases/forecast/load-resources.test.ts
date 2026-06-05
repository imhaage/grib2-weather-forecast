import { describe, expect, test, vi } from "vitest";
import { createForecastResourceLoadUseCase } from "./load-resources";

describe("forecast resource load use case", () => {
  test("loads package resources with the provided loading status", async () => {
    const resources = [{ key: "01H" }];
    const setStatus = vi.fn();
    const useCase = createForecastResourceLoadUseCase({
      fetchPackageResources: vi.fn(async () => resources),
      isRefreshActive: vi.fn(() => true),
      setStatus,
    });

    await expect(
      useCase.loadPackageResources({
        packageKey: "AROME_SP1",
        downloadKey: { id: 1 },
        loadingStatus: "Fetching file list...",
      }),
    ).resolves.toBe(resources);

    expect(setStatus).toHaveBeenCalledWith("Fetching file list...");
  });

  test("reports API errors only while the refresh is active", async () => {
    const setStatus = vi.fn();
    const useCase = createForecastResourceLoadUseCase({
      fetchPackageResources: vi.fn(async () => {
        throw new Error("network down");
      }),
      isRefreshActive: vi.fn(() => true),
      setStatus,
    });

    await expect(
      useCase.loadPackageResources({
        packageKey: "AROME_SP1",
        downloadKey: { id: 1 },
        loadingStatus: "Checking latest files...",
      }),
    ).resolves.toBeNull();

    expect(setStatus).toHaveBeenLastCalledWith("API error: network down");
  });

  test("does not report API errors after the refresh was superseded", async () => {
    const setStatus = vi.fn();
    const useCase = createForecastResourceLoadUseCase({
      fetchPackageResources: vi.fn(async () => {
        throw new Error("network down");
      }),
      isRefreshActive: vi.fn(() => false),
      setStatus,
    });

    await useCase.loadPackageResources({
      packageKey: "AROME_SP1",
      downloadKey: { id: 1 },
      loadingStatus: "Checking latest files...",
    });

    expect(setStatus).toHaveBeenCalledTimes(1);
  });
});
