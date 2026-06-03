export function bindAppEvents({ document, dom, handlers }) {
  const controller = new AbortController();
  const { signal } = controller;

  dom.map.backButton.addEventListener("click", handlers.handleMapBack, { signal });
  dom.palette.uploadSelect.addEventListener("change", handlers.onPaletteChange, { signal });
  dom.palette.forecastSelect.addEventListener("change", handlers.onPaletteChange, { signal });
  dom.forecast.variableSelect.addEventListener("change", handlers.onForecastVariableChange, {
    signal,
  });
  dom.forecast.slider.addEventListener("input", handlers.onForecastSliderInput, { signal });
  dom.storage.clearCacheButton.addEventListener("click", handlers.onClearCache, { signal });
  dom.storage.warningCloseButton.addEventListener("click", handlers.onStorageWarningClose, {
    signal,
  });
  dom.storage.warningButton.addEventListener("click", handlers.onStorageWarningToggle, {
    signal,
  });
  document.addEventListener("keydown", handlers.onDocumentKeydown, { signal });

  return () => controller.abort();
}
