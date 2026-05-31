// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { bindUploadInspectorEvents } from "./upload-inspector-events.js";

function renderUploadDom() {
  document.body.innerHTML = `
    <div id="drop-zone" tabindex="0"></div>
    <input id="file-input" type="file">
    <div id="cards">
      <button class="btn-grid" data-var="t" data-message-index="3">Show on map</button>
    </div>
  `;
}

function createUploadDom() {
  return {
    upload: {
      dropZone: document.getElementById("drop-zone"),
      fileInput: document.getElementById("file-input"),
      cards: document.getElementById("cards"),
    },
  };
}

function setInputFiles(input, files) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  });
}

describe("upload inspector events", () => {
  test("binds upload interactions and can unbind them together", () => {
    renderUploadDom();
    const file = new File(["grib"], "sample.grib2");
    const handlers = {
      onFilePickRequest: vi.fn(),
      onFileSelected: vi.fn(),
      onUploadedVariableOpen: vi.fn(),
    };

    const unbind = bindUploadInspectorEvents({
      dom: createUploadDom(),
      handlers,
    });

    document.getElementById("drop-zone").click();
    document
      .getElementById("drop-zone")
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    const fileInput = document.getElementById("file-input");
    setInputFiles(fileInput, [file]);
    fileInput.dispatchEvent(new Event("change"));

    const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
    dropEvent.dataTransfer = { files: [file] };
    document.getElementById("drop-zone").dispatchEvent(dropEvent);

    document.querySelector(".btn-grid").click();

    expect(handlers.onFilePickRequest).toHaveBeenCalledTimes(2);
    expect(handlers.onFileSelected).toHaveBeenCalledTimes(2);
    expect(handlers.onFileSelected).toHaveBeenCalledWith(file);
    expect(handlers.onUploadedVariableOpen).toHaveBeenCalledWith({
      messageIndex: 3,
      variableShortName: "t",
    });

    unbind();
    document.getElementById("drop-zone").click();
    document.querySelector(".btn-grid").click();

    expect(handlers.onFilePickRequest).toHaveBeenCalledTimes(2);
    expect(handlers.onUploadedVariableOpen).toHaveBeenCalledTimes(1);
  });

  test("marks the drop zone while a file is dragged over it", () => {
    renderUploadDom();

    bindUploadInspectorEvents({
      dom: createUploadDom(),
      handlers: {
        onFilePickRequest: vi.fn(),
        onFileSelected: vi.fn(),
        onUploadedVariableOpen: vi.fn(),
      },
    });

    const dropZone = document.getElementById("drop-zone");
    dropZone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    expect(dropZone.classList.contains("over")).toBe(true);

    dropZone.dispatchEvent(new Event("dragleave"));
    expect(dropZone.classList.contains("over")).toBe(false);
  });
});
