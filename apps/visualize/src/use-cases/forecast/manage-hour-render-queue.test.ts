import { describe, expect, test } from "vitest";
import { createForecastHourRenderQueueService } from "./manage-hour-render-queue";

describe("forecast hour render queue use case", () => {
  test("starts the first render immediately", () => {
    const service = createForecastHourRenderQueueService();

    expect(service.requestRender(1)).toEqual({ shouldRender: true });
    expect(service.completeRender()).toBeNull();
  });

  test("queues only the latest requested hour while rendering", () => {
    const service = createForecastHourRenderQueueService();

    expect(service.requestRender(1)).toEqual({ shouldRender: true });
    expect(service.requestRender(2)).toEqual({ shouldRender: false });
    expect(service.requestRender(3)).toEqual({ shouldRender: false });

    expect(service.completeRender()).toBe(3);
  });

  test("resets the render queue state", () => {
    const service = createForecastHourRenderQueueService();

    service.requestRender(1);
    service.requestRender(2);
    service.reset();

    expect(service.completeRender()).toBeNull();
    expect(service.requestRender(3)).toEqual({ shouldRender: true });
  });
});
