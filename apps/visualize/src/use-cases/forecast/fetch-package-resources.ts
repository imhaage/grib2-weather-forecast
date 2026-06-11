import type { ForecastPackage, RemoteResource } from "../../domain/forecast-types";
import { PACKAGES } from "../../domain/model-packages.js";
import type { ForecastRefreshKey } from "./contracts";

type ForecastPackageMap = Record<string, ForecastPackage>;

interface CreateForecastPackageResourceServiceOptions {
  fetchResources: (datasetId: string, titlePattern: string) => Promise<RemoteResource[]>;
  isRefreshActive: (downloadKey: ForecastRefreshKey) => boolean;
  packages?: ForecastPackageMap;
}

export function createForecastPackageResourceService({
  fetchResources,
  isRefreshActive,
  packages = PACKAGES,
}: CreateForecastPackageResourceServiceOptions) {
  async function fetchPackageResources(packageKey: string, downloadKey: ForecastRefreshKey) {
    const pkg = packages[packageKey];
    let resources = await fetchResources(pkg.datasetId, pkg.titlePattern);

    if (!isRefreshActive(downloadKey)) {
      return null;
    }

    if (pkg.skipHour0) {
      resources = resources.filter((resource) => (resource.startHour ?? 0) > 0);
    }

    return resources;
  }

  return {
    fetchPackageResources,
  };
}
