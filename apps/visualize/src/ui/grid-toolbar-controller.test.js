// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

describe("grid toolbar markup", () => {
  test("uses one universal back button for all grid views", () => {
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
    document.body.innerHTML = html;

    expect(document.getElementById("grid-back-btn")?.getAttribute("aria-label")).toBe(
      "Back to the home page",
    );
    expect(document.getElementById("back-btn")).toBeNull();
    expect(document.getElementById("grid-toolbar")).not.toBeNull();
    expect(document.getElementById("forecast-player-toolbar")).not.toBeNull();
  });
});
