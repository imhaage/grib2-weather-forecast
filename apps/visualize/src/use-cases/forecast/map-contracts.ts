import type {
  GridDefinition,
  MessageHeader,
  ProductDefinition,
  StaticScale,
  UnitTransformKey,
} from "../../domain/field-types";
import type { ForecastVariable } from "../../domain/forecast-types";
import type { ModelBlockVectorComposite } from "../../workers/model-block-worker-contracts";

export type MapCorner = [number, number];
export type ForecastBounds = [MapCorner, MapCorner];

export interface ViewportBounds {
  east: number;
  north: number;
  south: number;
  west: number;
}

export interface ForecastRaster {
  close(): void;
}

export type ForecastMapCanvas = object;

export interface ForecastFeatureCollection {
  type: "FeatureCollection";
  features: unknown[];
}

export interface ForecastMapEntry {
  bitmap: ForecastRaster;
  count?: number;
  dataMax: number;
  dataMin: number;
  displayUnits?: string | null;
  grid: GridDefinition;
  header: MessageHeader;
  isFallback?: boolean;
  isLog?: boolean;
  isobars?: ForecastFeatureCollection | null;
  mean?: number;
  product: ProductDefinition;
  range: number;
  renderMin: number;
  staticScale?: StaticScale | null;
  unitTransform?: UnitTransformKey;
  values?: Float32Array | null;
  vectorComposite?: ModelBlockVectorComposite | null;
  vectorUValues?: Float32Array | null;
  vectorVValues?: Float32Array | null;
}

export interface ForecastMapPresentationPort {
  clearStats(): void;
  hideColorScale(): void;
  hideUnavailable(): void;
  setColorScaleGradient(stops: Array<{ color: string; position: number }>): void;
  setForecastValidTime(label: string): void;
  showColorScale(
    min: number,
    max: number,
    units: string | null | undefined,
    options: { isLog?: boolean },
  ): void;
  showUnavailable(): void;
  updateLevelInfo(variable: ForecastVariable | ProductDefinition | undefined): void;
  updateParamInfo(name: string | undefined, description: string | null, subtitle: string): void;
  updateStats(
    min: number,
    max: number,
    mean: number | undefined,
    count: number | undefined,
    units: string | null | undefined,
  ): void;
}

export interface ForecastMapRendererPort {
  clearIsobars(): void;
  clearLayer(): void;
  clearWindSymbols?(): void;
  drawBitmap(bitmap: ForecastRaster): void;
  ensureHeatCanvas(grid: GridDefinition): {
    canvas: ForecastMapCanvas;
    canvasChanged: boolean;
  };
  fitBounds(bounds: ForecastBounds, options?: { animate?: boolean; padding?: number }): void;
  getViewportBounds?(): ViewportBounds | null;
  getZoom?(): number;
  hasLayer(): boolean;
  onViewportSettled?(callback: () => void): void;
  setLayer(canvas: ForecastMapCanvas, corners: MapCorner[]): void;
  setVisible(visible: boolean): void;
  triggerRepaint(): void;
  updateIsobars(geojson: ForecastFeatureCollection | null | undefined): void;
  updateWindSymbols?(geojson: ForecastFeatureCollection): void;
}
