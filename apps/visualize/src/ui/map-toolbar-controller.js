export function setMapToolbarMode(document, mode) {
  const isField = mode === "field";
  document.getElementById("map-back-btn").hidden = false;
  document.getElementById("map-toolbar").hidden = !isField;
  document.getElementById("forecast-player-toolbar").hidden = isField;
}
