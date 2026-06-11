import { createBrowserFileReaderAdapter } from "../adapters/upload-inspector/browser-file-reader-adapter";
import { inspectUploadedFile } from "../use-cases/upload-inspector/inspect-uploaded-file";
import type {
  UploadedFieldRoute,
  UploadInspectionEvent,
  UploadInspectionResult,
  UploadInspectorFile,
  UploadInspectorFileReaderPort,
  UploadInspectorMessage,
} from "../use-cases/upload-inspector/ports";
import { resolveUploadedMessage } from "../use-cases/upload-inspector/present-uploaded-field";

interface UploadInspectorDom {
  cards: HTMLElement;
  centre: HTMLElement;
  count: HTMLElement;
  name: HTMLElement;
  referenceTime: HTMLElement;
  results: HTMLElement;
  size: HTMLElement;
  status: HTMLElement;
  summary: HTMLElement;
}

export interface CreateUploadInspectorControllerOptions {
  centres: Record<number, string>;
  dom: UploadInspectorDom;
  fileReader?: UploadInspectorFileReaderPort;
  formatRefTime(header: UploadInspectorMessage["header"]): string;
  formatSize(size: number): string;
  iterateMessages(buffer: ArrayBuffer): Iterable<UploadInspectorMessage>;
  readFileAsArrayBuffer?(file: UploadInspectorFile): Promise<ArrayBuffer>;
  renderCard(document: Document, message: UploadInspectorMessage): Node;
}

export function createUploadInspectorController({
  centres,
  dom,
  formatRefTime,
  formatSize,
  iterateMessages,
  fileReader = createBrowserFileReaderAdapter(),
  readFileAsArrayBuffer,
  renderCard,
}: CreateUploadInspectorControllerOptions) {
  let fileState: { messages: UploadInspectorMessage[] } | null = null;
  const resolvedFileReader = readFileAsArrayBuffer
    ? { readAsArrayBuffer: readFileAsArrayBuffer }
    : fileReader;

  function setStatus(message: string, isError = false) {
    dom.status.textContent = message;
    dom.status.classList.toggle("error", isError);
  }

  function resetRenderedFile() {
    dom.summary.hidden = true;
    dom.results.hidden = true;
    dom.cards.replaceChildren();
  }

  function renderInspectionResult(result: UploadInspectionResult) {
    fileState = { messages: result.messages };
    dom.name.textContent = result.file.name;
    dom.size.textContent = result.file.sizeLabel;
    dom.count.textContent = String(result.summary.messageCount);
    dom.centre.textContent = result.summary.centreLabel;
    dom.referenceTime.textContent = result.summary.referenceTimeLabel;
    dom.summary.hidden = false;
    dom.cards.replaceChildren(
      ...result.messages.map((message) => renderCard(dom.cards.ownerDocument, message)),
    );
    dom.results.hidden = false;
    setStatus("");
  }

  function handleInspectionEvent(event: UploadInspectionEvent) {
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

  async function processFile(file: UploadInspectorFile) {
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

  function getSelectedMessage(route: UploadedFieldRoute) {
    if (!fileState) {
      return null;
    }

    return resolveUploadedMessage(fileState.messages, route);
  }

  return {
    getMessages: () => fileState?.messages ?? [],
    getSelectedMessage,
    hasFile: () => Boolean(fileState),
    processFile,
    reset,
  };
}
