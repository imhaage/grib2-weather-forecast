import type { ForecastRunState } from "../../domain/forecast-types";
import type { ForecastRefreshKey } from "./contracts";

export function createForecastResourceRefreshUseCase() {
  function begin(state: ForecastRunState | null | undefined): ForecastRefreshKey | null {
    if (!state) {
      return null;
    }

    state.resourceRefreshId++;

    return {
      state,
      refreshId: state.resourceRefreshId,
    };
  }

  function isActive(
    currentState: ForecastRunState | null | undefined,
    refreshKey: ForecastRefreshKey | null | undefined,
  ): boolean {
    return Boolean(
      refreshKey &&
        currentState === refreshKey.state &&
        currentState?.resourceRefreshId === refreshKey.refreshId,
    );
  }

  return {
    begin,
    isActive,
  };
}
