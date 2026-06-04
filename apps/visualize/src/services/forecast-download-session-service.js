export function createForecastDownloadSessionService({ missingStatus = "missing" } = {}) {
  function createSession({ packageKey, pkg, resources, runSummary, downloadKey }) {
    return {
      packageKey,
      pkg,
      pkgVars: pkg.variables,
      resources,
      runSummary,
      downloadKey,
      availableCount: 0,
      legendInitialized: false,
    };
  }

  function incrementAvailableCount(session) {
    session.availableCount++;
    return session.availableCount;
  }

  function fileCountStatus(session) {
    return `${session.availableCount} / ${session.resources.length} files`;
  }

  function downloadStatus(session) {
    return `Downloading ${session.resources.length} ${session.packageKey} files (${session.runSummary})…`;
  }

  function refreshStatus(session) {
    return `Checking ${session.resources.length} ${session.packageKey} files (${session.runSummary})…`;
  }

  function resetResourceStatuses(resources, modelState) {
    for (const resource of resources) {
      resource.status = missingStatus;
      modelState?.blockStatus?.set(resource.key, missingStatus);
    }
  }

  return {
    createSession,
    downloadStatus,
    fileCountStatus,
    incrementAvailableCount,
    refreshStatus,
    resetResourceStatuses,
  };
}
