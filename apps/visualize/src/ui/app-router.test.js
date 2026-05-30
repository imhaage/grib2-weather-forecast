import { describe, expect, test, vi } from "vitest";
import { createAppRouter } from "./app-router.js";

function createRouter(overrides = {}) {
  const calls = [];
  const router = createAppRouter({
    getHash: () => overrides.hash ?? "#forecast",
    replaceHash: (hash) => calls.push(["replaceHash", hash]),
    setHash: (hash) => calls.push(["setHash", hash]),
    addEventListener: overrides.addEventListener,
    removeEventListener: overrides.removeEventListener,
    isValidPackage: (packageKey) => packageKey === "AROME_SP1",
    getCurrentPackageKey: () => overrides.currentPackageKey ?? null,
    showView: (view) => calls.push(["showView", view]),
    showTab: (tab) => calls.push(["showTab", tab]),
    setToolbarMode: (mode) => calls.push(["setToolbarMode", mode]),
    showMapView: (shortName) => calls.push(["showMapView", shortName]),
    showDataStatusPanel: () => calls.push(["showDataStatusPanel"]),
    resetModelState: () => calls.push(["resetModelState"]),
    startDownload: (packageKey) => calls.push(["startDownload", packageKey]),
  });
  return { router, calls };
}

describe("app router", () => {
  test("redirects non-canonical routes", () => {
    const { router, calls } = createRouter({ hash: "" });

    router.route();

    expect(calls).toEqual([["replaceHash", "#forecast"]]);
  });

  test("shows the requested home tab", () => {
    const { router, calls } = createRouter({ hash: "#inspect" });

    router.route();

    expect(calls).toEqual([
      ["showView", "view-home"],
      ["showTab", "upload"],
    ]);
  });

  test("shows uploaded fields on the map", () => {
    const { router, calls } = createRouter({ hash: "#inspect/t" });

    router.route();

    expect(calls).toEqual([
      ["showView", "view-map"],
      ["setToolbarMode", "field"],
      ["showMapView", "t"],
    ]);
  });

  test("starts a forecast run when the package changes", () => {
    const { router, calls } = createRouter({ hash: "#forecast/AROME_SP1" });

    router.route();

    expect(calls).toEqual([
      ["showView", "view-map"],
      ["setToolbarMode", "run"],
      ["showDataStatusPanel"],
      ["resetModelState"],
      ["startDownload", "AROME_SP1"],
    ]);
  });

  test("does not restart the current forecast package", () => {
    const { router, calls } = createRouter({
      hash: "#forecast/AROME_SP1",
      currentPackageKey: "AROME_SP1",
    });

    router.route();

    expect(calls).toEqual([
      ["showView", "view-map"],
      ["setToolbarMode", "run"],
      ["showDataStatusPanel"],
    ]);
  });

  test("sends invalid forecast packages back to the default route", () => {
    const { router, calls } = createRouter({ hash: "#forecast/UNKNOWN" });

    router.route();

    expect(calls).toEqual([["setHash", ""]]);
  });

  test("can start and stop hashchange routing", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const { router } = createRouter({
      addEventListener,
      removeEventListener,
    });

    router.start();
    router.stop();

    expect(addEventListener).toHaveBeenCalledWith("hashchange", router.route);
    expect(removeEventListener).toHaveBeenCalledWith("hashchange", router.route);
  });
});
