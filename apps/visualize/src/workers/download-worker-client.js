export function createDownloadWorker() {
  return new Worker(new URL("./download-worker.js", import.meta.url), {
    type: "module",
  });
}
