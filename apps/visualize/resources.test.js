import test from "node:test";
import assert from "node:assert/strict";
import {
  extractRunId,
  formatRunId,
  formatRunSummary,
  runTimeValue,
} from "./src/domain/resources.js";

test("extractRunId accepts data.gouv title and URL timestamps", () => {
  assert.equal(
    extractRunId("file__01H__2026-05-15T00_00_00Z.grib2"),
    "2026-05-15T00:00:00Z",
  );
  assert.equal(
    extractRunId("https://example.test/2026-05-15T03:00:00Z/file.grib2"),
    "2026-05-15T03:00:00Z",
  );
  assert.equal(extractRunId("no timestamp here"), "unknown-run");
});

test("run helpers format and compare resource runs", () => {
  assert.equal(formatRunId("2026-05-15T03:00:00Z"), "2026-05-15 03:00 UTC");
  assert.equal(formatRunId("unknown-run"), "unknown-run");
  assert.equal(
    formatRunSummary([{ runId: "2026-05-15T00:00:00Z" }, { runId: "2026-05-15T00:00:00Z" }]),
    "run 2026-05-15 00:00 UTC",
  );
  assert.equal(
    formatRunSummary([{ runId: "2026-05-15T00:00:00Z" }, { runId: "2026-05-15T03:00:00Z" }]),
    "mixed runs: 2026-05-15 00:00 UTC, 2026-05-15 03:00 UTC",
  );
  assert.equal(formatRunSummary([]), "no run");
  assert.ok(runTimeValue("2026-05-15T03:00:00Z") > runTimeValue("2026-05-15T00:00:00Z"));
  assert.equal(runTimeValue("unknown-run"), -Infinity);
});
