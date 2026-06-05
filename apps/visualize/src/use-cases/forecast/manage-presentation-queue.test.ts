import { describe, expect, test, vi } from "vitest";
import { createForecastPresentationQueueService } from "./manage-presentation-queue";

describe("forecast presentation queue use case", () => {
  test("presents ready blocks sequentially through low-priority scheduling", async () => {
    const events: string[] = [];
    const service = createForecastPresentationQueueService({
      readyStatus: "ready",
      isSessionActive: () => true,
      presentAvailableBlock: vi.fn(async (block) => {
        events.push(`present:${block.key}`);
      }),
      scheduleLowPriorityWork: vi.fn(async () => {
        events.push("schedule");
      }),
    });
    const session = {};

    await service.enqueueAvailableBlock({ key: "01H" }, new Uint8Array([1]), "ready", session);
    await service.enqueueAvailableBlock({ key: "02H" }, new Uint8Array([2]), "ready", session);

    expect(events).toEqual(["schedule", "present:01H", "schedule", "present:02H"]);
  });

  test("presents non-ready blocks immediately without scheduling", async () => {
    const presentAvailableBlock = vi.fn();
    const scheduleLowPriorityWork = vi.fn();
    const service = createForecastPresentationQueueService({
      readyStatus: "ready",
      isSessionActive: () => true,
      presentAvailableBlock,
      scheduleLowPriorityWork,
    });
    const block = { key: "01H" };
    const buffer = new Uint8Array([1]);
    const session = {};

    await service.enqueueAvailableBlock(block, buffer, "loaded-from-cache", session);

    expect(scheduleLowPriorityWork).not.toHaveBeenCalled();
    expect(presentAvailableBlock).toHaveBeenCalledWith(block, buffer, "loaded-from-cache", session);
  });

  test("waits until queued presentation work is idle", async () => {
    let releaseSchedule: (() => void) | undefined;
    const service = createForecastPresentationQueueService({
      readyStatus: "ready",
      isSessionActive: () => true,
      presentAvailableBlock: vi.fn(),
      scheduleLowPriorityWork: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseSchedule = resolve;
          }),
      ),
    });
    const session = {};

    const enqueuePromise = service.enqueueAvailableBlock(
      { key: "01H" },
      new Uint8Array([1]),
      "ready",
      session,
    );
    const idlePromise = service.waitForIdle(session).then(() => "idle");
    await Promise.resolve();

    let idleResolved = false;
    idlePromise.then(() => {
      idleResolved = true;
    });
    await Promise.resolve();
    expect(idleResolved).toBe(false);

    releaseSchedule?.();
    await enqueuePromise;

    await expect(idlePromise).resolves.toBe("idle");
  });
});
