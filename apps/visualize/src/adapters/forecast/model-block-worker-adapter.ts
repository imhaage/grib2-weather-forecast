import type { RemoteResource } from "../../domain/forecast-types";
import { createModelBlockWorkerClient } from "../../workers/model-block-worker-client.js";
import type {
  ModelBlockDecodeValuesRequest,
  ModelBlockDecodeValuesResult,
  ModelBlockRenderRequest,
  ModelBlockRenderResult,
  ModelBlockWorkerRequest,
  ModelBlockWorkerResult,
} from "../../workers/model-block-worker-contracts";

interface ModelBlockWorkerClient {
  post: (
    message: ModelBlockWorkerRequest,
    transferables?: Transferable[],
  ) => Promise<ModelBlockWorkerResult | null>;
}

export function createModelBlockWorkerAdapter({
  createWorkerClient = createModelBlockWorkerClient,
}: {
  createWorkerClient?: () => ModelBlockWorkerClient;
} = {}) {
  const client = createWorkerClient();

  return {
    async storeBlock(block: RemoteResource, buffer: Uint8Array) {
      const result = await client.post(
        {
          type: "storeBlock",
          blockKey: block.key,
          buffer,
        },
        [buffer.buffer],
      );

      return result?.type === "storeBlockResult" && result.ok;
    },

    async renderHour(request: ModelBlockRenderRequest): Promise<ModelBlockRenderResult | null> {
      const result = await client.post(request, [request.lut.buffer]);

      return result?.type === "renderHourResult" ? result : null;
    },

    async decodeValues(
      request: ModelBlockRenderRequest,
    ): Promise<ModelBlockDecodeValuesResult | null> {
      const decodeRequest: ModelBlockDecodeValuesRequest = {
        ...request,
        type: "decodeValues",
      };
      const result = await client.post(decodeRequest);

      return result?.type === "decodeValuesResult" ? result : null;
    },
  };
}
