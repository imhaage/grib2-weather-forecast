// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { createDom, mustFind } from "./dom.js";

function renderAppDom() {
  document.body.innerHTML = `
    <button class="tab-btn" data-tab="model"></button>
    <button class="tab-btn" data-tab="upload"></button>
    <div id="model-list"></div>
    <div id="forecast-dl-bars"></div>
    <ul id="forecast-dl-file-list"></ul>
    <p id="forecast-dl-status"></p>
    <input id="forecast-slider">
    <select id="forecast-var-select"></select>
    <button id="player-play"></button>
    <div id="cache-warmup"></div>
    <details id="data-status-panel"></details>
    <span id="data-status-summary"></span>
    <div id="map-scene"></div>
    <button id="map-back-btn"></button>
    <datalist id="palette-options"></datalist>
    <select id="palette-select"></select>
    <select id="palette-select-forecast"></select>
    <div id="drop-zone"></div>
    <input id="file-input">
    <div id="cards"></div>
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

    expect(dom.home.modelList.id).toBe("model-list");
    expect(dom.home.tabButtons).toHaveLength(2);
    expect(dom.forecastDownload.bars.id).toBe("forecast-dl-bars");
    expect(dom.forecastDownload.fileList.id).toBe("forecast-dl-file-list");
    expect(dom.forecastDownload.status.id).toBe("forecast-dl-status");
    expect(dom.forecast.slider.id).toBe("forecast-slider");
    expect(dom.forecast.variableSelect.id).toBe("forecast-var-select");
    expect(dom.player.playButton.id).toBe("player-play");
    expect(dom.cacheWarmup.root.id).toBe("cache-warmup");
    expect(dom.dataStatus.panel.id).toBe("data-status-panel");
    expect(dom.dataStatus.summary.id).toBe("data-status-summary");
    expect(dom.map.scene.id).toBe("map-scene");
    expect(dom.map.backButton.id).toBe("map-back-btn");
    expect(dom.palette.options.id).toBe("palette-options");
    expect(dom.palette.uploadSelect.id).toBe("palette-select");
    expect(dom.palette.forecastSelect.id).toBe("palette-select-forecast");
    expect(dom.upload.dropZone.id).toBe("drop-zone");
    expect(dom.upload.fileInput.id).toBe("file-input");
    expect(dom.upload.cards.id).toBe("cards");
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
