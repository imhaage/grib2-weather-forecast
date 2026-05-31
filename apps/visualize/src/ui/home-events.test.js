// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { bindHomeEvents } from "./home-events.js";

function renderHomeDom() {
  document.body.innerHTML = `
    <button class="tab-btn" data-tab="model"></button>
    <button class="tab-btn" data-tab="upload"></button>
    <div id="model-list">
      <button data-action="show-package" data-package-key="AROME_SP1">Show on map</button>
    </div>
  `;
}

function createHomeDom() {
  return {
    home: {
      tabButtons: [...document.querySelectorAll(".tab-btn")],
      modelList: document.getElementById("model-list"),
    },
  };
}

describe("home events", () => {
  test("binds home navigation events and can unbind them together", () => {
    renderHomeDom();
    const handlers = {
      onHomeTabSelect: vi.fn(),
      onPackageSelect: vi.fn(),
    };

    const unbind = bindHomeEvents({
      dom: createHomeDom(),
      handlers,
    });

    document.querySelector('[data-tab="upload"]').click();
    document.querySelector('[data-action="show-package"]').click();

    expect(handlers.onHomeTabSelect).toHaveBeenCalledWith("upload");
    expect(handlers.onPackageSelect).toHaveBeenCalledWith("AROME_SP1");

    unbind();
    document.querySelector('[data-tab="model"]').click();
    document.querySelector('[data-action="show-package"]').click();

    expect(handlers.onHomeTabSelect).toHaveBeenCalledTimes(1);
    expect(handlers.onPackageSelect).toHaveBeenCalledTimes(1);
  });
});
