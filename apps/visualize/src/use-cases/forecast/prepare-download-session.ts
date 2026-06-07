import type { ForecastDownloadPreparationPorts, ForecastSessionPreparationRequest } from "./ports";

export function createForecastDownloadPreparationUseCase({
  applyResources,
  createSession,
  formatRunSummary,
  renderItems,
  resetResourceStatuses,
}: ForecastDownloadPreparationPorts) {
  function prepareSession({
    packageKey,
    pkg,
    resources,
    downloadKey,
  }: ForecastSessionPreparationRequest) {
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
