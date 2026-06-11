/**
 * @param {{
 *   hourLabel?: HTMLElement | null,
 *   slider: HTMLInputElement
 * }} options
 */
export function createForecastHourControlView({ hourLabel = null, slider }) {
  function selectedIndex() {
    return Number.parseInt(slider.value, 10);
  }

  function renderHourList(hourList) {
    slider.max = String(hourList.length - 1);

    if (Number(slider.value) > Number(slider.max)) {
      slider.value = slider.max;
    }
  }

  function renderHourLabel(label) {
    if (hourLabel) {
      hourLabel.textContent = label;
    }
  }

  function reset() {
    slider.value = "0";
  }

  return {
    renderHourLabel,
    renderHourList,
    reset,
    selectedIndex,
  };
}
