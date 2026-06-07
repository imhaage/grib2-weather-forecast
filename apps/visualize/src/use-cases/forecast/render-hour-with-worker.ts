import { isVectorCompositeVariable } from "../../domain/wind-composite-variable.js";
import { createForecastRenderRequest } from "./create-render-request";

type ForecastRenderRequest = NonNullable<ReturnType<typeof createForecastRenderRequest>>;

interface RenderedHourResult {
  bitmap?: {
    close: () => void;
  };
  values?: Float32Array;
}

interface ModelBlockService {
  decodeValues: (request: ForecastRenderRequest) => Promise<RenderedHourResult | null>;
  renderHour: (request: ForecastRenderRequest) => Promise<RenderedHourResult | null>;
}

interface PerformanceApi {
  now: () => number;
}

interface CreateForecastHourWorkerRenderServiceOptions {
  getCurrentPalette: () => string;
  getCurrentRenderGeneration: () => number;
  getModelBlockService: () => ModelBlockService;
  getModelState: () => Parameters<typeof createForecastRenderRequest>[0]["state"];
  missingValue: number;
  notifyDiagnostics: () => void;
  perfDebug?: boolean;
  performanceApi?: PerformanceApi;
}

export function createForecastHourWorkerRenderService({
  getCurrentPalette,
  getCurrentRenderGeneration,
  getModelBlockService,
  getModelState,
  missingValue,
  notifyDiagnostics,
  perfDebug = false,
  performanceApi = globalThis.performance,
}: CreateForecastHourWorkerRenderServiceOptions) {
  let lastRenderMs: number | null = null;
  const lastDecodeMs = null;

  function requestForHour(hourIndex: number, hour: number, { includeValues = false } = {}) {
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

  async function renderHour(hourIndex: number, { includeValues = false } = {}) {
    const modelState = getModelState();
    const hour = modelState.hourList[hourIndex];
    const request = requestForHour(hourIndex, hour, { includeValues });

    if (!request) {
      return null;
    }

    const startedAt = perfDebug ? performanceApi.now() : 0;
    const result = await getModelBlockService().renderHour(request);

    if (!result) {
      return null;
    }

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

  async function decodeValues(hourIndex: number, hour: number) {
    const request = requestForHour(hourIndex, hour, {
      includeValues: false,
    });

    if (!request) {
      return null;
    }

    const result = await getModelBlockService().decodeValues(request);

    if (!result?.values || getCurrentRenderGeneration() !== request.renderGeneration) {
      return null;
    }

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
