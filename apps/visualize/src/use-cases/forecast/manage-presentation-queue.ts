import type { BlockStatus, RemoteResource } from "../../domain/forecast-types";
import type { ForecastDownloadSession } from "./contracts";

interface PresentationJob {
  block: RemoteResource;
  buffer: Uint8Array;
  status: BlockStatus;
}

interface PresentationQueue {
  idleResolvers: Array<() => void>;
  isPresenting: boolean;
  jobs: PresentationJob[];
}

interface CreateForecastPresentationQueueServiceOptions {
  readyStatus: BlockStatus;
  isSessionActive: (session: ForecastDownloadSession) => boolean;
  presentAvailableBlock: (
    block: RemoteResource,
    buffer: Uint8Array,
    status: BlockStatus,
    session: ForecastDownloadSession,
  ) => Promise<void> | void;
  scheduleLowPriorityWork: () => Promise<void>;
}

export function createForecastPresentationQueueService({
  readyStatus,
  isSessionActive,
  presentAvailableBlock,
  scheduleLowPriorityWork,
}: CreateForecastPresentationQueueServiceOptions) {
  const queueBySession = new WeakMap<ForecastDownloadSession, PresentationQueue>();

  function queueForSession(session: ForecastDownloadSession) {
    let queue = queueBySession.get(session);

    if (!queue) {
      queue = {
        idleResolvers: [],
        isPresenting: false,
        jobs: [],
      };
      queueBySession.set(session, queue);
    }

    return queue;
  }

  function resolveIdle(queue: PresentationQueue) {
    const resolvers = queue.idleResolvers.splice(0);

    for (const resolve of resolvers) {
      resolve();
    }
  }

  async function drainQueue(session: ForecastDownloadSession, queue: PresentationQueue) {
    if (queue.isPresenting) {
      return;
    }

    queue.isPresenting = true;

    try {
      while (queue.jobs.length > 0) {
        const job = queue.jobs.shift();

        if (!job) {
          continue;
        }

        await scheduleLowPriorityWork();

        if (!isSessionActive(session)) {
          return;
        }

        await presentAvailableBlock(job.block, job.buffer, job.status, session);
      }
    } finally {
      queue.isPresenting = false;

      if (queue.jobs.length === 0) {
        resolveIdle(queue);
      }
    }
  }

  async function enqueueAvailableBlock(
    block: RemoteResource,
    buffer: Uint8Array,
    status: BlockStatus,
    session: ForecastDownloadSession,
  ) {
    if (status !== readyStatus) {
      await presentAvailableBlock(block, buffer, status, session);

      return;
    }

    const queue = queueForSession(session);
    queue.jobs.push({ block, buffer, status });
    await drainQueue(session, queue);
  }

  function waitForIdle(session: ForecastDownloadSession) {
    const queue = queueForSession(session);

    if (!queue.isPresenting && queue.jobs.length === 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      queue.idleResolvers.push(resolve);
    });
  }

  return {
    enqueueAvailableBlock,
    waitForIdle,
  };
}
