// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { prepareFileInputForPick, setHomeTab } from "./home-tabs.js";

function renderTabs() {
  document.body.innerHTML = `
		<button class="tab-btn active" data-tab="model" aria-selected="true"></button>
		<button class="tab-btn" data-tab="upload" aria-selected="false"></button>
		<div id="tab-panel-model" class="active"></div>
		<div id="tab-panel-upload">
			<div id="file-summary">Decoded file summary</div>
			<div id="results">Decoded messages</div>
			<div id="cards"><article>Temperature</article></div>
			<div id="status">Ready</div>
		</div>
	`;
}

describe("home tabs", () => {
  test("switching away from upload preserves decoded file results", () => {
    renderTabs();

    setHomeTab(document, "model");

    expect(document.getElementById("tab-panel-model").classList.contains("active")).toBe(true);
    expect(document.getElementById("tab-panel-upload").classList.contains("active")).toBe(false);
    expect(document.getElementById("file-summary").textContent).toBe("Decoded file summary");
    expect(document.getElementById("results").textContent).toBe("Decoded messages");
    expect(document.getElementById("cards").textContent).toBe("Temperature");
    expect(document.getElementById("status").textContent).toBe("Ready");
  });

  test("preparing the file picker allows selecting the same file again", () => {
    const input = document.createElement("input");
    input.type = "file";

    Object.defineProperty(input, "value", {
      configurable: true,
      value: "/fake/weather.grib2",
      writable: true,
    });

    prepareFileInputForPick(input);

    expect(input.value).toBe("");
  });
});
