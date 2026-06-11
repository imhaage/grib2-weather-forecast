import type { ForecastRunState } from "../../domain/forecast-types";
import type { ForecastPrerenderQueuePort } from "./runtime-contracts";

export interface CreateForecastPrerenderQueueDrainServiceOptions {
  getCurrentRenderGeneration: () => number;
  getCurrentState: () => ForecastRunState | null;
  notifyDiagnostics: () => void;
  prerenderBlock: (blockKey: string) => Promise<void>;
  queue: ForecastPrerenderQueuePort;
}

export function createForecastPrerenderQueueDrainService({
  getCurrentRenderGeneration,
  getCurrentState,
  notifyDiagnostics,
  prerenderBlock,
  queue,
}: CreateForecastPrerenderQueueDrainServiceOptions) {
  async function drain() {
    if (!queue.beginDrain()) {
      return;
    }

    notifyDiagnostics();

    try {
      let job = queue.nextJob();

      while (job) {
        notifyDiagnostics();

        if (
          getCurrentState() === job.state &&
          getCurrentRenderGeneration() === job.renderGeneration
        ) {
          await prerenderBlock(job.blockKey);
        }

        queue.completeJob(job);
        notifyDiagnostics();
        job = queue.nextJob();
      }
    } finally {
      queue.endDrain();
      notifyDiagnostics();

      if (queue.queueLength > 0) {
        await drain();
      }
    }
  }

  return {
    drain,
  };
}
