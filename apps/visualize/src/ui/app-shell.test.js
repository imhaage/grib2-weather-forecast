// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";

describe("app shell markup", () => {
  beforeEach(() => {
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
    document.documentElement.innerHTML = html;
  });

  test("exposes the current app title and repository link", () => {
    expect(document.title).toBe("GRIB2 Weather forecast");
    expect(document.querySelector(".logo span")?.textContent).toBe("GRIB2 Weather forecast");
    expect(document.body.textContent).not.toContain("GRIB2 files decoded in the browser");

    const githubLink = document.querySelector(".github-link");
    expect(githubLink?.getAttribute("href")).toBe(
      "https://github.com/imhaage/arome-forecast-visualizer",
    );
    expect(githubLink?.getAttribute("aria-label")).toBe("Open project repository on GitHub");
  });

  test("uses concise home tab descriptions", () => {
    expect(document.getElementById("tab-btn-model")?.textContent?.trim()).toBe(
      "Visualize a forecast run",
    );
    expect(document.getElementById("tab-btn-upload")?.textContent?.trim()).toBe(
      "Inspect a GRIB2 file",
    );
    expect(document.querySelector("#tab-panel-upload .section-desc")?.textContent?.trim()).toBe(
      "Inspect variables and metadata from GRIB2 files.",
    );
  });
});
