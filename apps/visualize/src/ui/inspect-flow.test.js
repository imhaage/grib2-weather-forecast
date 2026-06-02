// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { createUploadInspectorController } from "../controllers/upload-inspector-controller.js";
import { createAppRouter } from "./app-router.js";
import { createInspectMessageHash } from "./forecast-route.js";
import { setHomeTab } from "./home-tabs.js";
import { resolveMapBackHash } from "./map-back-action.js";
import { bindUploadInspectorEvents } from "./upload-inspector-events.js";

function setupDom() {
  document.body.innerHTML = `
    <div id="view-home">
      <main>
        <button class="tab-btn" data-tab="model"></button>
        <button class="tab-btn" data-tab="upload"></button>
        <section id="tab-panel-model"></section>
        <section id="tab-panel-upload">
          <div id="drop-zone" tabindex="0"></div>
          <input id="file-input" type="file">
          <div id="status"></div>
          <section id="file-summary" hidden>
            <span id="s-name"></span>
            <span id="s-size"></span>
            <span id="s-count"></span>
            <span id="s-centre"></span>
            <span id="s-reftime"></span>
          </section>
          <section id="results" hidden>
            <div id="cards"></div>
          </section>
        </section>
      </main>
    </div>
    <div id="view-map" hidden>
      <button id="map-back-btn"></button>
    </div>
  `;
}

function uploadDom() {
  return {
    cards: document.getElementById("cards"),
    centre: document.getElementById("s-centre"),
    count: document.getElementById("s-count"),
    dropZone: document.getElementById("drop-zone"),
    fileInput: document.getElementById("file-input"),
    name: document.getElementById("s-name"),
    referenceTime: document.getElementById("s-reftime"),
    results: document.getElementById("results"),
    size: document.getElementById("s-size"),
    status: document.getElementById("status"),
    summary: document.getElementById("file-summary"),
  };
}

function createMessage(index, shortName) {
  return {
    index,
    header: { centre: 85 },
    product: { name: shortName.toUpperCase(), shortName },
  };
}

function showView(view) {
  document.getElementById("view-home").hidden = view !== "view-home";
  document.getElementById("view-map").hidden = view !== "view-map";
}

describe("inspect file flow", () => {
  test("keeps uploaded messages available after opening the map and going back", async () => {
    setupDom();
    let hash = "#inspect";
    const openedMessages = [];
    const uploadInspector = createUploadInspectorController({
      centres: { 85: "Météo-France" },
      dom: uploadDom(),
      formatRefTime: () => "2026-06-01 00:00 UTC",
      formatSize: (size) => `${size} bytes`,
      iterateMessages: vi.fn(() => [
        createMessage(0, "t"),
        createMessage(1, "r"),
        createMessage(2, "cape"),
      ]),
      readFileAsArrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
      renderCard: (document, message) => {
        const card = document.createElement("article");
        const button = document.createElement("button");
        card.dataset.index = String(message.index);
        button.className = "btn-grid";
        button.dataset.var = message.product.shortName;
        button.dataset.messageIndex = String(message.index);
        button.textContent = "Show on map";
        card.append(button);
        return card;
      },
    });
    const router = createAppRouter({
      addEventListener: vi.fn(),
      getCurrentPackageKey: () => null,
      getHash: () => hash,
      isValidPackage: () => false,
      removeEventListener: vi.fn(),
      replaceHash: (nextHash) => {
        hash = nextHash;
      },
      resetModelState: vi.fn(),
      setHash: (nextHash) => {
        hash = nextHash;
      },
      setToolbarMode: vi.fn(),
      showDataStatusPanel: vi.fn(),
      showMapView: (route) => {
        const message = uploadInspector.getSelectedMessage(route);
        if (message) openedMessages.push(message.index);
      },
      showTab: (tab) => setHomeTab(document, tab),
      showView,
      startDownload: vi.fn(),
    });
    bindUploadInspectorEvents({
      dom: { upload: uploadDom() },
      handlers: {
        onFilePickRequest: vi.fn(),
        onFileSelected: uploadInspector.processFile,
        onUploadedVariableOpen: ({ messageIndex }) => {
          hash = createInspectMessageHash(messageIndex);
          router.route();
        },
      },
    });

    await uploadInspector.processFile({ name: "forecast.grib2", size: 123 });
    document.querySelector('[data-message-index="1"]').click();
    hash = resolveMapBackHash({ hasModelState: false });
    router.route();

    expect(openedMessages).toEqual([1]);
    expect(document.getElementById("view-home").hidden).toBe(false);
    expect(document.getElementById("tab-panel-upload").classList.contains("active")).toBe(true);
    expect(document.getElementById("file-summary").hidden).toBe(false);
    expect(document.getElementById("results").hidden).toBe(false);
    expect(
      [...document.querySelectorAll("#cards article")].map((card) => card.dataset.index),
    ).toEqual(["0", "1", "2"]);
    expect(uploadInspector.getSelectedMessage({ messageIndex: 1 }).product.shortName).toBe("r");
  });
});
