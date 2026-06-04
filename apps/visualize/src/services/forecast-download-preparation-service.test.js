import { describe, expect, test, vi } from "vitest";
import { createForecastDownloadPreparationService } from "./forecast-download-preparation-service.js";

describe("forecast download preparation service", () => {
  test("prepares resources and creates a download session", () => {
    const resources = [{ key: "01H" }];
    const session = { id: "session" };
    const dependencies = {
      applyResources: vi.fn(),
      createSession: vi.fn(() => session),
      formatRunSummary: vi.fn(() => "run 06Z"),
      renderItems: vi.fn(),
      resetResourceStatuses: vi.fn(),
    };
    const service = createForecastDownloadPreparationService(dependencies);

    const result = service.prepareSession({
      packageKey: "AROME_SP1",
      pkg: { label: "AROME" },
      resources,
      downloadKey: { id: 1 },
    });

    expect(result).toBe(session);
    expect(dependencies.applyResources).toHaveBeenCalledWith(resources);
    expect(dependencies.renderItems).toHaveBeenCalledWith(resources);
    expect(dependencies.resetResourceStatuses).toHaveBeenCalledWith(resources);
    expect(dependencies.createSession).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      pkg: { label: "AROME" },
      resources,
      runSummary: "run 06Z",
      downloadKey: { id: 1 },
    });
  });
});
