import { isVectorCompositeVariable } from "../domain/wind-composite-variable.js";
import { createForecastRenderRequest } from "../use-cases/forecast/create-render-request";

export function createForecastHourWorkerRenderService({
  getCurrentPalette,
  getCurrentRenderGeneration,
  getModelBlockService,
  getModelState,
  missingValue,
  notifyDiagnostics,
  perfDebug = false,
  performanceApi = globalThis.performance,
}) {
  let lastRenderMs = null;
  const lastDecodeMs = null;

  function requestForHour(hourIndex, hour, { includeValues = false } = {}) {
    const modelState = getModelState();
    const shouldKeepValues = shouldKeepValuesForCurrentVariable();
    return createForecastRenderRequest({
      state: modelState,
      hourIndex,
      hour,
      renderGeneration: getCurrentRenderGeneration(),
      paletteName: getCurrentPalette(),
      missingValue,
      includeValues: includeValues || shouldKeepValues,
    });
  }

  function shouldKeepValuesForCurrentVariable() {
    return isVectorCompositeVariable(getModelState()?.variable);
  }

  async function renderHour(hourIndex, { includeValues = false } = {}) {
    const modelState = getModelState();
    const hour = modelState.hourList[hourIndex];
    const request = requestForHour(hourIndex, hour, { includeValues });
    if (!request) return null;

    const startedAt = perfDebug ? performanceApi.now() : 0;
    const result = await getModelBlockService().renderHour(request);
    if (!result) return null;
    if (perfDebug) {
      lastRenderMs = performanceApi.now() - startedAt;
      notifyDiagnostics();
    }
    if (getCurrentRenderGeneration() !== request.renderGeneration) {
      result.bitmap?.close();
      return null;
    }
    return result;
  }

  async function decodeValues(hourIndex, hour) {
    const request = requestForHour(hourIndex, hour, {
      includeValues: false,
    });
    if (!request) return null;
    const result = await getModelBlockService().decodeValues(request);
    if (!result?.values || getCurrentRenderGeneration() !== request.renderGeneration) return null;
    return result;
  }

  return {
    decodeValues,
    getLastDecodeMs: () => lastDecodeMs,
    getLastRenderMs: () => lastRenderMs,
    renderHour,
    shouldKeepValuesForCurrentVariable,
  };
}
