import { expose, transfer } from "comlink";

async function download(url, filesize, onProgress = null) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    loaded += value.length;
    await onProgress?.({
      loaded,
      total: filesize || loaded,
    });
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }

  return transfer({ buffer: out.buffer }, [out.buffer]);
}

expose({ download });
