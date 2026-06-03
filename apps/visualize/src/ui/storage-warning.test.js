// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";

import {
  createStorageWarningController,
  formatStorageEstimate,
  readStorageWarningPreference,
  writeStorageWarningPreference,
} from "./storage-warning.js";

function createStorageWarningDom() {
  return {
    warning: document.createElement("div"),
    warningButton: document.createElement("button"),
  };
}

describe("storage warning", () => {
  test("formats browser origin storage usage and quota", () => {
    expect(formatStorageEstimate({ usage: 850_000_000, quota: 12_000_000_000 })).toBe(
      "850 MB used",
    );
  });

  test("handles unavailable storage estimates", () => {
    expect(formatStorageEstimate(null)).toBe("Storage estimate unavailable");
    expect(formatStorageEstimate({})).toBe("Storage estimate unavailable");
  });

  test("defaults to showing the storage warning when no preference is stored", () => {
    const storage = new Map();

    expect(readStorageWarningPreference(storage)).toBe(true);
  });

  test("reads and writes the numeric storage warning preference", () => {
    const storage = new Map();

    writeStorageWarningPreference(storage, false);
    expect(storage.get("showStorageWarning")).toBe("0");
    expect(readStorageWarningPreference(storage)).toBe(false);

    writeStorageWarningPreference(storage, true);
    expect(storage.get("showStorageWarning")).toBe("1");
    expect(readStorageWarningPreference(storage)).toBe(true);
  });

  test("initializes visibility from the stored preference", () => {
    const storage = new Map([["showStorageWarning", "0"]]);
    const dom = createStorageWarningDom();
    const updateStorageSize = vi.fn();
    const controller = createStorageWarningController({ dom, storage, updateStorageSize });

    controller.initialize();

    expect(dom.warning.hidden).toBe(true);
    expect(dom.warningButton.getAttribute("aria-expanded")).toBe("false");
    expect(updateStorageSize).not.toHaveBeenCalled();
  });

  test("persists close and toggle actions as numeric flags", () => {
    const storage = new Map();
    const dom = createStorageWarningDom();
    const updateStorageSize = vi.fn();
    const controller = createStorageWarningController({ dom, storage, updateStorageSize });

    controller.close();
    expect(dom.warning.hidden).toBe(true);
    expect(storage.get("showStorageWarning")).toBe("0");

    controller.toggle();
    expect(dom.warning.hidden).toBe(false);
    expect(dom.warningButton.getAttribute("aria-expanded")).toBe("true");
    expect(storage.get("showStorageWarning")).toBe("1");
    expect(updateStorageSize).toHaveBeenCalledTimes(1);
  });
});
