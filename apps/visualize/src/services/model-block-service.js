import { createModelBlockWorkerClient } from "../workers/model-block-worker-client.js";

export function createModelBlockService() {
  const client = createModelBlockWorkerClient();

  return {
    async storeBlock(block, buffer) {
      const result = await client.post(
        {
          type: "storeBlock",
          blockKey: block.key,
          buffer,
        },
        [buffer.buffer],
      );
      return Boolean(result?.ok);
    },

    renderHour(request) {
      return client.post(request, [request.lut.buffer]);
    },

    decodeValues(request) {
      return client.post({
        ...request,
        type: "decodeValues",
      });
    },
  };
}
