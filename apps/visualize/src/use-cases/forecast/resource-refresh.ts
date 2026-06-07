import type { ForecastResourceRefreshKey, ForecastResourceRefreshState } from "./ports";

export function createForecastResourceRefreshUseCase() {
  function begin(
    state: ForecastResourceRefreshState | null | undefined,
  ): ForecastResourceRefreshKey | null {
    if (!state) {
      return null;
    }

    state.resourceRefreshId = (state.resourceRefreshId ?? 0) + 1;

    return {
      state,
      refreshId: state.resourceRefreshId,
    };
  }

  function isActive(
    currentState: ForecastResourceRefreshState | null | undefined,
    refreshKey: ForecastResourceRefreshKey | null | undefined,
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
