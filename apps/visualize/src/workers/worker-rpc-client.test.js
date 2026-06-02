import { describe, expect, test, vi } from "vitest";
import { createWorkerRpcClient } from "./worker-rpc-client.js";

function createFakeWorker() {
  const listeners = new Map();
  const messages = [];

  function addListener(type, listener) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(listener);
  }

  function removeListener(type, listener) {
    const typeListeners = listeners.get(type);
    if (!typeListeners) return;
    typeListeners.delete(listener);
    if (typeListeners.size === 0) listeners.delete(type);
  }

  function emit(type, event) {
    for (const listener of [...(listeners.get(type) ?? [])]) {
      listener(event);
    }
  }

  return {
    listeners,
    messages,
    addEventListener: addListener,
    removeEventListener: removeListener,
    postMessage(message, transfer) {
      messages.push({ message, transfer });
    },
    emitMessage(data) {
      emit("message", { data });
    },
    emitError(error) {
      emit("error", error);
    },
  };
}

describe("worker RPC client", () => {
  test("adds callId and resolves matching response", async () => {
    const worker = createFakeWorker();
    const client = createWorkerRpcClient({ getWorker: () => worker });

    const resultPromise = client.post({ type: "decode" }, ["transferable"]);
    const sent = worker.messages[0];
    worker.emitMessage({ callId: sent.message.callId, ok: true });

    await expect(resultPromise).resolves.toEqual({ callId: 1, ok: true });
    expect(sent).toEqual({
      message: { type: "decode", callId: 1 },
      transfer: ["transferable"],
    });
  });

  test("ignores mismatched callId responses", async () => {
    const worker = createFakeWorker();
    const client = createWorkerRpcClient({ getWorker: () => worker });
    let resolved = false;

    const resultPromise = client.post({ type: "decode" }).then((result) => {
      resolved = true;
      return result;
    });

    worker.emitMessage({ callId: 999, ok: false });
    await Promise.resolve();
    expect(resolved).toBe(false);

    worker.emitMessage({ callId: 1, ok: true });
    await expect(resultPromise).resolves.toEqual({ callId: 1, ok: true });
  });

  test("maps worker data errors through onError and resolves null", async () => {
    const worker = createFakeWorker();
    const onError = vi.fn();
    const client = createWorkerRpcClient({ getWorker: () => worker, onError });

    const resultPromise = client.post({ type: "decode" });
    worker.emitMessage({ callId: 1, error: "Decode failed" });

    await expect(resultPromise).resolves.toBeNull();
    expect(onError).toHaveBeenCalledWith("Decode failed");
  });

  test("handles progress messages before final success", async () => {
    const worker = createFakeWorker();
    const onProgress = vi.fn();
    const client = createWorkerRpcClient({ getWorker: () => worker });
    let resolved = false;

    const resultPromise = client.post({ type: "download" }, [], { onProgress }).then((result) => {
      resolved = true;
      return result;
    });

    worker.emitMessage({ callId: 1, progress: true, loaded: 4, total: 10 });
    await Promise.resolve();

    expect(resolved).toBe(false);
    expect(onProgress).toHaveBeenCalledWith({
      callId: 1,
      progress: true,
      loaded: 4,
      total: 10,
    });

    worker.emitMessage({ callId: 1, buffer: new ArrayBuffer(1) });
    const result = await resultPromise;

    expect(result.callId).toBe(1);
    expect(result.buffer).toBeInstanceOf(ArrayBuffer);
  });

  test("cleans up listeners after success and error", async () => {
    const successWorker = createFakeWorker();
    const successClient = createWorkerRpcClient({ getWorker: () => successWorker });

    const successPromise = successClient.post({ type: "ok" });
    successWorker.emitMessage({ callId: 1, ok: true });
    await successPromise;

    expect(successWorker.listeners.has("message")).toBe(false);
    expect(successWorker.listeners.has("error")).toBe(false);

    const errorWorker = createFakeWorker();
    const errorClient = createWorkerRpcClient({ getWorker: () => errorWorker });

    const errorPromise = errorClient.post({ type: "fail" });
    errorWorker.emitError(new Error("Worker failed"));
    await errorPromise;

    expect(errorWorker.listeners.has("message")).toBe(false);
    expect(errorWorker.listeners.has("error")).toBe(false);
  });
});
