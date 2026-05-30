// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { setMapToolbarMode } from "./map-toolbar-controller.js";

describe("map toolbar controller", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="map-back-btn" hidden>Back</button>
      <div id="map-toolbar" hidden></div>
      <div id="forecast-player-toolbar" hidden></div>
    `;
  });

  test("shows single field controls without forecast run controls", () => {
    setMapToolbarMode(document, "field");

    expect(document.getElementById("map-back-btn")?.hidden).toBe(false);
    expect(document.getElementById("map-toolbar")?.hidden).toBe(false);
    expect(document.getElementById("forecast-player-toolbar")?.hidden).toBe(true);
  });

  test("shows forecast run controls without single field controls", () => {
    setMapToolbarMode(document, "run");

    expect(document.getElementById("map-back-btn")?.hidden).toBe(false);
    expect(document.getElementById("map-toolbar")?.hidden).toBe(true);
    expect(document.getElementById("forecast-player-toolbar")?.hidden).toBe(false);
  });
});
