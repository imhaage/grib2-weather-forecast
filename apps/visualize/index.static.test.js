import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("./index.js", import.meta.url), "utf8");

test("model downloads keep the map scene hidden until every file is downloaded", () => {
  assert.match(
    source,
    /function setMapSceneVisible\(/,
    "expected a dedicated map scene visibility helper",
  );
  assert.match(
    source,
    /setMapSceneVisible\(false\)[\s\S]*const downloadKey = modelState/,
    "expected startDownload to hide the map scene before download work begins",
  );
  assert.match(
    source,
    /if \(doneCount === resources\.length\) \{[\s\S]*setMapSceneVisible\(true\)/,
    "expected download completion to reveal the map scene explicitly",
  );
});

test("model pre-rendering is scheduled through a single queue", () => {
  assert.match(
    source,
    /let prerenderQueue = \[\];/,
    "expected explicit queue state",
  );
  assert.match(
    source,
    /async function drainPrerenderQueue\(/,
    "expected a single queue drain loop",
  );
  assert.doesNotMatch(
    source,
    /Promise\.all\(\s*\[\.\.\.modelState\.buffers\.keys\(\)\]\.map\(k => prerenderBlock\(k\)\)\s*\)/,
    "expected no global parallel pre-render after palette or variable changes",
  );
  assert.match(
    source,
    /queuePrerenderForAllBlocks\(\);/,
    "expected callers to enqueue all blocks instead of rendering them directly",
  );
});

test("decoded value cache is limited to current and adjacent working fields", () => {
  assert.match(
    source,
    /const DECODED_CACHE_SIZE = 2;/,
    "expected decoded Float64Array cache to stay small while bitmap cache handles playback",
  );
});

test("message index stores block offsets instead of copied message buffers", () => {
  assert.match(
    source,
    /function messageViewFromRef\(/,
    "expected message references to be resolved into views only at decode time",
  );
  assert.match(
    source,
    /index\.set\(`\$\{ft\}_\$\{product\.shortName\}_\$\{product\.levelValue\}`, messageRef\);/,
    "expected indexed messages to store a lightweight reference",
  );
  assert.doesNotMatch(
    source,
    /index\.set\([^;]+msg\.buffer\)/,
    "expected messageIndex not to retain message buffer copies",
  );
});

test("worker rendering can transfer owned values without cloning", () => {
  assert.match(
    source,
    /function renderViaWorker\(values, renderParams, outW, outH, \{ transferValues = false \} = \{\}\)/,
    "expected renderViaWorker to expose explicit transfer ownership",
  );
  assert.match(
    source,
    /const workerValues = transferValues \? values : values\.slice\(\);/,
    "expected values.slice() only when ownership is not transferred",
  );
  assert.match(
    source,
    /transferValues: canTransferValues/,
    "expected background pre-rendering to opt into transfer when safe",
  );
});

test("model display values use Float32Array instead of retaining Float64Array precision", () => {
  assert.match(
    source,
    /function toDisplayValues\(values\)/,
    "expected a dedicated display-value conversion helper",
  );
  assert.match(
    source,
    /const out = new Float32Array\(values\.length\);/,
    "expected model display values to be downcast to Float32Array",
  );
  assert.match(
    source,
    /const diff = new Float32Array\(values\.length\);/,
    "expected accumulation diffs to be allocated as Float32Array",
  );
  assert.match(
    source,
    /values: toDisplayValues\(displayValues\),/,
    "expected render params to expose Float32Array display values",
  );
});
