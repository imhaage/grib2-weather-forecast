interface ForecastWorkerBitmapEntry {
  bitmap?: unknown;
  values?: unknown;
  vectorComposite?: unknown;
  vectorUValues?: unknown;
  vectorVValues?: unknown;
  dataMin?: unknown;
  dataMax?: unknown;
  dataMean?: unknown;
  dataCount?: unknown;
  unitTransform?: unknown;
  renderMin?: unknown;
  range?: unknown;
  staticScale?: unknown;
  isLog?: unknown;
  displayUnits?: unknown;
  isFallback?: unknown;
  isobars?: unknown;
  grid?: unknown;
  product?: unknown;
  header?: unknown;
}

interface BitmapCacheEntryOptions {
  keepValues?: boolean;
}

export function makeBitmapCacheEntryFromWorker(
  renderEntry: ForecastWorkerBitmapEntry,
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
