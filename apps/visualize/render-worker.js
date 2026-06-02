// apps/visualize/render-worker.js
// Pixel loop for heatmap rendering — runs in a Web Worker.
// Receives raw decoded values + unit transform + LUT + grid params.
// Returns an ImageBitmap plus field statistics (min/max/mean/count).
import { renderFieldToImageData } from "./src/workers/render-field-core.js";

self.onmessage = async ({ data }) => {
  const { callId, gen } = data;

  try {
    const { image, dataMin, dataMax, dataMean, dataCount } =
      renderFieldToImageData(data);
    const bitmap = await createImageBitmap(image);
    self.postMessage(
      { callId, gen, bitmap, dataMin, dataMax, dataMean, dataCount },
      [bitmap],
    );
  } catch (e) {
    self.postMessage({ callId, gen, error: e.message });
  }
};
