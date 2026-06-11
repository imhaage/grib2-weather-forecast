// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { createMapPresentationController } from "./map-presentation-controller.js";

function mustGetElement(id: string) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing test element: ${id}`);
  }

  return element;
}

function createMapDom() {
  document.body.innerHTML = `
    <span id="forecast-valid-time"></span>
    <div id="map-unavailable" hidden></div>
    <div id="colorscale" hidden></div>
    <div id="cs-bar"></div>
    <div id="cs-ticks"></div>
    <div id="gv-sub"></div>
    <div id="gv-name"></div>
    <div id="gv-desc"></div>
    <div id="gv-level"></div>
    <span id="gv-min"></span>
    <span id="gv-max"></span>
    <span id="gv-mean"></span>
    <span id="gv-valid"></span>
  `;

  return {
    forecast: {
      validTime: mustGetElement("forecast-valid-time"),
    },
    map: {
      unavailable: mustGetElement("map-unavailable"),
    },
    mapInfo: {
      subtitle: mustGetElement("gv-sub"),
      name: mustGetElement("gv-name"),
      description: mustGetElement("gv-desc"),
      level: mustGetElement("gv-level"),
    },
    stats: {
      min: mustGetElement("gv-min"),
      max: mustGetElement("gv-max"),
      mean: mustGetElement("gv-mean"),
      valid: mustGetElement("gv-valid"),
    },
    colorScale: {
      root: mustGetElement("colorscale"),
      bar: mustGetElement("cs-bar"),
      ticks: mustGetElement("cs-ticks"),
    },
  };
}

function createController(overrides = {}) {
  return createMapPresentationController({
    dom: createMapDom(),
    formatValueForUnits: (value, _units, digits) => value.toFixed(digits),
    getCurrentPalette: () => "Temperature",
    legendTicksFor: vi.fn(() => [
      { position: 0, value: -10 },
      { position: 50, value: 0 },
      { position: 100, value: 10 },
    ]),
    ...overrides,
  });
}

describe("map presentation controller", () => {
  test("updates metadata, valid time, and stats", () => {
    const controller = createController();

    controller.updateParamInfo("Temperature", "Air temperature", "AROME 0.01 SP1");
    controller.updateLevelInfo({
      shortName: "t",
      name: "Temperature",
      level: "2m",
      units: "°C",
    });
    controller.setForecastValidTime("AROME 0.01 - SP1 : 2026-06-01 12:00 UTC");
    controller.updateStats(1.2345, 8.7654, 4.2, 1234, "°C");

    expect(mustGetElement("gv-name").textContent).toBe("Temperature");
    expect(mustGetElement("gv-desc").textContent).toBe("Air temperature");
    expect(mustGetElement("gv-sub").textContent).toBe("AROME 0.01 SP1");
    expect(mustGetElement("gv-level").textContent).toBe("2m · °C");
    expect(mustGetElement("forecast-valid-time").textContent).toBe(
      "AROME 0.01 - SP1 : 2026-06-01 12:00 UTC",
    );
    expect(mustGetElement("gv-min").textContent).toBe("1.234 °C");
    expect(mustGetElement("gv-max").textContent).toBe("8.765 °C");
    expect(mustGetElement("gv-mean").textContent).toBe("4.200 °C");
    expect(mustGetElement("gv-valid").textContent).toBe("1,234");
  });

  test("renders color scale ticks and gradient", () => {
    const legendTicksFor = vi.fn(() => [
      { position: 0, value: -10 },
      { position: 50, value: 0 },
      { position: 100, value: 10 },
    ]);
    const controller = createController({ legendTicksFor });

    controller.showColorScale(-10, 10, "°C", { isLog: false });
    controller.setColorScaleGradient([
      { color: "#0000ff", position: 0 },
      { color: "#ffffff", position: 50 },
      { color: "#ff0000", position: 100 },
    ]);

    const ticks = [...document.querySelectorAll(".cs-tick")];
    expect(mustGetElement("colorscale").hidden).toBe(false);
    expect(legendTicksFor).toHaveBeenCalledWith({
      paletteName: "Temperature",
      min: -10,
      max: 10,
      isLog: false,
    });
    expect(ticks.map((tick) => tick.textContent)).toEqual(["-10.0", "0.0", "10.0"]);
    expect(mustGetElement("cs-bar").style.background).toContain("linear-gradient");
  });

  test("toggles unavailable and clears visual summaries", () => {
    const controller = createController();

    controller.showUnavailable();
    controller.showColorScale(0, 1, "mm", {});
    controller.clearStats();
    controller.hideColorScale();

    expect(mustGetElement("map-unavailable").hidden).toBe(false);
    expect(mustGetElement("colorscale").hidden).toBe(true);
    expect(mustGetElement("gv-min").textContent).toBe("—");
    expect(mustGetElement("gv-max").textContent).toBe("—");
    expect(mustGetElement("gv-mean").textContent).toBe("—");
    expect(mustGetElement("gv-valid").textContent).toBe("—");
  });
});
