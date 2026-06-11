import type { ModelBlockRenderResult } from "../../workers/model-block-worker-contracts";

interface BitmapCacheEntryOptions {
  keepValues?: boolean;
}

export function makeBitmapCacheEntryFromWorker(
  renderEntry: ModelBlockRenderResult,
  { keepValues = false }: BitmapCacheEntryOptions = {},
) {
  return {
    bitmap: renderEntry.bitmap,
    values: keepValues ? renderEntry.values : undefined,
    vectorComposite: renderEntry.vectorComposite,
    vectorUValues: renderEntry.vectorUValues,
    vectorVValues: renderEntry.vectorVValues,
    dataMin: renderEntry.dataMin,
    dataMax: renderEntry.dataMax,
    mean: renderEntry.dataMean,
    count: renderEntry.dataCount,
    unitTransform: renderEntry.unitTransform,
    renderMin: renderEntry.renderMin,
    range: renderEntry.range,
    staticScale: renderEntry.staticScale,
    isLog: renderEntry.isLog,
    displayUnits: renderEntry.displayUnits,
    isFallback: renderEntry.isFallback,
    isobars: renderEntry.isobars,
    grid: renderEntry.grid,
    product: renderEntry.product,
    header: renderEntry.header,
  };
}
