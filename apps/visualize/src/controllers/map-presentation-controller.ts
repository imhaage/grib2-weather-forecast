import type { ProductDefinition } from "../domain/field-types";
import type { ForecastVariable } from "../domain/forecast-types";
import type { ForecastMapPresentationPort } from "../use-cases/forecast/map-contracts";

interface MapPresentationDom {
  colorScale: {
    bar: HTMLElement;
    root: HTMLElement;
    ticks: HTMLElement;
  };
  forecast: {
    validTime: HTMLElement;
  };
  map: {
    unavailable: HTMLElement;
  };
  mapInfo: {
    description: HTMLElement;
    level: HTMLElement;
    name: HTMLElement;
    subtitle: HTMLElement;
  };
  stats: {
    max: HTMLElement;
    mean: HTMLElement;
    min: HTMLElement;
    valid: HTMLElement;
  };
}

interface LegendTick {
  position: number;
  value: number;
}

interface CreateMapPresentationControllerOptions {
  dom: MapPresentationDom;
  formatValueForUnits(value: number, units: string | null | undefined, digits: number): string;
  getCurrentPalette(): string;
  legendTicksFor(options: {
    isLog: boolean;
    max: number;
    min: number;
    paletteName: string;
  }): LegendTick[];
}

export interface MapPresentationController extends ForecastMapPresentationPort {
  clearError(): void;
  showError(message: string): void;
}

export function createMapPresentationController({
  dom,
  formatValueForUnits,
  getCurrentPalette,
  legendTicksFor,
}: CreateMapPresentationControllerOptions): MapPresentationController {
  const unavailableMessage = dom.map.unavailable.textContent ?? "";

  function renderColorScaleTicks({
    min,
    max,
    units,
    isLog,
  }: {
    min: number;
    max: number;
    units: string | null | undefined;
    isLog: boolean;
  }) {
    dom.colorScale.ticks.replaceChildren();

    for (const tick of legendTicksFor({
      paletteName: getCurrentPalette(),
      min,
      max,
      isLog,
    })) {
      const element = dom.colorScale.ticks.ownerDocument.createElement("span");
      element.className = "cs-tick";
      element.style.left = `${tick.position}%`;
      element.textContent = formatValueForUnits(tick.value, units, 1);
      dom.colorScale.ticks.appendChild(element);
    }
  }

  return {
    clearError() {
      dom.map.unavailable.textContent = unavailableMessage;
      dom.map.unavailable.hidden = true;
    },

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

    setColorScaleGradient(stops: Array<{ color: string; position: number }>) {
      dom.colorScale.bar.style.background = `linear-gradient(to right, ${stops
        .map((stop) => `${stop.color} ${stop.position}%`)
        .join(", ")})`;
    },

    setForecastValidTime(label: string) {
      dom.forecast.validTime.textContent = label;
    },

    showColorScale(
      min: number,
      max: number,
      units: string | null | undefined,
      { isLog = false }: { isLog?: boolean } = {},
    ) {
      renderColorScaleTicks({ min, max, units, isLog });
      dom.colorScale.root.hidden = false;
    },

    showError(message: string) {
      dom.map.unavailable.textContent = message;
      dom.map.unavailable.hidden = false;
    },

    showUnavailable() {
      dom.map.unavailable.textContent = unavailableMessage;
      dom.map.unavailable.hidden = false;
    },

    updateLevelInfo(varDef: ForecastVariable | ProductDefinition | undefined) {
      const parts = [varDef?.level, varDef?.units].filter(Boolean);
      dom.mapInfo.level.textContent = parts.join(" · ");
    },

    updateParamInfo(name: string | undefined, description: string | null, subtitle: string) {
      dom.mapInfo.name.textContent = name ?? "";
      dom.mapInfo.description.textContent = description ?? "";
      dom.mapInfo.subtitle.textContent = subtitle;
    },

    updateStats(
      min: number,
      max: number,
      mean: number | undefined,
      count: number | undefined,
      units: string | null | undefined,
    ) {
      const unitSuffix = units ? ` ${units}` : "";

      dom.stats.min.textContent = `${formatValueForUnits(min, units, 3)}${unitSuffix}`;
      dom.stats.max.textContent = `${formatValueForUnits(max, units, 3)}${unitSuffix}`;
      dom.stats.mean.textContent =
        mean == null ? "—" : `${formatValueForUnits(mean, units, 3)}${unitSuffix}`;
      dom.stats.valid.textContent = count == null ? "—" : count.toLocaleString();
    },
  };
}
