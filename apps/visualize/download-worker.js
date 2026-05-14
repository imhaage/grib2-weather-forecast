self.onmessage = async ({ data }) => {
  const { callId, url, filesize } = data;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      self.postMessage({
        callId,
        progress: true,
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

    self.postMessage({ callId, buffer: out.buffer }, [out.buffer]);
  } catch (error) {
    self.postMessage({ callId, error: error.message });
  }
};
