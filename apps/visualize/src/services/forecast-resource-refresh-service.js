export function createForecastResourceRefreshService() {
  function begin(state) {
    if (!state) return null;
    state.resourceRefreshId = (state.resourceRefreshId ?? 0) + 1;
    return {
      state,
      refreshId: state.resourceRefreshId,
    };
  }

  function isActive(currentState, refreshKey) {
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
