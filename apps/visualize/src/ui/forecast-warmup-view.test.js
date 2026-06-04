import { describe, expect, test, vi } from "vitest";
import { createForecastWarmupView } from "./forecast-warmup-view.js";

function createDom() {
  return {
    bar: { style: { width: "" } },
    count: { textContent: "" },
    label: { textContent: "" },
    root: { hidden: false, classList: { toggle: vi.fn() } },
  };
}

describe("forecast warmup view", () => {
  test("renders warmup progress state to DOM elements", () => {
    const dom = createDom();
    const view = createForecastWarmupView(dom);

    view.render({
      hidden: false,
      isReady: false,
      isWaiting: true,
      label: "Animation cache: waiting for downloads",
      percent: 50,
      ready: 1,
      total: 2,
    });

    expect(dom.root.hidden).toBe(false);
    expect(dom.root.classList.toggle).toHaveBeenCalledWith("waiting", true);
    expect(dom.root.classList.toggle).toHaveBeenCalledWith("ready", false);
    expect(dom.bar.style.width).toBe("50%");
    expect(dom.count.textContent).toBe("1 / 2");
    expect(dom.label.textContent).toBe("Animation cache: waiting for downloads");
  });
});
