import { createBrowserFileReaderAdapter } from "../adapters/upload-inspector/browser-file-reader-adapter";
import { inspectUploadedFile } from "../use-cases/upload-inspector/inspect-uploaded-file";

export function createUploadInspectorController({
  centres,
  dom,
  formatRefTime,
  formatSize,
  iterateMessages,
  fileReader = createBrowserFileReaderAdapter(),
  readFileAsArrayBuffer,
  renderCard,
}) {
  let fileState = null;
  const resolvedFileReader = readFileAsArrayBuffer
    ? { readAsArrayBuffer: readFileAsArrayBuffer }
    : fileReader;

  function setStatus(message, isError = false) {
    dom.status.textContent = message;
    dom.status.classList.toggle("error", isError);
  }

  function resetRenderedFile() {
    dom.summary.hidden = true;
    dom.results.hidden = true;
    dom.cards.replaceChildren();
  }

  function renderInspectionResult(result) {
    fileState = { messages: result.messages };
    dom.name.textContent = result.file.name;
    dom.size.textContent = result.file.sizeLabel;
    dom.count.textContent = result.summary.messageCount;
    dom.centre.textContent = result.summary.centreLabel;
    dom.referenceTime.textContent = result.summary.referenceTimeLabel;
    dom.summary.hidden = false;
    dom.cards.replaceChildren(
      ...result.messages.map((message) => renderCard(dom.cards.ownerDocument, message)),
    );
    dom.results.hidden = false;
    setStatus("");
  }

  function handleInspectionEvent(event) {
    switch (event.type) {
      case "reading":
        resetRenderedFile();
        setStatus("Reading file...");
        break;
      case "empty":
        fileState = null;
        setStatus("No GRIB2 messages found.", true);
        break;
      case "ready":
        renderInspectionResult(event.result);
        break;
      case "error":
        fileState = null;
        setStatus(`Error: ${event.error.message}`, true);
        break;
    }
  }

  function reset() {
    fileState = null;
    resetRenderedFile();
    dom.status.textContent = "";
    dom.status.classList.remove("error");
  }

  async function processFile(file) {
    await inspectUploadedFile({
      file,
      centres,
      fileReader: resolvedFileReader,
      messageIterator: { iterateMessages },
      formatters: {
        formatFileSize: formatSize,
        formatReferenceTime: formatRefTime,
      },
      emit: handleInspectionEvent,
    });
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
