// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { createUploadInspectorController } from "./upload-inspector-controller.js";

function createUploadDom() {
  document.body.innerHTML = `
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
  `;
  return {
    status: document.getElementById("status"),
    summary: document.getElementById("file-summary"),
    name: document.getElementById("s-name"),
    size: document.getElementById("s-size"),
    count: document.getElementById("s-count"),
    centre: document.getElementById("s-centre"),
    referenceTime: document.getElementById("s-reftime"),
    results: document.getElementById("results"),
    cards: document.getElementById("cards"),
  };
}

function createMessage(index, shortName = `var-${index}`) {
  return {
    index,
    header: { centre: 85 },
    product: { shortName },
  };
}

function createController(overrides = {}) {
  return createUploadInspectorController({
    dom: createUploadDom(),
    centres: { 85: "Météo-France" },
    formatSize: (size) => `${size} bytes`,
    formatRefTime: () => "2026-06-01 00:00 UTC",
    renderCard: (message) =>
      `<article data-index="${message.index}">${message.product.shortName}</article>`,
    readFileAsArrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
    iterateMessages: vi.fn(() => [
      createMessage(0, "t"),
      createMessage(1, "r"),
      createMessage(2, "t"),
    ]),
    ...overrides,
  });
}

describe("upload inspector controller", () => {
  test("renders one card per decoded GRIB message", async () => {
    const controller = createController();

    await controller.processFile({ name: "forecast.grib2", size: 123 });

    expect(document.getElementById("status").textContent).toBe("");
    expect(document.getElementById("file-summary").hidden).toBe(false);
    expect(document.getElementById("results").hidden).toBe(false);
    expect(document.getElementById("s-name").textContent).toBe("forecast.grib2");
    expect(document.getElementById("s-size").textContent).toBe("123 bytes");
    expect(document.getElementById("s-count").textContent).toBe("3");
    expect(
      [...document.querySelectorAll("#cards article")].map((card) => card.dataset.index),
    ).toEqual(["0", "1", "2"]);
  });

  test("selects uploaded messages by exact message index before falling back to short name", async () => {
    const controller = createController();
    await controller.processFile({ name: "forecast.grib2", size: 123 });

    expect(controller.getSelectedMessage({ messageIndex: 2 }).index).toBe(2);
    expect(controller.getSelectedMessage({ variableShortName: "t" }).index).toBe(0);
  });

  test("resets rendered upload state", async () => {
    const controller = createController();
    await controller.processFile({ name: "forecast.grib2", size: 123 });

    controller.reset();

    expect(controller.hasFile()).toBe(false);
    expect(document.getElementById("file-summary").hidden).toBe(true);
    expect(document.getElementById("results").hidden).toBe(true);
    expect(document.getElementById("cards").innerHTML).toBe("");
    expect(document.getElementById("status").textContent).toBe("");
  });

  test("shows an error when no GRIB2 messages are found", async () => {
    const controller = createController({
      iterateMessages: vi.fn(() => []),
    });

    await controller.processFile({ name: "empty.grib2", size: 0 });

    expect(document.getElementById("status").textContent).toBe("No GRIB2 messages found.");
    expect(document.getElementById("status").classList.contains("error")).toBe(true);
    expect(controller.hasFile()).toBe(false);
  });
});
