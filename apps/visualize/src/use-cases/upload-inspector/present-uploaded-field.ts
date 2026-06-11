import type { DecodedField, UploadedMessage } from "../../domain/field-types";
import type {
  PresentUploadedFieldResult,
  UploadedFieldDecoderPort,
  UploadedFieldRenderParams,
  UploadedFieldRenderPort,
  UploadedFieldRoute,
} from "./ports";

export type { UploadedFieldRenderParams } from "./ports";

interface CreatePresentUploadedFieldUseCaseOptions {
  buildRenderParams(field: DecodedField): UploadedFieldRenderParams;
  decoder: UploadedFieldDecoderPort;
  getCurrentRenderGeneration(): number;
  render: UploadedFieldRenderPort;
}

interface PresentUploadedFieldRequest {
  messages: UploadedMessage[];
  route: UploadedFieldRoute;
  renderGeneration: number;
}

function resolveUploadedMessage(
  messages: UploadedMessage[],
  route: UploadedFieldRoute,
): UploadedMessage | null {
  if (route.messageIndex != null) {
    return messages.find((message) => message.index === route.messageIndex) ?? null;
  }

  if (route.variableShortName) {
    return (
      messages.find((message) => message.product.shortName === route.variableShortName) ?? null
    );
  }

  return null;
}

function errorFromUnknown(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

export function createPresentUploadedFieldUseCase({
  buildRenderParams,
  decoder,
  getCurrentRenderGeneration,
  render,
}: CreatePresentUploadedFieldUseCaseOptions) {
  async function present({
    messages,
    route,
    renderGeneration,
  }: PresentUploadedFieldRequest): Promise<PresentUploadedFieldResult> {
    const message = resolveUploadedMessage(messages, route);

    if (!message) {
      return { type: "not-found" };
    }

    let field: DecodedField;

    try {
      field = await decoder.decode(message.buffer);
    } catch (error) {
      return { type: "decode-failed", error: errorFromUnknown(error) };
    }

    const renderParams = buildRenderParams(field);
    const renderResult = await render.render({
      field,
      renderGeneration,
      renderParams,
    });

    if (!renderResult) {
      return { type: "render-failed" };
    }

    if (getCurrentRenderGeneration() !== renderGeneration) {
      return { type: "stale", renderResult };
    }

    return {
      type: "success",
      message,
      field,
      renderParams,
      renderResult,
    };
  }

  return {
    present,
  };
}
