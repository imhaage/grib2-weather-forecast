export function createModelBlockWorkerClient() {
  let worker = null;
  let nextCallId = 0;

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(new URL("../../model-block-worker.js", import.meta.url), {
      type: "module",
    });
    return worker;
  }

  function post(message, transfer = []) {
    const activeWorker = ensureWorker();
    const callId = ++nextCallId;
    return new Promise((resolve) => {
      function onMsg({ data }) {
        if (data.callId !== callId) return;
        activeWorker.removeEventListener("message", onMsg);
        activeWorker.removeEventListener("error", onErr);
        if (data.error) {
          console.error("model-block-worker error:", data.error);
          resolve(null);
          return;
        }
        resolve(data);
      }
      function onErr(error) {
        activeWorker.removeEventListener("message", onMsg);
        activeWorker.removeEventListener("error", onErr);
        console.error("model-block-worker crash:", error);
        resolve(null);
      }
      activeWorker.addEventListener("message", onMsg);
      activeWorker.addEventListener("error", onErr);
      activeWorker.postMessage({ ...message, callId }, transfer);
    });
  }

  return { post };
}
