export function mustFind(document, selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Required DOM element not found: "${selector}"`);
  }
  return element;
}

export function createDom(document) {
  return {
    views: {
      home: mustFind(document, "#view-home"),
      map: mustFind(document, "#view-map"),
    },
    home: {
      modelList: mustFind(document, "#model-list"),
      tabButtons: [...document.querySelectorAll(".tab-btn")],
    },
    forecastDownload: {
      bars: mustFind(document, "#forecast-dl-bars"),
      fileList: mustFind(document, "#forecast-dl-file-list"),
      status: mustFind(document, "#forecast-dl-status"),
    },
    forecast: {
      slider: mustFind(document, "#forecast-slider"),
      variableSelect: mustFind(document, "#forecast-var-select"),
      hourLabel: mustFind(document, "#forecast-hour-label"),
      validTime: mustFind(document, "#forecast-valid-time"),
    },
    player: {
      playButton: mustFind(document, "#player-play"),
      resetButton: mustFind(document, "#player-reset"),
      iconPlay: mustFind(document, "#icon-play"),
      iconPause: mustFind(document, "#icon-pause"),
    },
    cacheWarmup: {
      root: mustFind(document, "#cache-warmup"),
      bar: mustFind(document, "#cache-warmup-bar"),
      count: mustFind(document, "#cache-warmup-count"),
      label: mustFind(document, "#cache-warmup-label"),
    },
    perfDebug: {
      panel: mustFind(document, "#perf-debug"),
      render: mustFind(document, "#perf-debug-render"),
      decode: mustFind(document, "#perf-debug-decode"),
      queue: mustFind(document, "#perf-debug-queue"),
      cache: mustFind(document, "#perf-debug-cache"),
      decoded: mustFind(document, "#perf-debug-decoded"),
      generation: mustFind(document, "#perf-debug-generation"),
    },
    dataStatus: {
      panel: mustFind(document, "#data-status-panel"),
      summary: mustFind(document, "#data-status-summary"),
    },
    map: {
      scene: mustFind(document, "#map-scene"),
      wrap: mustFind(document, "#map-wrap"),
      canvas: mustFind(document, "#map"),
      tooltip: mustFind(document, "#map-tooltip"),
      unavailable: mustFind(document, "#map-unavailable"),
      backButton: mustFind(document, "#map-back-btn"),
    },
    mapInfo: {
      subtitle: mustFind(document, "#gv-sub"),
      name: mustFind(document, "#gv-name"),
      description: mustFind(document, "#gv-desc"),
      level: mustFind(document, "#gv-level"),
    },
    stats: {
      min: mustFind(document, "#gv-min"),
      max: mustFind(document, "#gv-max"),
      mean: mustFind(document, "#gv-mean"),
      valid: mustFind(document, "#gv-valid"),
    },
    colorScale: {
      root: mustFind(document, "#colorscale"),
      bar: mustFind(document, "#cs-bar"),
      ticks: mustFind(document, "#cs-ticks"),
    },
    palette: {
      options: mustFind(document, "#palette-options"),
      uploadSelect: mustFind(document, "#palette-select"),
      forecastSelect: mustFind(document, "#palette-select-forecast"),
    },
    upload: {
      dropZone: mustFind(document, "#drop-zone"),
      fileInput: mustFind(document, "#file-input"),
      summary: mustFind(document, "#file-summary"),
      name: mustFind(document, "#s-name"),
      size: mustFind(document, "#s-size"),
      count: mustFind(document, "#s-count"),
      centre: mustFind(document, "#s-centre"),
      referenceTime: mustFind(document, "#s-reftime"),
      results: mustFind(document, "#results"),
      cards: mustFind(document, "#cards"),
      status: mustFind(document, "#status"),
    },
    storage: {
      clearCacheButton: mustFind(document, "#clear-grib-cache"),
      warning: mustFind(document, "#storage-warning"),
      warningCloseButton: mustFind(document, "#storage-warning-close"),
      warningButton: mustFind(document, "#storage-warning-button"),
      warningSize: mustFind(document, "#storage-warning-size"),
    },
  };
}
