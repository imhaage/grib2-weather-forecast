export function setGridToolbarMode(document, mode) {
  const isGrid = mode === "grid";
  document.getElementById("grid-back-btn").hidden = false;
  document.getElementById("grid-toolbar").hidden = !isGrid;
  document.getElementById("forecast-player-toolbar").hidden = isGrid;
}
