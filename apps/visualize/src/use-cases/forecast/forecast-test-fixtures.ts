import type {
  ForecastPackage,
  ForecastRunState,
  RemoteResource,
} from "../../domain/forecast-types";
import type { ForecastDownloadSession, ForecastRefreshKey } from "./contracts";

export function makeForecastPackage(overrides: Partial<ForecastPackage> = {}): ForecastPackage {
  return {
    model: "AROME",
    label: "AROME SP1",
    provider: "data-gouv",
    datasetId: "dataset",
    titlePattern: "__SP1__",
    bounds: [
      [-12, 37.5],
      [16, 55.4],
    ],
    variables: [],
    ...overrides,
  };
}

export function makeRemoteResource(overrides: Partial<RemoteResource> = {}): RemoteResource {
  return {
    startHour: 1,
    endHour: 1,
    key: "01H",
    runId: "2026-06-11T00:00:00Z",
    title: "forecast",
    url: "https://example.test/forecast.grib2",
    ...overrides,
  };
}

export function makeForecastRunState(overrides: Partial<ForecastRunState> = {}): ForecastRunState {
  return {
    packageKey: "AROME_SP1",
    resourceRefreshId: 0,
    resources: [],
    availableBlocks: new Set(),
    hourList: [],
    blockStatus: new Map(),
    variable: null,
    currentHour: null,
    lastRunInfo: null,
    animationCacheStatus: "waiting",
    showWindDirection: true,
    ...overrides,
  };
}

export function makeForecastRefreshKey(
  overrides: Partial<ForecastRefreshKey> = {},
): ForecastRefreshKey {
  const state = overrides.state ?? makeForecastRunState({ resourceRefreshId: 1 });

  return {
    state,
    refreshId: overrides.refreshId ?? state.resourceRefreshId,
  };
}

export function makeForecastDownloadSession(
  overrides: Partial<ForecastDownloadSession> = {},
): ForecastDownloadSession {
  const pkg = overrides.pkg ?? makeForecastPackage();

  return {
    packageKey: "AROME_SP1",
    pkg,
    pkgVars: pkg.variables,
    resources: [],
    runSummary: "run 06Z",
    downloadKey: makeForecastRefreshKey(),
    availableCount: 0,
    legendInitialized: false,
    ...overrides,
  };
}
