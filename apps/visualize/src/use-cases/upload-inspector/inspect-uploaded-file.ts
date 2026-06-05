import type {
  UploadInspectionEventHandler,
  UploadInspectorFile,
  UploadInspectorFileReaderPort,
  UploadInspectorFormatters,
  UploadInspectorMessageIteratorPort,
} from "./ports";

interface InspectUploadedFileOptions {
  file: UploadInspectorFile;
  centres: Record<number, string>;
  fileReader: UploadInspectorFileReaderPort;
  messageIterator: UploadInspectorMessageIteratorPort;
  formatters: UploadInspectorFormatters;
  emit: UploadInspectionEventHandler;
}

function errorFromUnknown(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function inspectUploadedFile({
  file,
  centres,
  fileReader,
  messageIterator,
  formatters,
  emit,
}: InspectUploadedFileOptions): Promise<void> {
  emit({ type: "reading" });

  try {
    const buffer = await fileReader.readAsArrayBuffer(file);
    const messages = [...messageIterator.iterateMessages(buffer)];
    if (messages.length === 0) {
      emit({ type: "empty" });
      return;
    }

    const first = messages[0];
    const centreCode = first.header.centre;
    emit({
      type: "ready",
      result: {
        file: {
          name: file.name,
          sizeLabel: formatters.formatFileSize(file.size),
        },
        summary: {
          messageCount: messages.length,
          centreLabel:
            centreCode == null ? "Unknown centre" : (centres[centreCode] ?? `Centre ${centreCode}`),
          referenceTimeLabel: formatters.formatReferenceTime(first.header),
        },
        messages,
      },
    });
  } catch (error) {
    emit({ type: "error", error: errorFromUnknown(error) });
  }
}
