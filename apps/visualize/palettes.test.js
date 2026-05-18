import test from "node:test";
import assert from "node:assert/strict";
import { buildLUT, makeScale } from "./src/domain/palettes.js";

test("buildLUT creates one RGB triplet per byte value", () => {
  const lut = buildLUT("TempC");
  assert.equal(lut.length, 256 * 3);
  assert.deepEqual([...lut.slice(0, 3)], [8, 48, 107]);
  assert.deepEqual([...lut.slice(-3)], [103, 0, 13]);
});

test("inverted palettes keep high normalized values at the first color stop", () => {
  assert.equal(makeScale("Plasma")(1).hex(), "#0d0887");
  assert.equal(makeScale("Plasma")(0).hex(), "#f0f921");
});
