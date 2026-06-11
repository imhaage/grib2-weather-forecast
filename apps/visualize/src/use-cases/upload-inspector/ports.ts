import type {
  DecodedField,
  GridDefinition,
  MessageHeader,
  ProductDefinition,
  StaticScale,
  UnitTransformKey,
  UploadedMessage,
} from "../../domain/field-types";

export interface UploadInspectorFile {
  name: string;
  size: number;
}

export type UploadInspectorMessage = UploadedMessage;

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

export interface UploadedFieldRoute {
  messageIndex?: number | null;
  variableShortName?: string | null;
}

export interface UploadedFieldRenderParams {
  values: Float32Array;
  grid: GridDefinition;
  product: ProductDefinition;
  header: MessageHeader;
  unitTransform: UnitTransformKey;
  staticScale: StaticScale | null;
  renderMin: number;
  renderMax: number;
  range: number;
  isLog: boolean;
  logDenom: number;
  zeroThreshold: number;
  displayUnits: string | null;
  isFallback: boolean;
}

export interface UploadedFieldRenderRequest {
  field: DecodedField;
  renderGeneration: number;
  renderParams: UploadedFieldRenderParams;
}

export interface UploadedFieldRenderResult {
  bitmap: {
    close(): void;
  };
  dataMin: number;
  dataMax: number;
  mean: number;
  count: number;
}

export interface UploadedFieldDecoderPort {
  decode(buffer: Uint8Array): Promise<DecodedField>;
}

export interface UploadedFieldRenderPort {
  render(request: UploadedFieldRenderRequest): Promise<UploadedFieldRenderResult | null>;
}

export type PresentUploadedFieldResult =
  | { type: "not-found" }
  | { type: "decode-failed"; error: Error }
  | { type: "render-failed" }
  | { type: "stale"; renderResult: UploadedFieldRenderResult }
  | {
      type: "success";
      message: UploadedMessage;
      field: DecodedField;
      renderParams: UploadedFieldRenderParams;
      renderResult: UploadedFieldRenderResult;
    };
