// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { createForecastHourControlView } from "./forecast-hour-control-view.js";

describe("forecast hour control view", () => {
  test("renders hour count to slider bounds and clamps stale selection", () => {
    const slider = Object.assign(document.createElement("input"), {
      max: "9",
      value: "4",
    });
    const view = createForecastHourControlView({ slider });

    view.renderHourList([1, 2, 3]);

    expect(slider.max).toBe("2");
    expect(slider.value).toBe("2");
  });

  test("resets and reads the selected hour index", () => {
    const slider = Object.assign(document.createElement("input"), {
      max: "3",
      value: "2",
    });
    const view = createForecastHourControlView({ slider });

    expect(view.selectedIndex()).toBe(2);

    view.reset();

    expect(slider.value).toBe("0");
    expect(view.selectedIndex()).toBe(0);
  });

  test("renders the current forecast hour label", () => {
    const label = document.createElement("span");
    const view = createForecastHourControlView({
      hourLabel: label,
      slider: document.createElement("input"),
    });

    view.renderHourLabel("+03H");

    expect(label.textContent).toBe("+03H");
  });
});
