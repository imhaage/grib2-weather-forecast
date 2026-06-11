// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import type { UploadedMessage } from "../domain/field-types";
import {
  type CreateUploadInspectorControllerOptions,
  createUploadInspectorController,
} from "./upload-inspector-controller.js";

function mustGetElement<T extends HTMLElement = HTMLElement>(id: string) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing test element: ${id}`);
  }

  return element as T;
}

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
    status: mustGetElement("status"),
    summary: mustGetElement("file-summary"),
    name: mustGetElement("s-name"),
    size: mustGetElement("s-size"),
    count: mustGetElement("s-count"),
    centre: mustGetElement("s-centre"),
    referenceTime: mustGetElement("s-reftime"),
    results: mustGetElement("results"),
    cards: mustGetElement("cards"),
  };
}

function createMessage(index: number, shortName = `var-${index}`): UploadedMessage {
  return {
    index,
    buffer: new Uint8Array([index]),
    header: { centre: 85 },
    product: { shortName },
  };
}

function createController(overrides: Partial<CreateUploadInspectorControllerOptions> = {}) {
  const options = {
    dom: createUploadDom(),
    centres: { 85: "Météo-France" },
    formatSize: (size) => `${size} bytes`,
    formatRefTime: () => "2026-06-01 00:00 UTC",
    renderCard: (ownerDocument, message) => {
      const card = ownerDocument.createElement("article");
      card.dataset.index = String(message.index);
      card.textContent = message.product.shortName;

      return card;
    },
    readFileAsArrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
    iterateMessages: vi.fn(() => [
      createMessage(0, "t"),
      createMessage(1, "r"),
      createMessage(2, "t"),
    ]),
    ...overrides,
  } satisfies CreateUploadInspectorControllerOptions;

  return createUploadInspectorController(options);
}

describe("upload inspector controller", () => {
  test("renders one card per decoded GRIB message", async () => {
    const controller = createController();

    await controller.processFile({ name: "forecast.grib2", size: 123 });

    expect(mustGetElement("status").textContent).toBe("");
    expect(mustGetElement("file-summary").hidden).toBe(false);
    expect(mustGetElement("results").hidden).toBe(false);
    expect(mustGetElement("s-name").textContent).toBe("forecast.grib2");
    expect(mustGetElement("s-size").textContent).toBe("123 bytes");
    expect(mustGetElement("s-count").textContent).toBe("3");
    expect(
      [...document.querySelectorAll<HTMLElement>("#cards article")].map(
        (card) => card.dataset.index,
      ),
    ).toEqual(["0", "1", "2"]);
  });

  test("selects uploaded messages by exact message index before falling back to short name", async () => {
    const controller = createController();
    await controller.processFile({ name: "forecast.grib2", size: 123 });

    expect(controller.getSelectedMessage({ messageIndex: 2 })?.index).toBe(2);
    expect(controller.getSelectedMessage({ variableShortName: "t" })?.index).toBe(0);
  });

  test("resets rendered upload state", async () => {
    const controller = createController();
    await controller.processFile({ name: "forecast.grib2", size: 123 });

    controller.reset();

    expect(controller.hasFile()).toBe(false);
    expect(mustGetElement("file-summary").hidden).toBe(true);
    expect(mustGetElement("results").hidden).toBe(true);
    expect(mustGetElement("cards").children).toHaveLength(0);
    expect(mustGetElement("status").textContent).toBe("");
  });

  test("shows an error when no GRIB2 messages are found", async () => {
    const controller = createController({
      iterateMessages: vi.fn(() => []),
    });

    await controller.processFile({ name: "empty.grib2", size: 0 });

    expect(mustGetElement("status").textContent).toBe("No GRIB2 messages found.");
    expect(mustGetElement("status").classList.contains("error")).toBe(true);
    expect(controller.hasFile()).toBe(false);
  });
});
