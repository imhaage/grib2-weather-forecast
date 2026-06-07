import * as Comlink from "comlink";

export function createRenderWorker() {
  return new Worker(new URL("../../render-worker.js", import.meta.url), {
    type: "module",
  });
}

export function createRenderWorkerClient({
  comlink = Comlink,
  createWorker = createRenderWorker,
  onError = (error) => console.error("render-worker error:", error),
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

  return {
    async render(message, transfer = []) {
      try {
        return await ensureRemote().render(comlink.transfer(message, transfer));
      } catch (error) {
        onError(error);

        return null;
      }
    },
  };
}
