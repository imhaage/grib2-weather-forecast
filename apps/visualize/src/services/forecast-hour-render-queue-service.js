export function createForecastHourRenderQueueService() {
  let isRendering = false;
  let pendingHourIndex = null;

  function requestRender(hourIndex) {
    if (isRendering) {
      pendingHourIndex = hourIndex;
      return { shouldRender: false };
    }
    isRendering = true;
    pendingHourIndex = null;
    return { shouldRender: true };
  }

  function completeRender() {
    isRendering = false;
    const nextHourIndex = pendingHourIndex;
    pendingHourIndex = null;
    return nextHourIndex;
  }

  function reset() {
    isRendering = false;
    pendingHourIndex = null;
  }

  return {
    completeRender,
    requestRender,
    reset,
  };
}
