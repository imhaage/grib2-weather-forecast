import { describe, expect, test, vi } from "vitest";
import {
  createDataGouvResourceService,
  parseDataGouvResources,
  proxyDataGouvUrl,
  proxyResourceUrl,
} from "./data-gouv-resource-service.js";

describe("data.gouv resource service", () => {
  test("builds proxied resource URLs", () => {
    expect(proxyResourceUrl("https://example.test/path/file.grib2?x=1", "https://proxy.test")).toBe(
      "https://proxy.test/example.test/path/file.grib2?x=1",
    );
  });

  test("builds proxied data.gouv dataset URLs", () => {
    expect(proxyDataGouvUrl("dataset-1", "https://proxy.test")).toBe(
      "https://proxy.test/www.data.gouv.fr/api/1/datasets/dataset-1/",
    );
  });

  test("parses matching single-hour and ranged GRIB resources sorted by start hour", () => {
    const resources = [
      {
        format: "grib2",
        title: "arome__02H03H__SP1__2026-05-15T03_00_00Z.grib2",
        url: "https://example.test/arome__02H03H.grib2",
        filesize: 200,
      },
      {
        format: "txt",
        title: "arome__01H__SP1__2026-05-15T03_00_00Z.txt",
        url: "https://example.test/arome__01H.txt",
        filesize: 1,
      },
      {
        format: "grib2",
        title: "arome__01H__SP1__2026-05-15T03_00_00Z.grib2",
        url: "https://example.test/arome__01H.grib2",
        filesize: 100,
      },
      {
        format: "grib2",
        title: "arome__04H__HP1__2026-05-15T03_00_00Z.grib2",
        url: "https://example.test/arome__04H.grib2",
        filesize: 400,
      },
    ];

    expect(parseDataGouvResources(resources, "SP1")).toEqual([
      {
        startHour: 1,
        endHour: 1,
        key: "01H",
        runId: "2026-05-15T03:00:00Z",
        title: "arome__01H__SP1__2026-05-15T03_00_00Z.grib2",
        url: "https://example.test/arome__01H.grib2",
        filesize: 100,
      },
      {
        startHour: 2,
        endHour: 3,
        key: "02H03H",
        runId: "2026-05-15T03:00:00Z",
        title: "arome__02H03H__SP1__2026-05-15T03_00_00Z.grib2",
        url: "https://example.test/arome__02H03H.grib2",
        filesize: 200,
      },
    ]);
  });

  test("fetches proxied dataset resources with injected fetch and surfaces API errors", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        resources: [
          {
            format: "grib2",
            title: "arome__01H__SP1__2026-05-15T03_00_00Z.grib2",
            url: "https://example.test/arome__01H.grib2",
            filesize: 100,
          },
        ],
      }),
    }));
    const service = createDataGouvResourceService({
      proxyBaseUrl: "https://proxy.test",
      fetchImpl,
    });

    await expect(service.fetchResources("dataset-1", "SP1")).resolves.toEqual([
      {
        startHour: 1,
        endHour: 1,
        key: "01H",
        runId: "2026-05-15T03:00:00Z",
        title: "arome__01H__SP1__2026-05-15T03_00_00Z.grib2",
        url: "https://example.test/arome__01H.grib2",
        filesize: 100,
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://proxy.test/www.data.gouv.fr/api/1/datasets/dataset-1/",
    );

    fetchImpl.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(service.fetchResources("dataset-1", "SP1")).rejects.toThrow("API 503");
  });
});
