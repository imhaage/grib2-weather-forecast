export function createModelState(packageKey) {
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
  };
}

export function buildHourList(resources) {
  const hourList = [];
  for (const resource of resources) {
    for (let hour = resource.startHour; hour <= resource.endHour; hour++) {
      hourList.push(hour);
    }
  }
  return hourList;
}

export function blockForHour(resources, hour) {
  return (
    resources.find((resource) => hour >= resource.startHour && hour <= resource.endHour) ?? null
  );
}

export function markBlockAvailable(state, block) {
  state.availableBlocks.add(block.key);
}
