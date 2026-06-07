import { describe, expect, test, vi } from "vitest";
import { createForecastHourWorkerRenderService } from "./render-hour-with-worker";

function createService(overrides = {}) {
  const modelState = {
    availableBlocks: new Set(["01H"]),
    hourList: [1],
    packageKey: "AROME_SP1",
    resources: [{ key: "01H", startHour: 1, endHour: 1 }],
    variable: "t",
  };
  const renderHour = vi.fn(async () => ({
    bitmap: { close: vi.fn() },
    values: new Float32Array(),
  }));
  const decodeValues = vi.fn(async () => ({ values: new Float32Array([1, 2]) }));
  const dependencies = {
    getCurrentPalette: vi.fn(() => "Temperature"),
    getCurrentRenderGeneration: vi.fn(() => 1),
    getModelBlockService: vi.fn(() => ({ decodeValues, renderHour })),
    getModelState: vi.fn(() => modelState),
    missingValue: 9999,
    notifyDiagnostics: vi.fn(),
    perfDebug: false,
    performanceApi: { now: vi.fn(() => 10) },
    ...overrides,
  };

  return {
    decodeValues,
    dependencies,
    modelState,
    renderHour,
    service: createForecastHourWorkerRenderService(dependencies),
  };
}

describe("forecast hour worker render use case", () => {
  test("renders a forecast hour through the model block worker", async () => {
    const { renderHour, service } = createService();

    await expect(service.renderHour(0)).resolves.toMatchObject({
      values: expect.any(Float32Array),
    });

    expect(renderHour).toHaveBeenCalledWith(
      expect.objectContaining({
        hour: 1,
        renderGeneration: 1,
        type: "renderHour",
      }),
    );
  });

  test("closes stale rendered bitmaps when render generation changes", async () => {
    const bitmap = { close: vi.fn() };
    const { service } = createService({
      getCurrentRenderGeneration: vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2),
      getModelBlockService: vi.fn(() => ({
        decodeValues: vi.fn(),
        renderHour: vi.fn(async () => ({ bitmap })),
      })),
    });

    await expect(service.renderHour(0)).resolves.toBeNull();

    expect(bitmap.close).toHaveBeenCalled();
  });

  test("decodes values through the model block worker", async () => {
    const { decodeValues, service } = createService();

    await expect(service.decodeValues(0, 1)).resolves.toMatchObject({
      values: expect.any(Float32Array),
    });

    expect(decodeValues).toHaveBeenCalledWith(
      expect.objectContaining({
        hour: 1,
        includeValues: false,
        renderGeneration: 1,
      }),
    );
  });

  test("records render diagnostics when perf debug is enabled", async () => {
    const now = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(25);
    const { dependencies, service } = createService({
      perfDebug: true,
      performanceApi: { now },
    });

    await service.renderHour(0);

    expect(service.getLastRenderMs()).toBe(15);
    expect(dependencies.notifyDiagnostics).toHaveBeenCalled();
  });
});
