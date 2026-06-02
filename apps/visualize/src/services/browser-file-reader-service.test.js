// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { readFileAsArrayBuffer } from "./browser-file-reader-service.js";

describe("readFileAsArrayBuffer", () => {
  test("reads a browser File as an ArrayBuffer", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "sample.grib2");

    const buffer = await readFileAsArrayBuffer(file);

    expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3]);
  });
});
