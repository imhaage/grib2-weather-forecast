import { describe, expect, test, vi } from "vitest";
import { createForecastPrerenderQueueDrainService } from "./drain-prerender-queue";

function createQueue(jobs: Array<{ blockKey: string; renderGeneration: number; state: object }>) {
  const queue = [...jobs];
  return {
    beginDrain: vi.fn(() => true),
    completeJob: vi.fn(),
    endDrain: vi.fn(),
    get queueLength() {
      return queue.length;
    },
    nextJob: vi.fn(() => queue.shift() ?? null),
  };
}

describe("forecast prerender queue drain use case", () => {
  test("drains queued jobs that still match the active state and render generation", async () => {
    const state = { id: "state" };
    const jobs = [
      { blockKey: "01H", renderGeneration: 1, state },
      { blockKey: "02H", renderGeneration: 1, state },
    ];
    const queue = createQueue(jobs);
    const notifyDiagnostics = vi.fn();
    const prerenderBlock = vi.fn(async () => {});
    const service = createForecastPrerenderQueueDrainService({
      getCurrentRenderGeneration: vi.fn(() => 1),
      getCurrentState: vi.fn(() => state),
      notifyDiagnostics,
      prerenderBlock,
      queue,
    });

    await service.drain();

    expect(prerenderBlock).toHaveBeenCalledWith("01H");
    expect(prerenderBlock).toHaveBeenCalledWith("02H");
    expect(queue.completeJob).toHaveBeenCalledTimes(2);
    expect(queue.endDrain).toHaveBeenCalled();
    expect(notifyDiagnostics).toHaveBeenCalled();
  });

  test("skips stale jobs", async () => {
    const activeState = { id: "active" };
    const queue = createQueue([{ blockKey: "01H", renderGeneration: 1, state: { id: "old" } }]);
    const prerenderBlock = vi.fn(async () => {});
    const service = createForecastPrerenderQueueDrainService({
      getCurrentRenderGeneration: vi.fn(() => 1),
      getCurrentState: vi.fn(() => activeState),
      notifyDiagnostics: vi.fn(),
      prerenderBlock,
      queue,
    });

    await service.drain();

    expect(prerenderBlock).not.toHaveBeenCalled();
    expect(queue.completeJob).toHaveBeenCalled();
  });

  test("does nothing when another drain is already running", async () => {
    const queue = createQueue([]);
    queue.beginDrain.mockReturnValue(false);
    const service = createForecastPrerenderQueueDrainService({
      getCurrentRenderGeneration: vi.fn(),
      getCurrentState: vi.fn(),
      notifyDiagnostics: vi.fn(),
      prerenderBlock: vi.fn(),
      queue,
    });

    await service.drain();

    expect(queue.nextJob).not.toHaveBeenCalled();
  });
});
