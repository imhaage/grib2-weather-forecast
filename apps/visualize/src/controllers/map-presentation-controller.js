export function createMapPresentationController({
  dom,
  formatValueForUnits,
  getCurrentPalette,
  legendTicksFor,
}) {
  function renderColorScaleTicks({ min, max, units, isLog }) {
    dom.colorScale.ticks.replaceChildren();
    for (const tick of legendTicksFor({
      paletteName: getCurrentPalette(),
      min,
      max,
      isLog,
    })) {
      const element = document.createElement("span");
      element.className = "cs-tick";
      element.style.left = `${tick.position}%`;
      element.textContent = formatValueForUnits(tick.value, units, 1);
      dom.colorScale.ticks.appendChild(element);
    }
  }

  return {
    clearStats() {
      dom.stats.min.textContent = "—";
      dom.stats.max.textContent = "—";
      dom.stats.mean.textContent = "—";
      dom.stats.valid.textContent = "—";
    },

    hideColorScale() {
      dom.colorScale.root.hidden = true;
    },

    hideUnavailable() {
      dom.map.unavailable.hidden = true;
    },

    setColorScaleGradient(stops) {
      dom.colorScale.bar.style.background = `linear-gradient(to right, ${stops
        .map((stop) => `${stop.color} ${stop.position}%`)
        .join(", ")})`;
    },

    setForecastValidTime(label) {
      dom.forecast.validTime.textContent = label;
    },

    showColorScale(min, max, units, { isLog = false } = {}) {
      renderColorScaleTicks({ min, max, units, isLog });
      dom.colorScale.root.hidden = false;
    },

    showUnavailable() {
      dom.map.unavailable.hidden = false;
    },

    updateLevelInfo(varDef) {
      const parts = [varDef?.level, varDef?.units].filter(Boolean);
      dom.mapInfo.level.textContent = parts.join(" · ");
    },

    updateParamInfo(name, description, subtitle) {
      dom.mapInfo.name.textContent = name;
      dom.mapInfo.description.textContent = description;
      dom.mapInfo.subtitle.textContent = subtitle;
    },

    updateStats(min, max, mean, count, units) {
      dom.stats.min.textContent = `${formatValueForUnits(min, units, 3)} ${units}`;
      dom.stats.max.textContent = `${formatValueForUnits(max, units, 3)} ${units}`;
      dom.stats.mean.textContent = `${formatValueForUnits(mean, units, 3)} ${units}`;
      dom.stats.valid.textContent = count.toLocaleString();
    },
  };
}
