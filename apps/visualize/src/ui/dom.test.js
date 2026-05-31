// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { createDom, mustFind } from "./dom.js";

function renderAppDom() {
  document.body.innerHTML = `
    <div id="forecast-dl-bars"></div>
    <ul id="forecast-dl-file-list"></ul>
    <p id="forecast-dl-status"></p>
    <input id="forecast-slider">
    <select id="forecast-var-select"></select>
    <div id="cache-warmup"></div>
    <details id="data-status-panel"></details>
    <span id="data-status-summary"></span>
    <div id="map-scene"></div>
    <datalist id="palette-options"></datalist>
    <select id="palette-select"></select>
    <select id="palette-select-forecast"></select>
  `;
}

describe("dom registry", () => {
  test("returns required elements by structured domain", () => {
    renderAppDom();

    const dom = createDom(document);

    expect(dom.forecastDownload.bars.id).toBe("forecast-dl-bars");
    expect(dom.forecastDownload.fileList.id).toBe("forecast-dl-file-list");
    expect(dom.forecastDownload.status.id).toBe("forecast-dl-status");
    expect(dom.forecast.slider.id).toBe("forecast-slider");
    expect(dom.forecast.variableSelect.id).toBe("forecast-var-select");
    expect(dom.cacheWarmup.root.id).toBe("cache-warmup");
    expect(dom.dataStatus.panel.id).toBe("data-status-panel");
    expect(dom.dataStatus.summary.id).toBe("data-status-summary");
    expect(dom.map.scene.id).toBe("map-scene");
    expect(dom.palette.options.id).toBe("palette-options");
    expect(dom.palette.uploadSelect.id).toBe("palette-select");
    expect(dom.palette.forecastSelect.id).toBe("palette-select-forecast");
  });

  test("throws a clear error when a required element is missing", () => {
    document.body.innerHTML = "";

    expect(() => mustFind(document, "#missing")).toThrow(
      'Required DOM element not found: "#missing"',
    );
  });
});
