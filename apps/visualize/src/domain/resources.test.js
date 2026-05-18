import { describe, expect, test } from "vitest";
import { extractRunId, formatRunId, formatRunSummary, runTimeValue } from "./resources.js";

describe("resource helpers", () => {
  test("extractRunId accepts data.gouv title and URL timestamps", () => {
    expect(extractRunId("file__01H__2026-05-15T00_00_00Z.grib2")).toBe("2026-05-15T00:00:00Z");
    expect(extractRunId("https://example.test/2026-05-15T03:00:00Z/file.grib2")).toBe(
      "2026-05-15T03:00:00Z",
    );
    expect(extractRunId("no timestamp here")).toBe("unknown-run");
  });

  test("formats and compares resource runs", () => {
    expect(formatRunId("2026-05-15T03:00:00Z")).toBe("2026-05-15 03:00 UTC");
    expect(formatRunId("unknown-run")).toBe("unknown-run");
    expect(
      formatRunSummary([{ runId: "2026-05-15T00:00:00Z" }, { runId: "2026-05-15T00:00:00Z" }]),
    ).toBe("run 2026-05-15 00:00 UTC");
    expect(
      formatRunSummary([{ runId: "2026-05-15T00:00:00Z" }, { runId: "2026-05-15T03:00:00Z" }]),
    ).toBe("mixed runs: 2026-05-15 00:00 UTC, 2026-05-15 03:00 UTC");
    expect(formatRunSummary([])).toBe("no run");
    expect(runTimeValue("2026-05-15T03:00:00Z")).toBeGreaterThan(
      runTimeValue("2026-05-15T00:00:00Z"),
    );
    expect(runTimeValue("unknown-run")).toBe(-Infinity);
  });
});
