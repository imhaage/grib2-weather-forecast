import { describe, expect, test, vi } from "vitest";
import {
  makeForecastDownloadSession,
  makeForecastPackage,
  makeForecastRefreshKey,
  makeRemoteResource,
} from "./forecast-test-fixtures";
import { createForecastInitialDownloadUseCase } from "./start-initial-download";

describe("forecast initial download use case", () => {
  test("loads initial resources, prepares a session, and refreshes blocks", async () => {
    const resources = [makeRemoteResource()];
    const pkg = makeForecastPackage();
    const downloadKey = makeForecastRefreshKey();
    const session = makeForecastDownloadSession({ pkg, resources, downloadKey });
    const ports = {
      isRefreshActive: vi.fn(() => true),
      loadPackageResources: vi.fn(async () => resources),
      prepareSession: vi.fn(() => session),
      refreshBlocksToLatest: vi.fn(async () => true),
      downloadStatus: vi.fn(() => "Downloading 1 AROME_SP1 file..."),
      setStatus: vi.fn(),
    };
    const useCase = createForecastInitialDownloadUseCase(ports);
    await expect(
      useCase.startInitialDownload({
        packageKey: "AROME_SP1",
        pkg,
        downloadKey,
      }),
    ).resolves.toBe(session);

    expect(ports.loadPackageResources).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      downloadKey,
      loadingStatus: "Fetching file list…",
    });
    expect(ports.prepareSession).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      pkg,
      resources,
      downloadKey,
    });
    expect(ports.setStatus).toHaveBeenCalledWith("Downloading 1 AROME_SP1 file...");
    expect(ports.refreshBlocksToLatest).toHaveBeenCalledWith(session);
  });

  test("returns null when resources are not available anymore", async () => {
    const resources = [makeRemoteResource()];
    const pkg = makeForecastPackage();
    const downloadKey = makeForecastRefreshKey();
    const useCase = createForecastInitialDownloadUseCase({
      isRefreshActive: vi.fn(() => false),
      loadPackageResources: vi.fn(async () => resources),
      prepareSession: vi.fn(() => makeForecastDownloadSession({ pkg, resources, downloadKey })),
      refreshBlocksToLatest: vi.fn(async () => false),
      downloadStatus: vi.fn(() => "downloading"),
      setStatus: vi.fn(),
    });

    await expect(
      useCase.startInitialDownload({
        packageKey: "AROME_SP1",
        pkg,
        downloadKey,
      }),
    ).resolves.toBeNull();
  });

  test("returns null when latest block refresh does not complete", async () => {
    const resources = [makeRemoteResource()];
    const pkg = makeForecastPackage();
    const downloadKey = makeForecastRefreshKey();
    const session = makeForecastDownloadSession({ pkg, resources, downloadKey });
    const useCase = createForecastInitialDownloadUseCase({
      isRefreshActive: vi.fn(() => true),
      loadPackageResources: vi.fn(async () => resources),
      prepareSession: vi.fn(() => session),
      refreshBlocksToLatest: vi.fn(async () => false),
      downloadStatus: vi.fn(() => "downloading"),
      setStatus: vi.fn(),
    });

    await expect(
      useCase.startInitialDownload({
        packageKey: "AROME_SP1",
        pkg,
        downloadKey,
      }),
    ).resolves.toBeNull();
  });
});
