// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { createBrowserFileReaderAdapter } from "./browser-file-reader-adapter";

describe("createBrowserFileReaderAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads a browser File as an ArrayBuffer", async () => {
    const adapter = createBrowserFileReaderAdapter();
    const file = new File([new Uint8Array([1, 2, 3])], "sample.grib2");

    const buffer = await adapter.readAsArrayBuffer(file);

    expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3]);
  });

  test("rejects when FileReader fails", async () => {
    class FailingFileReader {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: (() => void) | null = null;

      readAsArrayBuffer() {
        this.onerror?.();
      }
    }

    vi.stubGlobal("FileReader", FailingFileReader);
    const adapter = createBrowserFileReaderAdapter();
    const file = new File([new Uint8Array([1, 2, 3])], "broken.grib2");

    await expect(adapter.readAsArrayBuffer(file)).rejects.toThrow("Could not read file.");
  });
});
