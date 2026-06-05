import { describe, expect, test } from "vitest";
import { createForecastDownloadSessionService } from "./manage-download-session";

describe("forecast download session use case", () => {
  test("creates a download session with stable resource context", () => {
    const service = createForecastDownloadSessionService();
    const resources = [{ key: "01H" }, { key: "02H" }];
    const pkg = { variables: [{ shortName: "t" }] };
    const downloadKey = { refreshId: 1 };

    const session = service.createSession({
      packageKey: "AROME_SP1",
      pkg,
      resources,
      runSummary: "run 06Z",
      downloadKey,
    });

    expect(session).toMatchObject({
      packageKey: "AROME_SP1",
      pkg,
      pkgVars: pkg.variables,
      resources,
      runSummary: "run 06Z",
      downloadKey,
      availableCount: 0,
      legendInitialized: false,
    });
  });

  test("increments availability and formats file count status", () => {
    const service = createForecastDownloadSessionService();
    const session = service.createSession({
      packageKey: "AROME_SP1",
      pkg: { variables: [] },
      resources: [{ key: "01H" }, { key: "02H" }],
      runSummary: "run 06Z",
      downloadKey: {},
    });

    expect(service.incrementAvailableCount(session)).toBe(1);
    expect(service.fileCountStatus(session)).toBe("1 / 2 files");
  });

  test("formats initial and refresh download status messages", () => {
    const service = createForecastDownloadSessionService();
    const session = service.createSession({
      packageKey: "AROME_SP1",
      pkg: { variables: [] },
      resources: [{ key: "01H" }, { key: "02H" }],
      runSummary: "run 06Z",
      downloadKey: {},
    });

    expect(service.downloadStatus(session)).toBe("Downloading 2 AROME_SP1 files (run 06Z)…");
    expect(service.refreshStatus(session)).toBe("Checking 2 AROME_SP1 files (run 06Z)…");
  });

  test("marks every resource as missing in state and block status map", () => {
    const service = createForecastDownloadSessionService({ missingStatus: "missing" });
    const resources = [{ key: "01H" }, { key: "02H", status: "ready" }];
    const modelState = { blockStatus: new Map() };

    service.resetResourceStatuses(resources, modelState);

    expect(resources.map((resource) => resource.status)).toEqual(["missing", "missing"]);
    expect([...modelState.blockStatus.entries()]).toEqual([
      ["01H", "missing"],
      ["02H", "missing"],
    ]);
  });

  test("detects current and stale in-memory blocks", () => {
    const service = createForecastDownloadSessionService();
    const modelState = { availableBlocks: new Set(["01H", "02H"]) };

    expect(
      service.isBlockInMemoryCurrent(modelState, {
        block: { key: "01H", filesize: 10, runId: "2026-05-04T06:00:00Z" },
        previousBlock: { key: "01H", filesize: 10, runId: "2026-05-04T09:00:00Z" },
      }),
    ).toBe(true);
    expect(
      service.isBlockInMemoryStale(modelState, {
        block: { key: "02H", runId: "2026-05-04T09:00:00Z" },
        previousBlock: { key: "02H", runId: "2026-05-04T06:00:00Z" },
      }),
    ).toBe(true);
    expect(
      service.isBlockInMemoryCurrent(modelState, {
        block: { key: "03H", filesize: 10, runId: "2026-05-04T06:00:00Z" },
        previousBlock: { key: "03H", filesize: 10, runId: "2026-05-04T09:00:00Z" },
      }),
    ).toBe(false);
  });
});
