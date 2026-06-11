import { describe, expect, test, vi } from "vitest";
import type { DecodedField, UploadedMessage } from "../../domain/field-types";
import {
  createPresentUploadedFieldUseCase,
  type UploadedFieldRenderParams,
} from "./present-uploaded-field";

function makeUploadedMessage(overrides: Partial<UploadedMessage> = {}): UploadedMessage {
  return {
    index: 0,
    buffer: new Uint8Array([1, 2, 3]),
    header: {},
    product: { shortName: "t", name: "Temperature" },
    ...overrides,
  };
}

function makeDecodedField(): DecodedField {
  return {
    values: new Float32Array([1, 2, 3, 4]),
    grid: {
      ni: 2,
      nj: 2,
      dj: 1,
      latitudeOfFirstPoint: 2,
      longitudeOfFirstPoint: 0,
      latitudeOfLastPoint: 1,
      longitudeOfLastPoint: 1,
    },
    product: { shortName: "t", name: "Temperature" },
    header: {},
  };
}

function makeRenderParams(field: DecodedField): UploadedFieldRenderParams {
  return {
    values: new Float32Array(field.values),
    grid: field.grid,
    product: field.product,
    header: field.header,
    unitTransform: "t",
    staticScale: { min: -30, max: 50 },
    renderMin: -30,
    renderMax: 50,
    range: 80,
    isLog: false,
    logDenom: 1,
    zeroThreshold: 0,
    displayUnits: "degC",
    isFallback: false,
  };
}

describe("present uploaded field use case", () => {
  test("returns not-found when no uploaded message matches the route", async () => {
    const decoder = { decode: vi.fn() };
    const render = { render: vi.fn() };
    const useCase = createPresentUploadedFieldUseCase({
      buildRenderParams: makeRenderParams,
      decoder,
      getCurrentRenderGeneration: () => 1,
      render,
    });

    await expect(
      useCase.present({
        messages: [makeUploadedMessage()],
        route: { messageIndex: 3 },
        renderGeneration: 1,
      }),
    ).resolves.toEqual({ type: "not-found" });
    expect(decoder.decode).not.toHaveBeenCalled();
    expect(render.render).not.toHaveBeenCalled();
  });

  test("decodes and renders the selected uploaded field", async () => {
    const message = makeUploadedMessage();
    const field = makeDecodedField();
    const renderResult = {
      bitmap: { close: vi.fn() },
      dataMin: 1,
      dataMax: 4,
      mean: 2.5,
      count: 4,
    };
    const decoder = { decode: vi.fn(async () => field) };
    const render = { render: vi.fn(async () => renderResult) };
    const useCase = createPresentUploadedFieldUseCase({
      buildRenderParams: makeRenderParams,
      decoder,
      getCurrentRenderGeneration: () => 1,
      render,
    });

    const result = await useCase.present({
      messages: [message],
      route: { variableShortName: "t" },
      renderGeneration: 1,
    });

    expect(decoder.decode).toHaveBeenCalledWith(message.buffer);
    expect(render.render).toHaveBeenCalledWith({
      field,
      renderGeneration: 1,
      renderParams: makeRenderParams(field),
    });
    expect(result).toMatchObject({
      type: "success",
      field,
      message,
      renderResult,
    });
  });

  test("returns decode-failed when the decoder rejects", async () => {
    const failure = new Error("Invalid GRIB2");
    const useCase = createPresentUploadedFieldUseCase({
      buildRenderParams: makeRenderParams,
      decoder: {
        decode: vi.fn(async () => {
          throw failure;
        }),
      },
      getCurrentRenderGeneration: () => 1,
      render: { render: vi.fn() },
    });

    await expect(
      useCase.present({
        messages: [makeUploadedMessage()],
        route: { messageIndex: 0 },
        renderGeneration: 1,
      }),
    ).resolves.toEqual({ type: "decode-failed", error: failure });
  });

  test("returns stale when render generation changes before worker completion", async () => {
    let currentRenderGeneration = 1;
    const renderResult = {
      bitmap: { close: vi.fn() },
      dataMin: 1,
      dataMax: 4,
      mean: 2.5,
      count: 4,
    };
    const useCase = createPresentUploadedFieldUseCase({
      buildRenderParams: makeRenderParams,
      decoder: { decode: vi.fn(async () => makeDecodedField()) },
      getCurrentRenderGeneration: () => currentRenderGeneration,
      render: {
        render: vi.fn(async () => {
          currentRenderGeneration = 2;

          return renderResult;
        }),
      },
    });

    await expect(
      useCase.present({
        messages: [makeUploadedMessage()],
        route: { messageIndex: 0 },
        renderGeneration: 1,
      }),
    ).resolves.toEqual({ type: "stale", renderResult });
    expect(renderResult.bitmap.close).not.toHaveBeenCalled();
  });
});
