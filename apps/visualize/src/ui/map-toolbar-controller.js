export function setMapToolbarMode(document, mode, { showWindDirectionControl } = {}) {
  const isField = mode === "field";
  document.getElementById("map-back-btn").hidden = false;
  document.getElementById("map-toolbar").hidden = !isField;
  document.getElementById("forecast-player-toolbar").hidden = isField;
  const windDirectionControl = document.getElementById("forecast-wind-direction-control");
  if (windDirectionControl && showWindDirectionControl != null) {
    windDirectionControl.hidden = !showWindDirectionControl;
  }
}
