import { describe, expect, test, vi } from "vitest";
import type { UploadedMessage } from "../domain/field-types";
import type { MapCorner } from "../use-cases/forecast/map-contracts";
import type {
  PresentUploadedFieldResult,
  UploadedFieldRoute,
} from "../use-cases/upload-inspector/ports";
import {
  type CreateUploadedFieldControllerOptions,
  createUploadedFieldController,
} from "./uploaded-field-controller";

const grid = {
  ni: 2,
  nj: 2,
  dj: 0.1,
  latitudeOfFirstPoint: 51,
  longitudeOfFirstPoint: 1,
  latitudeOfLastPoint: 49,
  longitudeOfLastPoint: 3,
};
const message: UploadedMessage = {
  index: 4,
  buffer: new Uint8Array([1, 2, 3]),
  header: { refTime: "2026-06-11T00:00:00Z" },
  product: {
    shortName: "t",
    name: "Temperature",
    units: "K",
    level: "2 m above ground",
  },
  grid,
};

function createSuccessResult(close = vi.fn()): PresentUploadedFieldResult {
  return {
    type: "success",
    message,
    field: {
      values: new Float32Array([1, 2, 3, 4]),
      grid,
      product: message.product,
      header: message.header,
    },
    renderParams: {
      values: new Float32Array([1, 2, 3, 4]),
      grid,
      product: message.product,
      header: message.header,
      unitTransform: "t",
      staticScale: { min: -30, max: 50 },
      renderMin: -30,
      renderMax: 50,
      range: 80,
      isLog: false,
      logDenom: 1,
      zeroThreshold: 0,
      displayUnits: "°C",
      isFallback: false,
    },
    renderResult: {
      bitmap: { close },
      dataMin: 2,
      dataMax: 8,
      mean: 5,
      count: 4,
    },
  };
}

function createMapPresentation() {
  return {
    clearError: vi.fn(),
    clearStats: vi.fn(),
    hideColorScale: vi.fn(),
    hideUnavailable: vi.fn(),
    setColorScaleGradient: vi.fn(),
    setForecastValidTime: vi.fn(),
    showColorScale: vi.fn(),
    showError: vi.fn(),
    showUnavailable: vi.fn(),
    updateLevelInfo: vi.fn(),
    updateParamInfo: vi.fn(),
    updateStats: vi.fn(),
  } satisfies CreateUploadedFieldControllerOptions["mapPresentation"];
}

function createController(
  result: PresentUploadedFieldResult = createSuccessResult(),
  overrides: Partial<CreateUploadedFieldControllerOptions> = {},
) {
  const state = {
    palette: "Plasma",
    gridState: null as unknown,
  };
  const source = {
    getMessages: vi.fn(() => [message]),
    hasFile: vi.fn(() => true),
  };
  const presenter = {
    present: vi.fn(async () => result),
  };
  const navigation = {
    redirectHome: vi.fn(),
    showMapView: vi.fn(),
  };
  const mapPresentation = createMapPresentation();
  const mapRenderer = {
    clearLayer: vi.fn(),
    drawBitmap: vi.fn(),
    ensureHeatCanvas: vi.fn(() => ({
      canvas: {},
      canvasChanged: true,
      outW: 2,
      outH: 2,
    })),
    fitBounds: vi.fn(),
    init: vi.fn(async () => ({})),
    setLayer: vi.fn(),
    setVisible: vi.fn(),
    triggerRepaint: vi.fn(),
  };
  const options = {
    applyPalette: vi.fn((palette: string) => {
      state.palette = palette;
    }),
    defaultPaletteFor: vi.fn(() => "Temperature"),
    displayUnitsFor: vi.fn(() => "°C"),
    formatLevel: vi.fn(() => "2 m above ground"),
    formatValidTime: vi.fn(() => "2026-06-11 03:00 UTC"),
    getCurrentPalette: () => state.palette,
    gradientStopsFor: vi.fn(() => [
      { color: "#0000ff", position: 0 },
      { color: "#ff0000", position: 100 },
    ]),
    gridCorners: vi.fn(
      () =>
        [
          [1, 51],
          [3, 51],
          [3, 49],
          [1, 49],
        ] satisfies MapCorner[],
    ),
    makeGridState: vi.fn(() => ({ values: new Float32Array([1, 2, 3, 4]) })),
    mapPresentation,
    mapRenderer,
    navigation,
    parameterDescriptionFor: vi.fn(() => "Air temperature"),
    presenter,
    setGridState: vi.fn((gridState: unknown) => {
      state.gridState = gridState;
    }),
    source,
    ...overrides,
  } satisfies CreateUploadedFieldControllerOptions;

  return {
    controller: createUploadedFieldController(options),
    mapPresentation,
    mapRenderer,
    navigation,
    options,
    presenter,
    source,
    state,
  };
}

const route: UploadedFieldRoute = { messageIndex: 4 };

describe("uploaded field controller", () => {
  test("redirects home when no uploaded file is available", async () => {
    const { controller, navigation, presenter, source } = createController();
    source.hasFile.mockReturnValue(false);

    await controller.show(route);

    expect(navigation.redirectHome).toHaveBeenCalledOnce();
    expect(presenter.present).not.toHaveBeenCalled();
  });

  test("presents decoded field metadata, raster, bounds, stats, and legend", async () => {
    const { controller, mapPresentation, mapRenderer, navigation, state } = createController();

    await controller.show(route);

    expect(navigation.showMapView).toHaveBeenCalledOnce();
    expect(mapRenderer.setVisible).toHaveBeenCalledWith(true);
    expect(mapPresentation.updateParamInfo).toHaveBeenCalledWith(
      "Temperature",
      "Air temperature",
      "2026-06-11 03:00 UTC",
    );
    expect(mapPresentation.updateLevelInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "2 m above ground",
        units: "°C",
      }),
    );
    expect(mapRenderer.drawBitmap).toHaveBeenCalledOnce();
    expect(mapRenderer.setLayer).toHaveBeenCalledOnce();
    expect(mapRenderer.fitBounds).toHaveBeenCalledWith(
      [
        [1, 49],
        [3, 51],
      ],
      { padding: 20, animate: false },
    );
    expect(mapPresentation.updateStats).toHaveBeenCalledWith(2, 8, 5, 4, "°C");
    expect(mapPresentation.showColorScale).toHaveBeenCalledWith(-30, 50, "°C", {
      isLog: false,
    });
    expect(mapPresentation.setColorScaleGradient).toHaveBeenCalledWith([
      { color: "#0000ff", position: 0 },
      { color: "#ff0000", position: 100 },
    ]);
    expect(state.gridState).not.toBeNull();
  });

  test("shows a decode error without leaving stale rendering state", async () => {
    const result: PresentUploadedFieldResult = {
      type: "decode-failed",
      error: new Error("invalid section"),
    };
    const { controller, mapPresentation, mapRenderer, state } = createController(result);
    state.gridState = { stale: true };

    await controller.show(route);

    expect(mapRenderer.clearLayer).toHaveBeenCalledOnce();
    expect(mapPresentation.clearStats).toHaveBeenCalledTimes(2);
    expect(mapPresentation.hideColorScale).toHaveBeenCalledTimes(2);
    expect(mapPresentation.showError).toHaveBeenCalledWith("Decode error: invalid section");
    expect(state.gridState).toBeNull();
    expect(mapRenderer.drawBitmap).not.toHaveBeenCalled();
  });

  test("rerenders the current uploaded field after palette changes", async () => {
    const { controller, mapRenderer, options, presenter, state } = createController();
    await controller.show(route);

    await controller.handlePaletteChange("Viridis");

    expect(options.applyPalette).toHaveBeenLastCalledWith("Viridis");
    expect(state.palette).toBe("Viridis");
    expect(presenter.present).toHaveBeenCalledTimes(2);
    expect(mapRenderer.triggerRepaint).toHaveBeenCalled();
  });

  test("closes returned bitmaps after drawing", async () => {
    const close = vi.fn();
    const { controller, mapRenderer } = createController(createSuccessResult(close));

    await controller.show(route);

    expect(mapRenderer.drawBitmap).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
