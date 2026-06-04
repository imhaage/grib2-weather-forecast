import { PACKAGES } from "../domain/model-packages.js";

export function createForecastPackageResourceService({
  fetchResources,
  isRefreshActive,
  packages = PACKAGES,
}) {
  async function fetchPackageResources(packageKey, downloadKey) {
    const pkg = packages[packageKey];
    let resources = await fetchResources(pkg.datasetId, pkg.titlePattern);
    if (!isRefreshActive(downloadKey)) return null;
    if (pkg.skipHour0) {
      resources = resources.filter((resource) => resource.startHour > 0);
    }
    return resources;
  }

  return {
    fetchPackageResources,
  };
}
