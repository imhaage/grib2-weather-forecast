export function createForecastPresentationQueueService({
  readyStatus,
  isSessionActive,
  presentAvailableBlock,
  scheduleLowPriorityWork,
}) {
  const queueBySession = new WeakMap();

  function queueForSession(session) {
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

  function resolveIdle(queue) {
    const resolvers = queue.idleResolvers.splice(0);
    for (const resolve of resolvers) resolve();
  }

  async function drainQueue(session, queue) {
    if (queue.isPresenting) return;
    queue.isPresenting = true;
    try {
      while (queue.jobs.length > 0) {
        const job = queue.jobs.shift();
        await scheduleLowPriorityWork();
        if (!isSessionActive(session)) return;
        await presentAvailableBlock(job.block, job.buffer, job.status, session);
      }
    } finally {
      queue.isPresenting = false;
      if (queue.jobs.length === 0) resolveIdle(queue);
    }
  }

  async function enqueueAvailableBlock(block, buffer, status, session) {
    if (status !== readyStatus) {
      await presentAvailableBlock(block, buffer, status, session);
      return;
    }

    const queue = queueForSession(session);
    queue.jobs.push({ block, buffer, status });
    await drainQueue(session, queue);
  }

  function waitForIdle(session) {
    const queue = queueForSession(session);
    if (!queue.isPresenting && queue.jobs.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      queue.idleResolvers.push(resolve);
    });
  }

  return {
    enqueueAvailableBlock,
    waitForIdle,
  };
}
