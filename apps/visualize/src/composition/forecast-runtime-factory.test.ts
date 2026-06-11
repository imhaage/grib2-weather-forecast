import { describe, expect, test, vi } from "vitest";
import type {
  ForecastMapPresentationPort,
  ForecastMapRendererPort,
} from "../use-cases/forecast/map-contracts";
import {
  type CreateForecastRuntimeFactoryOptions,
  createForecastRuntimeFactory,
} from "./forecast-runtime-factory";

describe("forecast runtime factory composition", () => {
  test("constructs the public forecast runtime API", () => {
    const mapRenderer = {
      clearIsobars: vi.fn(),
      clearLayer: vi.fn(),
      clearWindSymbols: vi.fn(),
      drawBitmap: vi.fn(),
      ensureHeatCanvas: vi.fn(() => ({ canvas: {}, canvasChanged: false })),
      fitBounds: vi.fn(),
      hasLayer: vi.fn(() => false),
      setLayer: vi.fn(),
      setVisible: vi.fn(),
      triggerRepaint: vi.fn(),
      updateIsobars: vi.fn(),
      updateWindSymbols: vi.fn(),
    } satisfies ForecastMapRendererPort;
    const mapPresentation = {
      clearStats: vi.fn(),
      hideColorScale: vi.fn(),
      hideUnavailable: vi.fn(),
      setColorScaleGradient: vi.fn(),
      setForecastValidTime: vi.fn(),
      showColorScale: vi.fn(),
      showUnavailable: vi.fn(),
      updateLevelInfo: vi.fn(),
      updateParamInfo: vi.fn(),
      updateStats: vi.fn(),
    } satisfies ForecastMapPresentationPort;
    const options = {
      window: {
        requestAnimationFrame: vi.fn(() => 1),
      },
      mapRenderer,
      mapPresentation,
      missingValue: -1e100,
      makeGridState: (entry, values) => ({ entry, values }),
      gridCorners: () => [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
      initMap: vi.fn(async () => {}),
      getCurrentPalette: vi.fn(() => "Temperature"),
      getGridState: vi.fn(() => null),
      setCurrentPalette: vi.fn(),
      setGridState: vi.fn(),
      setRendering: vi.fn(),
      views: {
        dataStatusSummaryView: {
          render: vi.fn(),
        },
        forecastDownloadView: {
          clear: vi.fn(),
          renderItems: vi.fn(),
          resetBlockDownloadProgress: vi.fn(),
          setBlockDownloadProgress: vi.fn(),
          setBlockStatus: vi.fn(),
          setStatus: vi.fn(),
        },
        forecastHourControlView: {
          renderHourLabel: vi.fn(),
          renderHourList: vi.fn(),
          reset: vi.fn(),
          selectedIndex: vi.fn(() => 0),
        },
        forecastWarmupView: {
          render: vi.fn(),
        },
      },
      variableControls: {
        defaultVariableForPackage: vi.fn((pkg) => pkg.variables[0]),
        renderVariableOptions: vi.fn(),
        renderWindDirectionToggle: vi.fn(),
      },
    } satisfies CreateForecastRuntimeFactoryOptions;
    const runtime = createForecastRuntimeFactory(options);

    expect(runtime).toMatchObject({
      startDownload: expect.any(Function),
      resetModelState: expect.any(Function),
      handleVariableChange: expect.any(Function),
    });
  });
});
