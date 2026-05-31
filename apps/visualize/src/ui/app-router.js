import { parseForecastRoute } from "./forecast-route.js";

export function createAppRouter({
  getHash,
  replaceHash,
  setHash,
  addEventListener,
  removeEventListener,
  isValidPackage,
  getCurrentPackageKey,
  showView,
  showTab,
  setToolbarMode,
  showMapView,
  showDataStatusPanel,
  resetModelState,
  startDownload,
}) {
  function route() {
    const currentRoute = parseForecastRoute(getHash());
    if (currentRoute.canonicalHash) {
      replaceHash(currentRoute.canonicalHash);
      return;
    }

    if (currentRoute.type === "inspect") {
      showView("view-map");
      setToolbarMode("field");
      showMapView(currentRoute);
      return;
    }

    if (currentRoute.type === "forecast") {
      const { packageKey } = currentRoute;
      if (!isValidPackage(packageKey)) {
        setHash("");
        return;
      }

      showView("view-map");
      setToolbarMode("run");
      showDataStatusPanel();
      if (getCurrentPackageKey() !== packageKey) {
        resetModelState();
        startDownload(packageKey);
      }
      return;
    }

    showView("view-home");
    showTab(currentRoute.tab);
  }

  return {
    route,
    start() {
      addEventListener?.("hashchange", route);
      route();
    },
    stop() {
      removeEventListener?.("hashchange", route);
    },
  };
}
