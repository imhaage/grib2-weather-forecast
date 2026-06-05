import { createModelBlockWorkerClient } from "../../workers/model-block-worker-client.js";

interface ModelBlock {
  key: string;
}

interface StoreBlockResult {
  ok?: boolean;
}

interface ModelBlockWorkerClient {
  post: (message: ModelBlockWorkerMessage, transferables?: Transferable[]) => Promise<unknown>;
}

interface ModelBlockWorkerMessage {
  [key: string]: unknown;
  type: string;
}

interface RenderHourRequest extends ModelBlockWorkerMessage {
  lut: Uint8Array;
}

interface DecodeValuesRequest extends ModelBlockWorkerMessage {
  type: string;
}

export function createModelBlockWorkerAdapter({
  createWorkerClient = createModelBlockWorkerClient,
}: {
  createWorkerClient?: () => ModelBlockWorkerClient;
} = {}) {
  const client = createWorkerClient();

  return {
    async storeBlock(block: ModelBlock, buffer: Uint8Array) {
      const result = (await client.post(
        {
          type: "storeBlock",
          blockKey: block.key,
          buffer,
        },
        [buffer.buffer],
      )) as StoreBlockResult | null;
      return Boolean(result?.ok);
    },

    renderHour(request: RenderHourRequest) {
      return client.post(request, [request.lut.buffer]);
    },

    decodeValues(request: DecodeValuesRequest) {
      return client.post({
        ...request,
        type: "decodeValues",
      });
    },
  };
}
