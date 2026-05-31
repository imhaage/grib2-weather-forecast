export function mustFind(document, selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Required DOM element not found: "${selector}"`);
  }
  return element;
}

export function createDom(document) {
  return {
    forecastDownload: {
      bars: mustFind(document, "#forecast-dl-bars"),
      fileList: mustFind(document, "#forecast-dl-file-list"),
      status: mustFind(document, "#forecast-dl-status"),
    },
    forecast: {
      slider: mustFind(document, "#forecast-slider"),
      variableSelect: mustFind(document, "#forecast-var-select"),
    },
    cacheWarmup: {
      root: mustFind(document, "#cache-warmup"),
    },
    dataStatus: {
      panel: mustFind(document, "#data-status-panel"),
      summary: mustFind(document, "#data-status-summary"),
    },
    map: {
      scene: mustFind(document, "#map-scene"),
    },
    palette: {
      options: mustFind(document, "#palette-options"),
      uploadSelect: mustFind(document, "#palette-select"),
      forecastSelect: mustFind(document, "#palette-select-forecast"),
    },
  };
}
