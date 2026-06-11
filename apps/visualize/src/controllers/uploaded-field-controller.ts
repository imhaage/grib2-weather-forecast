import type { GridDefinition, ProductDefinition, UploadedMessage } from "../domain/field-types";
import type {
  ForecastBounds,
  ForecastMapCanvas,
  ForecastMapPresentationPort,
  ForecastRaster,
  MapCorner,
} from "../use-cases/forecast/map-contracts";
import type {
  PresentUploadedFieldResult,
  UploadedFieldRenderParams,
  UploadedFieldRoute,
} from "../use-cases/upload-inspector/ports";
import { resolveUploadedMessage } from "../use-cases/upload-inspector/present-uploaded-field";

interface UploadedFieldSourcePort {
  getMessages(): UploadedMessage[];
  hasFile(): boolean;
}

interface UploadedFieldPresenterPort {
  present(request: {
    messages: UploadedMessage[];
    route: UploadedFieldRoute;
    renderGeneration: number;
  }): Promise<PresentUploadedFieldResult>;
}

interface UploadedFieldNavigationPort {
  redirectHome(): void;
  showMapView(): void;
}

interface UploadedFieldMapPresentationPort extends ForecastMapPresentationPort {
  clearError(): void;
  showError(message: string): void;
}

interface UploadedFieldMapRendererPort {
  clearLayer(): void;
  drawBitmap(bitmap: ForecastRaster): void;
  ensureHeatCanvas(grid: GridDefinition): {
    canvas: ForecastMapCanvas;
    canvasChanged: boolean;
    outH: number;
    outW: number;
  };
  fitBounds(bounds: ForecastBounds, options: { animate: boolean; padding: number }): void;
  init(): Promise<unknown>;
  setLayer(canvas: ForecastMapCanvas, corners: MapCorner[]): void;
  setVisible(visible: boolean): void;
  triggerRepaint(): void;
}

interface GradientStop {
  color: string;
  position: number;
}

export interface CreateUploadedFieldControllerOptions {
  applyPalette(palette: string): void;
  defaultPaletteFor(shortName: string): string | null | undefined;
  displayUnitsFor(shortName: string, units: string | undefined): string;
  formatLevel(product: ProductDefinition): string;
  formatValidTime(message: UploadedMessage["header"], product: ProductDefinition): string;
  getCurrentPalette(): string;
  gradientStopsFor(
    palette: string,
    range: {
      min: number;
      max: number;
    },
  ): GradientStop[];
  gridCorners(grid: GridDefinition): MapCorner[];
  makeGridState(renderParams: UploadedFieldRenderParams): unknown;
  mapPresentation: UploadedFieldMapPresentationPort;
  mapRenderer: UploadedFieldMapRendererPort;
  navigation: UploadedFieldNavigationPort;
  parameterDescriptionFor(shortName: string): string | null;
  presenter: UploadedFieldPresenterPort;
  setGridState(gridState: unknown): void;
  source: UploadedFieldSourcePort;
}

function boundsFromCorners(corners: MapCorner[]): ForecastBounds {
  return [
    [corners[3][0], corners[2][1]],
    [corners[1][0], corners[0][1]],
  ];
}

function errorMessage(result: Extract<PresentUploadedFieldResult, { type: "decode-failed" }>) {
  return `Decode error: ${result.error.message}`;
}

export function createUploadedFieldController({
  applyPalette,
  defaultPaletteFor,
  displayUnitsFor,
  formatLevel,
  formatValidTime,
  getCurrentPalette,
  gradientStopsFor,
  gridCorners,
  makeGridState,
  mapPresentation,
  mapRenderer,
  navigation,
  parameterDescriptionFor,
  presenter,
  setGridState,
  source,
}: CreateUploadedFieldControllerOptions) {
  let currentRoute: UploadedFieldRoute | null = null;
  let renderGeneration = 0;

  function clearRenderedField() {
    mapRenderer.clearLayer();
    setGridState(null);
    mapPresentation.clearStats();
    mapPresentation.hideColorScale();
  }

  function preparePresentation(message: UploadedMessage, applyDefaultPalette: boolean) {
    const { product } = message;

    if (applyDefaultPalette) {
      const palette = defaultPaletteFor(product.shortName);

      if (palette) {
        applyPalette(palette);
      }
    }

    const validTime = formatValidTime(message.header, product);
    mapPresentation.updateParamInfo(
      product.name,
      parameterDescriptionFor(product.shortName),
      validTime,
    );
    mapPresentation.updateLevelInfo({
      ...product,
      level: formatLevel(product),
      units: displayUnitsFor(product.shortName, product.units),
    });
    mapPresentation.setForecastValidTime(validTime);
    mapPresentation.clearStats();
    mapPresentation.hideColorScale();
    mapPresentation.clearError();
    navigation.showMapView();
    mapRenderer.setVisible(true);
  }

  function updateLegend(
    renderParams: UploadedFieldRenderParams,
    result: Extract<PresentUploadedFieldResult, { type: "success" }>["renderResult"],
  ) {
    const { dataMin, dataMax, mean, count } = result;
    const { displayUnits, isLog, range, renderMin, staticScale } = renderParams;
    const legendMin = staticScale ? renderMin : dataMin;
    const legendMax = staticScale ? renderMin + range : dataMax;
    const stops = gradientStopsFor(getCurrentPalette(), {
      min: renderMin,
      max: renderMin + range,
    });

    mapPresentation.updateStats(dataMin, dataMax, mean, count, displayUnits);
    mapPresentation.showColorScale(legendMin, legendMax, displayUnits, { isLog });
    mapPresentation.setColorScaleGradient(stops);
  }

  async function presentSuccess(
    result: Extract<PresentUploadedFieldResult, { type: "success" }>,
    isRerender: boolean,
  ) {
    const { field, renderParams, renderResult } = result;
    const { canvas } = mapRenderer.ensureHeatCanvas(field.grid);
    const corners = gridCorners(field.grid);

    setGridState(makeGridState(renderParams));

    try {
      mapRenderer.drawBitmap(renderResult.bitmap);
    } finally {
      renderResult.bitmap.close();
    }

    await mapRenderer.init();

    if (!isRerender) {
      mapRenderer.setLayer(canvas, corners);
      mapRenderer.fitBounds(boundsFromCorners(corners), { padding: 20, animate: false });
    }

    updateLegend(renderParams, renderResult);
    mapRenderer.triggerRepaint();
  }

  async function present(route: UploadedFieldRoute, options: { isRerender: boolean }) {
    if (!source.hasFile()) {
      navigation.redirectHome();

      return;
    }

    const messages = source.getMessages();
    const message = resolveUploadedMessage(messages, route);

    if (!message) {
      navigation.redirectHome();

      return;
    }

    preparePresentation(message, !options.isRerender);
    const requestedGeneration = ++renderGeneration;
    const result = await presenter.present({
      messages,
      route,
      renderGeneration: requestedGeneration,
    });

    if (result.type === "stale") {
      result.renderResult.bitmap.close();

      return;
    }

    if (result.type === "not-found") {
      navigation.redirectHome();

      return;
    }

    if (result.type === "decode-failed") {
      clearRenderedField();
      mapPresentation.showError(errorMessage(result));

      return;
    }

    if (result.type === "render-failed") {
      clearRenderedField();
      mapPresentation.showError("Render error.");

      return;
    }

    await presentSuccess(result, options.isRerender);
  }

  async function show(route: UploadedFieldRoute) {
    currentRoute = route;
    await present(route, { isRerender: false });
  }

  async function handlePaletteChange(palette: string) {
    applyPalette(palette);

    if (!currentRoute) {
      return;
    }

    await present(currentRoute, { isRerender: true });
  }

  return {
    getRenderGeneration: () => renderGeneration,
    handlePaletteChange,
    show,
  };
}
