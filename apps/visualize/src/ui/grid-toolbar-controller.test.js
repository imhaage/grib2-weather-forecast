// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { setGridToolbarMode } from "./grid-toolbar-controller.js";

describe("grid toolbar controller", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="grid-back-btn" hidden>Back</button>
      <div id="grid-toolbar" hidden></div>
      <div id="forecast-player-toolbar" hidden></div>
    `;
  });

  test("shows upload grid controls without forecast player controls", () => {
    setGridToolbarMode(document, "grid");

    expect(document.getElementById("grid-back-btn")?.hidden).toBe(false);
    expect(document.getElementById("grid-toolbar")?.hidden).toBe(false);
    expect(document.getElementById("forecast-player-toolbar")?.hidden).toBe(true);
  });

  test("shows forecast player controls without upload grid controls", () => {
    setGridToolbarMode(document, "forecast");

    expect(document.getElementById("grid-back-btn")?.hidden).toBe(false);
    expect(document.getElementById("grid-toolbar")?.hidden).toBe(true);
    expect(document.getElementById("forecast-player-toolbar")?.hidden).toBe(false);
  });
});
