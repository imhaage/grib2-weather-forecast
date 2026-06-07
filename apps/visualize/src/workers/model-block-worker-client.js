import * as Comlink from "comlink";

export function createModelBlockWorkerClient({
  comlink = Comlink,
  createWorker = () =>
    new Worker(new URL("../../model-block-worker.js", import.meta.url), {
      type: "module",
    }),
  onError = (error) => console.error("model-block-worker error:", error),
} = {}) {
  let worker = null;
  let remote = null;

  function ensureRemote() {
    if (remote) {
      return remote;
    }

    worker = createWorker();
    remote = comlink.wrap(worker);

    return remote;
  }

  async function callRemote(methodName, message, transferables = []) {
    try {
      const payload = transferables.length ? comlink.transfer(message, transferables) : message;

      return await ensureRemote()[methodName](payload);
    } catch (error) {
      onError(error);

      return null;
    }
  }

  return {
    post(message, transferables = []) {
      switch (message.type) {
        case "storeBlock":
          return callRemote("storeBlock", message, transferables);
        case "renderHour":
          return callRemote("renderHour", message, transferables);
        case "decodeValues":
          return callRemote("decodeValues", message, transferables);
        default:
          onError(new Error(`Unknown worker message: ${message.type}`));

          return Promise.resolve(null);
      }
    },
  };
}
