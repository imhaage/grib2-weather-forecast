import type { createDataGouvResourceService } from "../adapters/forecast/data-gouv-resource-adapter";
import type { GridDefinition } from "../domain/field-types";
import type {
  BlockStatus,
  ForecastPackage,
  ForecastVariable,
  RemoteResource,
} from "../domain/forecast-types";
import type {
  ForecastMapEntry,
  ForecastMapPresentationPort,
  ForecastMapRendererPort,
  MapCorner,
} from "../use-cases/forecast/map-contracts";
import type {
  ForecastDownloadWorkerPort,
  ForecastModelBlockPort,
  ForecastWarmupProgress,
} from "../use-cases/forecast/runtime-contracts";

export interface ForecastScheduler {
  requestAnimationFrame(callback: () => void): number;
  requestIdleCallback?(callback: () => void, options?: { timeout: number }): number;
}

export interface ForecastDataStatusSummaryView {
  render(resources: RemoteResource[]): void;
}

export interface ForecastDownloadView {
  clear(): void;
  renderItems(resources: RemoteResource[]): void;
  resetBlockDownloadProgress(block: RemoteResource): void;
  setBlockDownloadProgress(block: RemoteResource, progress: string): void;
  setBlockStatus(block: RemoteResource, status: BlockStatus): void;
  setStatus(status: string): void;
}

export interface ForecastHourControlView {
  renderHourLabel(label: string): void;
  renderHourList(hours: number[]): void;
  reset(): void;
  selectedIndex(): number;
}

export interface ForecastWarmupView {
  render(progress: ForecastWarmupProgress): void;
}

export interface ForecastVariableControls {
  defaultVariableForPackage(pkg: ForecastPackage): ForecastVariable | undefined;
  renderVariableOptions(options: { selectedVariable: string; variables: ForecastVariable[] }): void;
  renderWindDirectionToggle(options: { checked: boolean; hidden: boolean }): void;
}

export interface ForecastRuntimeViews {
  dataStatusSummaryView: ForecastDataStatusSummaryView;
  forecastDownloadView: ForecastDownloadView;
  forecastHourControlView: ForecastHourControlView;
  forecastWarmupView: ForecastWarmupView;
}

export interface CreateForecastRuntimeFactoryOptions {
  window: ForecastScheduler;
  mapRenderer: ForecastMapRendererPort;
  mapPresentation: ForecastMapPresentationPort;
  perfDebug?: boolean;
  missingValue: number;
  makeGridState(
    entry: ForecastMapEntry,
    values?: Float32Array | null,
  ): { values?: Float32Array | null } | unknown;
  gridCorners(grid: GridDefinition): MapCorner[];
  initMap(): Promise<unknown>;
  fetchImpl?: NonNullable<Parameters<typeof createDataGouvResourceService>[0]["fetchImpl"]>;
  createDownloadWorkerClient?: () => ForecastDownloadWorkerPort;
  createModelBlockServiceClient?: () => ForecastModelBlockPort;
  getCurrentPalette(): string;
  getGridState(): { values?: Float32Array | null } | null | undefined;
  setCurrentPalette(palette: string): void;
  setGridState(gridState: unknown): void;
  setRendering(rendering: boolean): void;
  updateDiagnostics?(): void;
  updateStorageWarningSizeIfOpen?(): void;
  views: ForecastRuntimeViews;
  variableControls: ForecastVariableControls;
}
