import type {
  ForecastPackage,
  ForecastRunState,
  ForecastVariable,
  PackageKey,
  RemoteResource,
} from "../../domain/forecast-types";

export interface ForecastRefreshKey {
  state: ForecastRunState;
  refreshId: number;
}

export interface ForecastDownloadSession {
  packageKey: PackageKey;
  pkg: ForecastPackage;
  pkgVars: ForecastVariable[];
  resources: RemoteResource[];
  runSummary: string;
  downloadKey: ForecastRefreshKey;
  availableCount: number;
  legendInitialized: boolean;
}
