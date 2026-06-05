import { PACKAGES } from "../../domain/model-packages.js";

interface ForecastPackageResource {
  startHour?: number;
}

interface ForecastPackage {
  datasetId: string;
  skipHour0?: boolean;
  titlePattern: string;
}

type ForecastPackageMap = Record<string, ForecastPackage>;

interface CreateForecastPackageResourceServiceOptions {
  fetchResources: (datasetId: string, titlePattern: string) => Promise<ForecastPackageResource[]>;
  isRefreshActive: (downloadKey: unknown) => boolean;
  packages?: ForecastPackageMap;
}

export function createForecastPackageResourceService({
  fetchResources,
  isRefreshActive,
  packages = PACKAGES,
}: CreateForecastPackageResourceServiceOptions) {
  async function fetchPackageResources(packageKey: string, downloadKey: unknown) {
    const pkg = packages[packageKey];
    let resources = await fetchResources(pkg.datasetId, pkg.titlePattern);
    if (!isRefreshActive(downloadKey)) return null;
    if (pkg.skipHour0) {
      resources = resources.filter((resource) => (resource.startHour ?? 0) > 0);
    }
    return resources;
  }

  return {
    fetchPackageResources,
  };
}
