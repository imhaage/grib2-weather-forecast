import { describe, expect, test } from "vitest";
import { createForecastDownloadSessionService } from "./forecast-download-session-service.js";

describe("forecast download session service", () => {
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
});
