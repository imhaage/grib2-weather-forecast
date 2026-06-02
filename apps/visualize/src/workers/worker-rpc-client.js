export function createWorkerRpcClient({ getWorker, onError = () => {} }) {
  let nextCallId = 0;

  function post(message, transfer = [], options = {}) {
    const worker = getWorker();
    const callId = ++nextCallId;

    return new Promise((resolve) => {
      function cleanup() {
        worker.removeEventListener("message", onMsg);
        worker.removeEventListener("error", onErr);
      }

      function onMsg({ data }) {
        if (data.callId !== callId) return;
        if (data.progress) {
          options.onProgress?.(data);
          return;
        }
        cleanup();
        if (data.error) {
          onError(data.error);
          resolve(null);
          return;
        }
        resolve(data);
      }

      function onErr(error) {
        cleanup();
        onError(error);
        resolve(null);
      }

      worker.addEventListener("message", onMsg);
      worker.addEventListener("error", onErr);
      worker.postMessage({ ...message, callId }, transfer);
    });
  }

  return { post };
}
