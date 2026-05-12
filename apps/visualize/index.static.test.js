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

test("cached bitmaps are shown before decoding values for the same hour", () => {
  assert.match(
    source,
    /function bitmapCacheKey\(hour\)/,
    "expected a stable cache key helper independent from decoded render params",
  );
  assert.match(
    source,
    /const cachedEntry = bitmapCache\.get\(cacheKey\);[\s\S]*if \(cachedEntry\) \{[\s\S]*return;[\s\S]*const data = await getCachedDecode\(hour\);/,
    "expected showHour to use cached bitmaps before decoding values",
  );
  assert.match(
    source,
    /values: values \?\? null,/,
    "expected cached bitmap hits to avoid retaining decoded values for tooltips",
  );
});

test("cached bitmap hits hydrate tooltip values lazily after presentation", () => {
  assert.match(
    source,
    /let tooltipHydrateTimer = null;/,
    "expected tooltip hydration to be debounced independently from rendering",
  );
  assert.match(
    source,
    /function queueTooltipValueHydration\(idx, hour\)/,
    "expected cached frames to schedule tooltip values separately",
  );
  assert.match(
    source,
    /await presentBitmapEntry\(hour, cachedEntry\);[\s\S]*queueTooltipValueHydration\(idx, hour\);[\s\S]*return;/,
    "expected cached frames to paint before scheduling tooltip value decode",
  );
  assert.match(
    source,
    /if \(playerInterval !== null\) return;/,
    "expected animation playback not to trigger tooltip value decoding",
  );
  assert.match(
    source,
    /function queueCurrentTooltipValueHydration\(\)/,
    "expected a helper to hydrate the visible frame after playback stops",
  );
  assert.match(
    source,
    /setPlaying\(false\);[\s\S]*queueCurrentTooltipValueHydration\(\);/,
    "expected stopping playback to restore tooltip values for the visible frame",
  );
});

test("CAPE keeps zero values visible in the static color scale", () => {
  assert.doesNotMatch(
    source,
    /cape:\s*\{[^}]*zeroThreshold/,
    "expected CAPE zero values to remain visible instead of transparent",
  );
});
