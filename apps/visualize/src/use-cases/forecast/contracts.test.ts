import { describe, expect, test } from "vitest";
import {
  BLOCK_STATUS,
  type ForecastPackage,
  type ForecastRunState,
  type ForecastVariable,
} from "../../domain/forecast-types";
import type { ForecastDownloadSession, ForecastRefreshKey } from "./contracts";

describe("forecast workflow contracts", () => {
  test("models refresh identity and download session without DOM elements", () => {
    const state = {
      packageKey: "AROME_SP1",
      resourceRefreshId: 1,
      resources: [],
      availableBlocks: new Set<string>(),
      hourList: [],
      blockStatus: new Map(),
      variable: null,
      currentHour: null,
      lastRunInfo: null,
      animationCacheStatus: "waiting",
      showWindDirection: true,
    } satisfies ForecastRunState;
    const pkg = {
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
    } satisfies ForecastPackage;
    const refreshKey = { state, refreshId: 1 } satisfies ForecastRefreshKey;
    const session = {
      packageKey: "AROME_SP1",
      pkg,
      pkgVars: [] satisfies ForecastVariable[],
      resources: [],
      runSummary: "2026-06-11 00:00 UTC",
      downloadKey: refreshKey,
      availableCount: 0,
      legendInitialized: false,
    } satisfies ForecastDownloadSession;

    expect(session.downloadKey.state.blockStatus.size).toBe(0);
    expect(BLOCK_STATUS.READY).toBe("ready");
  });
});
