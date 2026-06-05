import { describe, expect, test, vi } from "vitest";
import { createForecastResourceUpdateUseCase } from "./update-resources";

describe("forecast resource update use case", () => {
  test("loads latest resources, prepares a session, and refreshes blocks", async () => {
    const resources = [{ key: "01H" }];
    const previousResources = [{ key: "old-01H" }];
    const session = { id: "session" };
    const ports = {
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
    const useCase = createForecastResourceUpdateUseCase(ports);
    const downloadKey = {
      state: {
        packageKey: "AROME_SP1",
        resources: previousResources,
      },
    };

    await expect(useCase.refreshCurrentResourcesToLatest(downloadKey)).resolves.toBe(session);

    expect(ports.loadPackageResources).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      downloadKey,
      loadingStatus: "Checking latest files…",
    });
    expect(ports.prepareSession).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      pkg: { label: "AROME SP1" },
      resources,
      downloadKey,
    });
    expect(ports.setStatus).toHaveBeenCalledWith("Checking 1 AROME_SP1 file...");
    expect(ports.refreshBlocksToLatest).toHaveBeenCalledWith(session, {
      previousResources,
    });
  });

  test("returns null when the refresh is no longer active", async () => {
    const useCase = createForecastResourceUpdateUseCase({
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
      useCase.refreshCurrentResourcesToLatest({
        state: { packageKey: "AROME_SP1", resources: [] },
      }),
    ).resolves.toBeNull();
  });

  test("returns null when latest block refresh does not complete", async () => {
    const useCase = createForecastResourceUpdateUseCase({
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
      useCase.refreshCurrentResourcesToLatest({
        state: { packageKey: "AROME_SP1", resources: [] },
      }),
    ).resolves.toBeNull();
  });
});
