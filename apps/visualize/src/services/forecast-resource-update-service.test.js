import { describe, expect, test, vi } from "vitest";
import { createForecastResourceUpdateService } from "./forecast-resource-update-service.js";

describe("forecast resource update service", () => {
  test("loads latest resources, prepares a session, and refreshes blocks", async () => {
    const resources = [{ key: "01H" }];
    const previousResources = [{ key: "old-01H" }];
    const session = { id: "session" };
    const dependencies = {
      isRefreshActive: vi.fn(() => true),
      loadPackageResources: vi.fn(async () => resources),
      packages: {
        AROME_SP1: { label: "AROME SP1" },
      },
      prepareSession: vi.fn(() => session),
      refreshBlocksToLatest: vi.fn(async () => true),
      refreshStatus: vi.fn(() => "Checking 1 AROME_SP1 file..."),
      setStatus: vi.fn(),
    };
    const service = createForecastResourceUpdateService(dependencies);
    const downloadKey = {
      state: {
        packageKey: "AROME_SP1",
        resources: previousResources,
      },
    };

    await expect(service.refreshCurrentResourcesToLatest(downloadKey)).resolves.toBe(session);

    expect(dependencies.loadPackageResources).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      downloadKey,
      loadingStatus: "Checking latest files…",
    });
    expect(dependencies.prepareSession).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      pkg: { label: "AROME SP1" },
      resources,
      downloadKey,
    });
    expect(dependencies.setStatus).toHaveBeenCalledWith("Checking 1 AROME_SP1 file...");
    expect(dependencies.refreshBlocksToLatest).toHaveBeenCalledWith(session, {
      previousResources,
    });
  });

  test("returns null when the refresh is no longer active", async () => {
    const service = createForecastResourceUpdateService({
      isRefreshActive: vi.fn(() => false),
      loadPackageResources: vi.fn(),
      packages: {
        AROME_SP1: { label: "AROME SP1" },
      },
      prepareSession: vi.fn(),
      refreshBlocksToLatest: vi.fn(),
      refreshStatus: vi.fn(),
      setStatus: vi.fn(),
    });

    await expect(
      service.refreshCurrentResourcesToLatest({
        state: { packageKey: "AROME_SP1", resources: [] },
      }),
    ).resolves.toBeNull();
  });

  test("returns null when latest block refresh does not complete", async () => {
    const service = createForecastResourceUpdateService({
      isRefreshActive: vi.fn(() => true),
      loadPackageResources: vi.fn(async () => [{ key: "01H" }]),
      packages: {
        AROME_SP1: { label: "AROME SP1" },
      },
      prepareSession: vi.fn(() => ({ id: "session" })),
      refreshBlocksToLatest: vi.fn(async () => false),
      refreshStatus: vi.fn(() => "refreshing"),
      setStatus: vi.fn(),
    });

    await expect(
      service.refreshCurrentResourcesToLatest({
        state: { packageKey: "AROME_SP1", resources: [] },
      }),
    ).resolves.toBeNull();
  });
});
