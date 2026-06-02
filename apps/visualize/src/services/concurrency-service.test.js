import { describe, expect, test } from "vitest";
import { runWithConcurrency } from "./concurrency-service.js";

describe("runWithConcurrency", () => {
  test("preserves result order and passes item indexes to the worker", async () => {
    const calls = [];

    const results = await runWithConcurrency(["a", "b", "c"], 2, async (item, index) => {
      calls.push({ item, index });
      return item.toUpperCase();
    });

    expect(results).toEqual(["A", "B", "C"]);
    expect(calls).toEqual([
      { item: "a", index: 0 },
      { item: "b", index: 1 },
      { item: "c", index: 2 },
    ]);
  });

  test("never runs more than the requested number of workers at once", async () => {
    const releaseWorkers = [];
    let activeWorkerCount = 0;
    let maxActiveWorkerCount = 0;

    const resultsPromise = runWithConcurrency([1, 2, 3], 2, async (item) => {
      activeWorkerCount += 1;
      maxActiveWorkerCount = Math.max(maxActiveWorkerCount, activeWorkerCount);
      await new Promise((resolve) => releaseWorkers.push(resolve));
      activeWorkerCount -= 1;
      return item * 10;
    });

    await Promise.resolve();
    expect(releaseWorkers).toHaveLength(2);
    expect(maxActiveWorkerCount).toBe(2);

    releaseWorkers.shift()();
    await Promise.resolve();
    await Promise.resolve();
    expect(releaseWorkers).toHaveLength(2);
    expect(maxActiveWorkerCount).toBe(2);

    for (const releaseWorker of releaseWorkers.splice(0)) releaseWorker();
    await expect(resultsPromise).resolves.toEqual([10, 20, 30]);
  });
});
