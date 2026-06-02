export async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  async function runNext() {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= items.length) return;
    results[index] = await worker(items[index], index);
    await runNext();
  }

  await Promise.all(Array.from({ length: workerCount }, runNext));
  return results;
}
