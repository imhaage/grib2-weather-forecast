import { describe, expect, test, vi } from "vitest";
import {
  makeForecastDownloadSession,
  makeForecastPackage,
  makeForecastRefreshKey,
  makeForecastRunState,
  makeRemoteResource,
} from "./forecast-test-fixtures";
import { createForecastResourceUpdateUseCase } from "./update-resources";

describe("forecast resource update use case", () => {
  test("loads latest resources, prepares a session, and refreshes blocks", async () => {
    const resources = [makeRemoteResource()];
    const previousResources = [makeRemoteResource({ key: "old-01H" })];
    const pkg = makeForecastPackage();
    const state = makeForecastRunState({
      resourceRefreshId: 1,
      resources: previousResources,
    });
    const downloadKey = makeForecastRefreshKey({ state });
    const session = makeForecastDownloadSession({ pkg, resources, downloadKey });
    const ports = {
      isRefreshActive: vi.fn(() => true),
      loadPackageResources: vi.fn(async () => resources),
      packages: {
        AROME_SP1: pkg,
      },
      prepareSession: vi.fn(() => session),
      refreshBlocksToLatest: vi.fn(async () => true),
      refreshStatus: vi.fn(() => "Checking 1 AROME_SP1 file..."),
      setStatus: vi.fn(),
    };
    const useCase = createForecastResourceUpdateUseCase(ports);
    await expect(useCase.refreshCurrentResourcesToLatest(downloadKey)).resolves.toBe(session);

    expect(ports.loadPackageResources).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      downloadKey,
      loadingStatus: "Checking latest files…",
    });
    expect(ports.prepareSession).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      pkg,
      resources,
      downloadKey,
    });
    expect(ports.setStatus).toHaveBeenCalledWith("Checking 1 AROME_SP1 file...");
    expect(ports.refreshBlocksToLatest).toHaveBeenCalledWith(session, {
      previousResources,
    });
  });

  test("returns null when the refresh is no longer active", async () => {
    const pkg = makeForecastPackage();
    const downloadKey = makeForecastRefreshKey();
    const useCase = createForecastResourceUpdateUseCase({
      isRefreshActive: vi.fn(() => false),
      loadPackageResources: vi.fn(async () => null),
      packages: {
        AROME_SP1: pkg,
      },
      prepareSession: vi.fn(() => makeForecastDownloadSession({ pkg, downloadKey })),
      refreshBlocksToLatest: vi.fn(async () => false),
      refreshStatus: vi.fn(() => "refreshing"),
      setStatus: vi.fn(),
    });

    await expect(useCase.refreshCurrentResourcesToLatest(downloadKey)).resolves.toBeNull();
  });

  test("returns null when latest block refresh does not complete", async () => {
    const resources = [makeRemoteResource()];
    const pkg = makeForecastPackage();
    const downloadKey = makeForecastRefreshKey();
    const session = makeForecastDownloadSession({ pkg, resources, downloadKey });
    const useCase = createForecastResourceUpdateUseCase({
      isRefreshActive: vi.fn(() => true),
      loadPackageResources: vi.fn(async () => resources),
      packages: {
        AROME_SP1: pkg,
      },
      prepareSession: vi.fn(() => session),
      refreshBlocksToLatest: vi.fn(async () => false),
      refreshStatus: vi.fn(() => "refreshing"),
      setStatus: vi.fn(),
    });

    await expect(useCase.refreshCurrentResourcesToLatest(downloadKey)).resolves.toBeNull();
  });
});
