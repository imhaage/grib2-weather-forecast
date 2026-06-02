import { createWorkerRpcClient } from "./worker-rpc-client.js";

export function createDownloadWorker() {
  return new Worker(new URL("./download-worker.js", import.meta.url), {
    type: "module",
  });
}

export function createDownloadWorkerClient() {
  let worker = null;

  function ensureWorker() {
    if (worker) return worker;
    worker = createDownloadWorker();
    return worker;
  }

  return createWorkerRpcClient({
    getWorker: ensureWorker,
    onError: (error) => console.error("download-worker error:", error),
  });
}
