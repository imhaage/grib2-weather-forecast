import { describe, expect, test, vi } from "vitest";
import {
  makeForecastDownloadSession,
  makeForecastPackage,
  makeForecastRefreshKey,
  makeRemoteResource,
} from "./forecast-test-fixtures";
import { createForecastDownloadPreparationUseCase } from "./prepare-download-session";

describe("forecast download preparation use case", () => {
  test("prepares resources and creates a download session", () => {
    const resources = [makeRemoteResource()];
    const pkg = makeForecastPackage();
    const downloadKey = makeForecastRefreshKey();
    const session = makeForecastDownloadSession({ pkg, resources, downloadKey });
    const ports = {
      applyResources: vi.fn(),
      createSession: vi.fn(() => session),
      formatRunSummary: vi.fn(() => "run 06Z"),
      renderItems: vi.fn(),
      resetResourceStatuses: vi.fn(),
    };
    const useCase = createForecastDownloadPreparationUseCase(ports);

    const result = useCase.prepareSession({
      packageKey: "AROME_SP1",
      pkg,
      resources,
      downloadKey,
    });

    expect(result).toBe(session);
    expect(ports.applyResources).toHaveBeenCalledWith(resources);
    expect(ports.renderItems).toHaveBeenCalledWith(resources);
    expect(ports.resetResourceStatuses).toHaveBeenCalledWith(resources);
    expect(ports.createSession).toHaveBeenCalledWith({
      packageKey: "AROME_SP1",
      pkg,
      resources,
      runSummary: "run 06Z",
      downloadKey,
    });
  });
});
