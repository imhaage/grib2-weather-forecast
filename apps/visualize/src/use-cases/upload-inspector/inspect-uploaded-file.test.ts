import { describe, expect, test, vi } from "vitest";
import { inspectUploadedFile } from "./inspect-uploaded-file";
import type { UploadInspectionEvent, UploadInspectorMessage } from "./ports";

function message(index: number, shortName = `var-${index}`): UploadInspectorMessage {
  return {
    index,
    buffer: new Uint8Array([index]),
    header: { centre: 85 },
    product: { shortName, name: shortName.toUpperCase() },
  };
}

describe("inspectUploadedFile", () => {
  test("emits reading then ready with a typed summary", async () => {
    const events: UploadInspectionEvent[] = [];

    await inspectUploadedFile({
      file: { name: "forecast.grib2", size: 123 },
      centres: { 85: "Meteo-France" },
      fileReader: {
        readAsArrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
      },
      messageIterator: {
        iterateMessages: vi.fn(() => [message(0, "t"), message(1, "r")]),
      },
      formatters: {
        formatFileSize: (size) => `${size} bytes`,
        formatReferenceTime: () => "2026-06-01 00:00 UTC",
      },
      emit: (event) => events.push(event),
    });

    expect(events.map((event) => event.type)).toEqual(["reading", "ready"]);
    expect(events[1]).toEqual({
      type: "ready",
      result: {
        file: {
          name: "forecast.grib2",
          sizeLabel: "123 bytes",
        },
        summary: {
          messageCount: 2,
          centreLabel: "Meteo-France",
          referenceTimeLabel: "2026-06-01 00:00 UTC",
        },
        messages: [message(0, "t"), message(1, "r")],
      },
    });
  });

  test("emits empty when no messages are decoded", async () => {
    const events: UploadInspectionEvent[] = [];

    await inspectUploadedFile({
      file: { name: "empty.grib2", size: 0 },
      centres: {},
      fileReader: {
        readAsArrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
      },
      messageIterator: {
        iterateMessages: vi.fn(() => []),
      },
      formatters: {
        formatFileSize: (size) => `${size} bytes`,
        formatReferenceTime: () => "unused",
      },
      emit: (event) => events.push(event),
    });

    expect(events.map((event) => event.type)).toEqual(["reading", "empty"]);
  });

  test("emits error when reading or decoding fails", async () => {
    const events: UploadInspectionEvent[] = [];
    const failure = new Error("Could not read file.");

    await inspectUploadedFile({
      file: { name: "broken.grib2", size: 1 },
      centres: {},
      fileReader: {
        readAsArrayBuffer: vi.fn(async () => {
          throw failure;
        }),
      },
      messageIterator: {
        iterateMessages: vi.fn(() => []),
      },
      formatters: {
        formatFileSize: (size) => `${size} bytes`,
        formatReferenceTime: () => "unused",
      },
      emit: (event) => events.push(event),
    });

    expect(events).toEqual([{ type: "reading" }, { type: "error", error: failure }]);
  });

  test("falls back to a centre label when the centre code is unknown", async () => {
    const events: UploadInspectionEvent[] = [];

    await inspectUploadedFile({
      file: { name: "forecast.grib2", size: 123 },
      centres: {},
      fileReader: {
        readAsArrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
      },
      messageIterator: {
        iterateMessages: vi.fn(() => [message(0, "t")]),
      },
      formatters: {
        formatFileSize: (size) => `${size} bytes`,
        formatReferenceTime: () => "2026-06-01 00:00 UTC",
      },
      emit: (event) => events.push(event),
    });

    expect(events[1]).toMatchObject({
      type: "ready",
      result: {
        summary: {
          centreLabel: "Centre 85",
        },
      },
    });
  });
});
