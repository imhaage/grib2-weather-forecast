import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultPaletteFor,
  parameterDescriptionFor,
  staticScaleFor,
  variableKeyFor,
} from "./variable-metadata.js";

test("variableKeyFor prefers explicit varKey over shortName", () => {
  assert.equal(variableKeyFor({ shortName: "wspd", varKey: "wspd_10" }), "wspd_10");
  assert.equal(variableKeyFor({ shortName: "t" }), "t");
});

test("variable metadata helpers expose display metadata with safe fallbacks", () => {
  assert.equal(defaultPaletteFor("t"), "TempC");
  assert.equal(defaultPaletteFor("unknown"), null);
  assert.match(parameterDescriptionFor("cape"), /thunderstorm development/);
  assert.equal(parameterDescriptionFor("unknown"), "");
  assert.deepEqual(staticScaleFor("rrate"), {
    min: 0,
    max: 150,
    log: true,
    zeroThreshold: 0.005,
  });
  assert.equal(staticScaleFor("unknown"), null);
});
