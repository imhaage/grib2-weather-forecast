import type { ForecastRunState, PackageKey, RemoteResource } from "./forecast-types";

interface ResourceRange {
  startHour?: number;
  endHour?: number;
}

interface ResourceKey {
  key: string;
}

export function createModelState(packageKey: PackageKey): ForecastRunState {
  return {
    packageKey,
    resourceRefreshId: 0,
    resources: [],
    availableBlocks: new Set(),
    hourList: [],
    blockStatus: new Map(),
    variable: null,
    currentHour: null,
    lastRunInfo: null,
    animationCacheStatus: "waiting",
    showWindDirection: true,
  };
}

export function buildHourList(resources: Required<ResourceRange>[]) {
  const hourList = [];

  for (const resource of resources) {
    for (let hour = resource.startHour; hour <= resource.endHour; hour++) {
      hourList.push(hour);
    }
  }

  return hourList;
}

export function blockForHour<T extends ResourceRange>(
  resources: T[],
  hour: number | null | undefined,
): T | null {
  return (
    resources.find(
      (resource) =>
        hour != null &&
        resource.startHour != null &&
        resource.endHour != null &&
        hour >= resource.startHour &&
        hour <= resource.endHour,
    ) ?? null
  );
}

export function markBlockAvailable(state: ForecastRunState, block: ResourceKey | RemoteResource) {
  state.availableBlocks.add(block.key);
}
