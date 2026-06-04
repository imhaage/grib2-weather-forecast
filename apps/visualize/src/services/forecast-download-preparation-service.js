export function createForecastDownloadPreparationService({
  applyResources,
  createSession,
  formatRunSummary,
  renderItems,
  resetResourceStatuses,
}) {
  function prepareSession({ packageKey, pkg, resources, downloadKey }) {
    applyResources(resources);
    const runSummary = formatRunSummary(resources);
    renderItems(resources);
    resetResourceStatuses(resources);
    return createSession({
      packageKey,
      pkg,
      resources,
      runSummary,
      downloadKey,
    });
  }

  return {
    prepareSession,
  };
}
