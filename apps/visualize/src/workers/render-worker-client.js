import { createWorkerRpcClient } from "./worker-rpc-client.js";

export function createRenderWorker() {
  return new Worker(new URL("../../render-worker.js", import.meta.url), {
    type: "module",
  });
}

export function createRenderWorkerClient({ createWorker = createRenderWorker } = {}) {
  let worker = null;

  function ensureWorker() {
    if (worker) return worker;
    worker = createWorker();
    return worker;
  }

  const client = createWorkerRpcClient({
    getWorker: ensureWorker,
    onError: (error) => console.error("render-worker error:", error),
  });

  return {
    render(message, transfer = []) {
      return client.post(message, transfer);
    },
  };
}
