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

  function resetResourceStatuses(resources, modelState) {
    for (const resource of resources) {
      resource.status = missingStatus;
      modelState?.blockStatus?.set(resource.key, missingStatus);
    }
  }

  return {
    createSession,
    fileCountStatus,
    incrementAvailableCount,
    resetResourceStatuses,
  };
}
