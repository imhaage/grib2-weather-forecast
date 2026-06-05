export interface UploadInspectorFile {
  name: string;
  size: number;
}

export interface UploadInspectorMessage {
  index: number;
  header: {
    centre?: number;
    [key: string]: unknown;
  };
  product: {
    shortName: string;
    name?: string;
    units?: string;
    [key: string]: unknown;
  };
  grid?: unknown;
  [key: string]: unknown;
}

export interface UploadInspectionResult {
  file: {
    name: string;
    sizeLabel: string;
  };
  summary: {
    messageCount: number;
    centreLabel: string;
    referenceTimeLabel: string;
  };
  messages: UploadInspectorMessage[];
}

export type UploadInspectionEvent =
  | { type: "reading" }
  | { type: "empty" }
  | { type: "ready"; result: UploadInspectionResult }
  | { type: "error"; error: Error };

export interface UploadInspectorFileReaderPort {
  readAsArrayBuffer(file: UploadInspectorFile): Promise<ArrayBuffer>;
}

export interface UploadInspectorMessageIteratorPort {
  iterateMessages(buffer: ArrayBuffer): Iterable<UploadInspectorMessage>;
}

export interface UploadInspectorFormatters {
  formatFileSize(size: number): string;
  formatReferenceTime(header: UploadInspectorMessage["header"]): string;
}

export type UploadInspectionEventHandler = (event: UploadInspectionEvent) => void;
