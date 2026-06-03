// apps/visualize/render-worker.js
// Pixel loop for heatmap rendering - runs in a Web Worker.
// Receives raw decoded values + unit transform + LUT + grid params.
// Returns an ImageBitmap plus field statistics (min/max/mean/count).
import { expose, transfer } from "comlink";
import { renderFieldToImageData } from "./src/workers/render-field-core.js";

async function render(data) {
  const { renderGeneration } = data;
  const { image, dataMin, dataMax, dataMean, dataCount } = renderFieldToImageData(data);
  const bitmap = await createImageBitmap(image);
  return transfer(
    {
      renderGeneration,
      bitmap,
      dataMin,
      dataMax,
      dataMean,
      dataCount,
    },
    [bitmap],
  );
}

expose({ render });
