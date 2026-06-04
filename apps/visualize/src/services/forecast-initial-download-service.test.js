import { describe, expect, test, vi } from "vitest";
import { createForecastInitialDownloadService } from "./forecast-initial-download-service.js";

describe("forecast initial download service", () => {
  test("loads initial resources, prepares a session, and refreshes blocks", async () => {
    const resources = [{ key: "01H" }];
    const session = { id: "session" };
    const dependencies = {
      isRefreshActive: vi.fn(() => true),
      loadPackageResources: vi.fn(async () => resources),
      prepareSession: vi.fn(() => session),
      refreshBlocksToLatest: vi.fn(async () => true),
      downloadStatus: vi.fn(() => "Downloading 1 AROME_SP1 file..."),
      setStatus: vi.fn(),
    };
    const service = createForecastInitialDownloadService(dependencies);
    const downloadKey = { id: 1 };
    const pkg = { label: "AROME SP1" };

    await expect(
      service.startInitialDownload({
        packageKey: "AROME_SP1",
        pkg,
        downloadKey,
      }),
    ).resolves.toBe(session);

    expect(dependencies.loadPackageResources).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      downloadKey,
      loadingStatus: "Fetching file list…",
    });
    expect(dependencies.prepareSession).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      pkg,
      resources,
      downloadKey,
    });
    expect(dependencies.setStatus).toHaveBeenCalledWith("Downloading 1 AROME_SP1 file...");
    expect(dependencies.refreshBlocksToLatest).toHaveBeenCalledWith(session);
  });

  test("returns null when resources are not available anymore", async () => {
    const service = createForecastInitialDownloadService({
      isRefreshActive: vi.fn(() => false),
      loadPackageResources: vi.fn(async () => [{ key: "01H" }]),
      prepareSession: vi.fn(),
      refreshBlocksToLatest: vi.fn(),
      downloadStatus: vi.fn(),
      setStatus: vi.fn(),
    });

    await expect(
      service.startInitialDownload({
        packageKey: "AROME_SP1",
        pkg: {},
        downloadKey: { id: 1 },
      }),
    ).resolves.toBeNull();
  });

  test("returns null when latest block refresh does not complete", async () => {
    const service = createForecastInitialDownloadService({
      isRefreshActive: vi.fn(() => true),
      loadPackageResources: vi.fn(async () => [{ key: "01H" }]),
      prepareSession: vi.fn(() => ({ id: "session" })),
      refreshBlocksToLatest: vi.fn(async () => false),
      downloadStatus: vi.fn(() => "downloading"),
      setStatus: vi.fn(),
    });

    await expect(
      service.startInitialDownload({
        packageKey: "AROME_SP1",
        pkg: {},
        downloadKey: { id: 1 },
      }),
    ).resolves.toBeNull();
  });
});
