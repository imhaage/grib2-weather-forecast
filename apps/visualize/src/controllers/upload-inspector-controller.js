import { readFileAsArrayBuffer } from "../services/browser-file-reader-service.js";

export function createUploadInspectorController({
  centres,
  dom,
  formatRefTime,
  formatSize,
  iterateMessages,
  readFileAsArrayBuffer: readBuffer = readFileAsArrayBuffer,
  renderCard,
}) {
  let fileState = null;

  function setStatus(message, isError = false) {
    dom.status.textContent = message;
    dom.status.classList.toggle("error", isError);
  }

  function reset() {
    fileState = null;
    dom.summary.hidden = true;
    dom.results.hidden = true;
    dom.cards.replaceChildren();
    dom.status.textContent = "";
    dom.status.classList.remove("error");
  }

  async function processFile(file) {
    setStatus("Reading file…");
    try {
      const buffer = await readBuffer(file);
      const messages = [...iterateMessages(buffer)];
      if (messages.length === 0) {
        setStatus("No GRIB2 messages found.", true);
        return;
      }

      fileState = { messages };
      const first = messages[0];
      dom.name.textContent = file.name;
      dom.size.textContent = formatSize(file.size);
      dom.count.textContent = messages.length;
      dom.centre.textContent = centres[first.header.centre] ?? `Centre ${first.header.centre}`;
      dom.referenceTime.textContent = formatRefTime(first.header);
      dom.summary.hidden = false;
      dom.cards.replaceChildren(
        ...messages.map((message) => renderCard(dom.cards.ownerDocument, message)),
      );
      dom.results.hidden = false;
      setStatus("");
    } catch (error) {
      setStatus(`Error: ${error.message}`, true);
    }
  }

  function getSelectedMessage(route) {
    if (!fileState) return null;
    if (route.messageIndex != null) {
      return fileState.messages.find((message) => message.index === route.messageIndex) ?? null;
    }
    return (
      fileState.messages.find((message) => message.product.shortName === route.variableShortName) ??
      null
    );
  }

  return {
    getSelectedMessage,
    hasFile: () => Boolean(fileState),
    processFile,
    reset,
  };
}
