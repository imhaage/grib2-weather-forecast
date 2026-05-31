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
    player: {
      playButton: mustFind(document, "#player-play"),
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
      backButton: mustFind(document, "#map-back-btn"),
    },
    palette: {
      options: mustFind(document, "#palette-options"),
      uploadSelect: mustFind(document, "#palette-select"),
      forecastSelect: mustFind(document, "#palette-select-forecast"),
    },
    upload: {
      dropZone: mustFind(document, "#drop-zone"),
      fileInput: mustFind(document, "#file-input"),
      cards: mustFind(document, "#cards"),
    },
    storage: {
      clearCacheButton: mustFind(document, "#clear-grib-cache"),
      warning: mustFind(document, "#storage-warning"),
      warningButton: mustFind(document, "#storage-warning-button"),
      warningSize: mustFind(document, "#storage-warning-size"),
    },
  };
}
