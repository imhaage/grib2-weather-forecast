import { describe, expect, test } from "vitest";
import {
  BLOCK_STATUS,
  type ForecastPackage,
  type ForecastRunState,
  type RemoteResource,
} from "./forecast-types";

describe("forecast type contracts", () => {
  test("exposes canonical block status values", () => {
    expect(BLOCK_STATUS).toEqual({
      MISSING: "missing",
      LOADED_FROM_CACHE: "loaded-from-cache",
      DOWNLOADING: "downloading",
      READY: "ready",
    });
  });

  test("accepts the package, resource, and run-state shapes used by the application", () => {
    const resource = {
      startHour: 1,
      endHour: 1,
      key: "01H",
      runId: "20260611T00",
      title: "forecast",
      url: "https://example.test/forecast.grib2",
      status: BLOCK_STATUS.MISSING,
    } satisfies RemoteResource;
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
    const state = {
      packageKey: "AROME_SP1",
      resourceRefreshId: 0,
      resources: [resource],
      availableBlocks: new Set<string>(),
      hourList: [1],
      blockStatus: new Map(),
      variable: null,
      currentHour: null,
      lastRunInfo: null,
      animationCacheStatus: "waiting",
      showWindDirection: true,
    } satisfies ForecastRunState;

    expect(pkg.model).toBe("AROME");
    expect(state.resources).toEqual([resource]);
  });
});
