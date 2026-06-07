import * as Comlink from "comlink";

export function createDownloadWorker() {
  return new Worker(new URL("./download-worker.js", import.meta.url), {
    type: "module",
  });
}

export function createDownloadWorkerClient({
  comlink = Comlink,
  createWorker = createDownloadWorker,
  onError = (error) => console.error("download-worker error:", error),
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
    async post({ url, filesize }, _transfer = [], { onProgress } = {}) {
      try {
        return await ensureRemote().download(
          url,
          filesize,
          onProgress ? comlink.proxy(onProgress) : null,
        );
      } catch (error) {
        onError(error);

        return null;
      }
    },
  };
}
