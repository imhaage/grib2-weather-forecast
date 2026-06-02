// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { createDom, mustFind } from "./dom.js";

function renderAppDom() {
  document.body.innerHTML = `
    <button class="tab-btn" data-tab="model"></button>
    <button class="tab-btn" data-tab="upload"></button>
    <div id="model-list"></div>
    <div id="view-home"></div>
    <div id="view-map"></div>
    <div id="forecast-dl-bars"></div>
    <ul id="forecast-dl-file-list"></ul>
    <p id="forecast-dl-status"></p>
    <input id="forecast-slider">
    <select id="forecast-var-select"></select>
    <span id="forecast-hour-label"></span>
    <span id="forecast-valid-time"></span>
    <button id="player-play"></button>
    <button id="player-reset"></button>
    <span id="icon-play"></span>
    <span id="icon-pause"></span>
    <div id="cache-warmup">
      <span id="cache-warmup-label"></span>
      <div id="cache-warmup-bar"></div>
      <span id="cache-warmup-count"></span>
    </div>
    <div id="perf-debug">
      <span id="perf-debug-render"></span>
      <span id="perf-debug-decode"></span>
      <span id="perf-debug-queue"></span>
      <span id="perf-debug-cache"></span>
      <span id="perf-debug-decoded"></span>
      <span id="perf-debug-gen"></span>
    </div>
    <details id="data-status-panel"></details>
    <span id="data-status-summary"></span>
    <div id="map-scene"></div>
    <div id="map-wrap"></div>
    <div id="map"></div>
    <div id="map-tooltip"></div>
    <div id="map-unavailable"></div>
    <button id="map-back-btn"></button>
    <div id="gv-sub"></div>
    <div id="gv-name"></div>
    <div id="gv-desc"></div>
    <div id="gv-level"></div>
    <span id="gv-min"></span>
    <span id="gv-max"></span>
    <span id="gv-mean"></span>
    <span id="gv-valid"></span>
    <div id="colorscale"></div>
    <div id="cs-bar"></div>
    <div id="cs-ticks"></div>
    <datalist id="palette-options"></datalist>
    <select id="palette-select"></select>
    <select id="palette-select-forecast"></select>
    <div id="drop-zone"></div>
    <input id="file-input">
    <div id="file-summary"></div>
    <span id="s-name"></span>
    <span id="s-size"></span>
    <span id="s-count"></span>
    <span id="s-centre"></span>
    <span id="s-reftime"></span>
    <div id="results"></div>
    <div id="cards"></div>
    <div id="status"></div>
    <button id="clear-grib-cache"></button>
    <div id="storage-warning"></div>
    <button id="storage-warning-button"></button>
    <span id="storage-warning-size"></span>
  `;
}

describe("dom registry", () => {
  test("returns required elements by structured domain", () => {
    renderAppDom();

    const dom = createDom(document);

    expect(dom.views.home.id).toBe("view-home");
    expect(dom.views.map.id).toBe("view-map");
    expect(dom.home.modelList.id).toBe("model-list");
    expect(dom.home.tabButtons).toHaveLength(2);
    expect(dom.forecastDownload.bars.id).toBe("forecast-dl-bars");
    expect(dom.forecastDownload.fileList.id).toBe("forecast-dl-file-list");
    expect(dom.forecastDownload.status.id).toBe("forecast-dl-status");
    expect(dom.forecast.slider.id).toBe("forecast-slider");
    expect(dom.forecast.variableSelect.id).toBe("forecast-var-select");
    expect(dom.forecast.hourLabel.id).toBe("forecast-hour-label");
    expect(dom.forecast.validTime.id).toBe("forecast-valid-time");
    expect(dom.player.playButton.id).toBe("player-play");
    expect(dom.player.resetButton.id).toBe("player-reset");
    expect(dom.player.iconPlay.id).toBe("icon-play");
    expect(dom.player.iconPause.id).toBe("icon-pause");
    expect(dom.cacheWarmup.root.id).toBe("cache-warmup");
    expect(dom.cacheWarmup.bar.id).toBe("cache-warmup-bar");
    expect(dom.cacheWarmup.count.id).toBe("cache-warmup-count");
    expect(dom.cacheWarmup.label.id).toBe("cache-warmup-label");
    expect(dom.perfDebug.panel.id).toBe("perf-debug");
    expect(dom.perfDebug.render.id).toBe("perf-debug-render");
    expect(dom.perfDebug.decode.id).toBe("perf-debug-decode");
    expect(dom.perfDebug.queue.id).toBe("perf-debug-queue");
    expect(dom.perfDebug.cache.id).toBe("perf-debug-cache");
    expect(dom.perfDebug.decoded.id).toBe("perf-debug-decoded");
    expect(dom.perfDebug.gen.id).toBe("perf-debug-gen");
    expect(dom.dataStatus.panel.id).toBe("data-status-panel");
    expect(dom.dataStatus.summary.id).toBe("data-status-summary");
    expect(dom.map.scene.id).toBe("map-scene");
    expect(dom.map.wrap.id).toBe("map-wrap");
    expect(dom.map.canvas.id).toBe("map");
    expect(dom.map.tooltip.id).toBe("map-tooltip");
    expect(dom.map.unavailable.id).toBe("map-unavailable");
    expect(dom.map.backButton.id).toBe("map-back-btn");
    expect(dom.mapInfo.subtitle.id).toBe("gv-sub");
    expect(dom.mapInfo.name.id).toBe("gv-name");
    expect(dom.mapInfo.description.id).toBe("gv-desc");
    expect(dom.mapInfo.level.id).toBe("gv-level");
    expect(dom.stats.min.id).toBe("gv-min");
    expect(dom.stats.max.id).toBe("gv-max");
    expect(dom.stats.mean.id).toBe("gv-mean");
    expect(dom.stats.valid.id).toBe("gv-valid");
    expect(dom.colorScale.root.id).toBe("colorscale");
    expect(dom.colorScale.bar.id).toBe("cs-bar");
    expect(dom.colorScale.ticks.id).toBe("cs-ticks");
    expect(dom.palette.options.id).toBe("palette-options");
    expect(dom.palette.uploadSelect.id).toBe("palette-select");
    expect(dom.palette.forecastSelect.id).toBe("palette-select-forecast");
    expect(dom.upload.dropZone.id).toBe("drop-zone");
    expect(dom.upload.fileInput.id).toBe("file-input");
    expect(dom.upload.summary.id).toBe("file-summary");
    expect(dom.upload.name.id).toBe("s-name");
    expect(dom.upload.size.id).toBe("s-size");
    expect(dom.upload.count.id).toBe("s-count");
    expect(dom.upload.centre.id).toBe("s-centre");
    expect(dom.upload.referenceTime.id).toBe("s-reftime");
    expect(dom.upload.results.id).toBe("results");
    expect(dom.upload.cards.id).toBe("cards");
    expect(dom.upload.status.id).toBe("status");
    expect(dom.storage.clearCacheButton.id).toBe("clear-grib-cache");
    expect(dom.storage.warning.id).toBe("storage-warning");
    expect(dom.storage.warningButton.id).toBe("storage-warning-button");
    expect(dom.storage.warningSize.id).toBe("storage-warning-size");
  });

  test("throws a clear error when a required element is missing", () => {
    document.body.innerHTML = "";

    expect(() => mustFind(document, "#missing")).toThrow(
      'Required DOM element not found: "#missing"',
    );
  });
});
