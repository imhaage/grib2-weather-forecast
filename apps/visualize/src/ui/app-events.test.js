// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { bindAppEvents } from "./app-events.js";

function renderEventsDom() {
  document.body.innerHTML = `
    <button id="map-back-btn"></button>
    <select id="palette-select"></select>
    <select id="palette-select-forecast"></select>
    <select id="forecast-var-select"></select>
    <input id="forecast-wind-direction-toggle" type="checkbox">
    <input id="forecast-slider">
    <button id="clear-grib-cache"></button>
    <button id="storage-warning-close"></button>
    <button id="storage-warning-button" aria-expanded="false"></button>
    <button id="player-play"></button>
  `;
}

function createEventDom() {
  return {
    map: {
      backButton: document.getElementById("map-back-btn"),
    },
    palette: {
      uploadSelect: document.getElementById("palette-select"),
      forecastSelect: document.getElementById("palette-select-forecast"),
    },
    forecast: {
      variableSelect: document.getElementById("forecast-var-select"),
      windDirectionToggle: document.getElementById("forecast-wind-direction-toggle"),
      slider: document.getElementById("forecast-slider"),
    },
    storage: {
      clearCacheButton: document.getElementById("clear-grib-cache"),
      warningCloseButton: document.getElementById("storage-warning-close"),
      warningButton: document.getElementById("storage-warning-button"),
    },
    player: {
      playButton: document.getElementById("player-play"),
    },
  };
}

describe("app events", () => {
  test("binds static app event listeners and can unbind them together", () => {
    renderEventsDom();
    const handlers = {
      handleMapBack: vi.fn(),
      onPaletteChange: vi.fn(),
      onForecastVariableChange: vi.fn(),
      onForecastWindDirectionToggle: vi.fn(),
      onForecastSliderInput: vi.fn(),
      onClearCache: vi.fn(),
      onStorageWarningClose: vi.fn(),
      onStorageWarningToggle: vi.fn(),
      onDocumentKeydown: vi.fn(),
    };

    const unbind = bindAppEvents({
      document,
      dom: createEventDom(),
      handlers,
    });

    document.getElementById("map-back-btn").click();
    document.getElementById("palette-select").dispatchEvent(new Event("change"));
    document.getElementById("palette-select-forecast").dispatchEvent(new Event("change"));
    document.getElementById("forecast-var-select").dispatchEvent(new Event("change"));
    document.getElementById("forecast-wind-direction-toggle").dispatchEvent(new Event("change"));
    document.getElementById("forecast-slider").dispatchEvent(new Event("input"));
    document.getElementById("clear-grib-cache").click();
    document.getElementById("storage-warning-close").click();
    document.getElementById("storage-warning-button").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));

    expect(handlers.handleMapBack).toHaveBeenCalledTimes(1);
    expect(handlers.onPaletteChange).toHaveBeenCalledTimes(2);
    expect(handlers.onForecastVariableChange).toHaveBeenCalledTimes(1);
    expect(handlers.onForecastWindDirectionToggle).toHaveBeenCalledTimes(1);
    expect(handlers.onForecastSliderInput).toHaveBeenCalledTimes(1);
    expect(handlers.onClearCache).toHaveBeenCalledTimes(1);
    expect(handlers.onStorageWarningClose).toHaveBeenCalledTimes(1);
    expect(handlers.onStorageWarningToggle).toHaveBeenCalledTimes(1);
    expect(handlers.onDocumentKeydown).toHaveBeenCalledTimes(1);

    unbind();
    document.getElementById("map-back-btn").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));

    expect(handlers.handleMapBack).toHaveBeenCalledTimes(1);
    expect(handlers.onDocumentKeydown).toHaveBeenCalledTimes(1);
  });
});
