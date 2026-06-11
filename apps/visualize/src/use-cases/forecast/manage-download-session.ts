import type { BlockStatus, ForecastRunState, RemoteResource } from "../../domain/forecast-types";
import { runTimeValue } from "../../domain/resources.js";
import type { ForecastDownloadSession } from "./contracts";

interface CreateForecastDownloadSessionServiceOptions {
  missingStatus?: BlockStatus;
}

export function createForecastDownloadSessionService({
  missingStatus = "missing",
}: CreateForecastDownloadSessionServiceOptions = {}) {
  function createSession({
    packageKey,
    pkg,
    resources,
    runSummary,
    downloadKey,
  }: Omit<ForecastDownloadSession, "availableCount" | "legendInitialized" | "pkgVars">) {
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

  function incrementAvailableCount(session: ForecastDownloadSession) {
    session.availableCount++;

    return session.availableCount;
  }

  function fileCountStatus(session: ForecastDownloadSession) {
    return `${session.availableCount} / ${session.resources.length} files`;
  }

  function downloadStatus(session: ForecastDownloadSession) {
    return `Downloading ${session.resources.length} ${session.packageKey} files (${session.runSummary})…`;
  }

  function refreshStatus(session: ForecastDownloadSession) {
    return `Checking ${session.resources.length} ${session.packageKey} files (${session.runSummary})…`;
  }

  function resetResourceStatuses(resources: RemoteResource[], modelState?: ForecastRunState) {
    for (const resource of resources) {
      resource.status = missingStatus;
      modelState?.blockStatus?.set(resource.key, missingStatus);
    }
  }

  function isBlockInMemoryCurrent(
    modelState: ForecastRunState,
    { block, previousBlock }: { block: RemoteResource; previousBlock?: RemoteResource },
  ) {
    return Boolean(
      previousBlock &&
        modelState.availableBlocks.has(block.key) &&
        previousBlock.filesize === block.filesize &&
        runTimeValue(previousBlock.runId) >= runTimeValue(block.runId),
    );
  }

  function isBlockInMemoryStale(
    modelState: ForecastRunState,
    { block, previousBlock }: { block: RemoteResource; previousBlock?: RemoteResource },
  ) {
    return Boolean(
      previousBlock &&
        modelState.availableBlocks.has(block.key) &&
        runTimeValue(previousBlock.runId) < runTimeValue(block.runId),
    );
  }

  return {
    createSession,
    downloadStatus,
    fileCountStatus,
    incrementAvailableCount,
    isBlockInMemoryCurrent,
    isBlockInMemoryStale,
    refreshStatus,
    resetResourceStatuses,
  };
}
