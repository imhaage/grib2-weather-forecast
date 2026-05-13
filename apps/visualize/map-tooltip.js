export function setupMapTooltip({
  map,
  maplibregl,
  getGridState,
  missingValue,
  tooltipEl,
  wrapEl,
}) {
  let mapClickMarker = null;
  const mapCanvas = map.getCanvas();

  function showMapClickMarker(lngLat) {
    if (!mapClickMarker) {
      const element = document.createElement("div");
      element.className = "map-click-marker";
      mapClickMarker = new maplibregl.Marker({ element, anchor: "center" });
    }
    mapClickMarker.setLngLat(lngLat).addTo(map);
  }

  function shouldShowMapClickMarker(event) {
    return event.pointerType === "touch" ||
      event.sourceCapabilities?.firesTouchEvents === true ||
      window.matchMedia("(pointer: coarse)").matches;
  }

  function hideTooltip(cursor = "") {
    tooltipEl.hidden = true;
    mapCanvas.style.cursor = cursor;
  }

  function showTooltipForMapEvent(e) {
    const gridState = getGridState();
    if (!gridState) return;
    const { lat, lng } = e.lngLat;
    const { grid, values, product } = gridState;
    if (!values) {
      hideTooltip();
      return;
    }
    const {
      ni,
      latitudeOfFirstPoint: la1,
      longitudeOfFirstPoint: lo1,
      latitudeOfLastPoint: la2,
      longitudeOfLastPoint: lo2,
      di,
      dj,
    } = grid;

    const northLat = Math.max(la1, la2);
    const southLat = Math.min(la1, la2);
    const isStoN = la2 > la1;

    if (lat > northLat || lat < southLat || lng < lo1 || lng > lo2) {
      hideTooltip();
      return;
    }

    const rowFromNorth = Math.round((northLat - lat) / dj);
    const row = isStoN ? grid.nj - 1 - rowFromNorth : rowFromNorth;
    const col = Math.round((lng - lo1) / di);
    const idx = row * ni + col;
    const rawVal = idx >= 0 && idx < values.length ? values[idx] : missingValue;
    if (rawVal <= missingValue) {
      hideTooltip("default");
      return;
    }

    const val = gridState.unitFn ? gridState.unitFn(rawVal) : rawVal;
    mapCanvas.style.cursor = "crosshair";
    tooltipEl.hidden = false;
    tooltipEl.textContent = `${product.name} : ${val.toFixed(2)} ${gridState.displayUnits ?? product.units}`;
    const rect = wrapEl.getBoundingClientRect();
    tooltipEl.style.left = e.originalEvent.clientX - rect.left + 14 + "px";
    tooltipEl.style.top = e.originalEvent.clientY - rect.top - 36 + "px";
  }

  map.on("mousemove", showTooltipForMapEvent);

  map.on("click", (e) => {
    if (shouldShowMapClickMarker(e.originalEvent)) showMapClickMarker(e.lngLat);
    showTooltipForMapEvent(e);
  });

  map.on("mouseout", () => {
    hideTooltip();
  });
}
