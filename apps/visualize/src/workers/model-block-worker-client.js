import { createWorkerRpcClient } from "./worker-rpc-client.js";

export function createModelBlockWorkerClient() {
  let worker = null;

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(new URL("../../model-block-worker.js", import.meta.url), {
      type: "module",
    });
    return worker;
  }

  return createWorkerRpcClient({
    getWorker: ensureWorker,
    onError: (error) => console.error("model-block-worker error:", error),
  });
}
