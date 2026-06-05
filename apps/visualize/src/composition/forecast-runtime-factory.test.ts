import { describe, expect, test } from "vitest";
import { createForecastRuntimeFactory } from "./forecast-runtime-factory";

describe("forecast runtime factory composition", () => {
  test("exports the forecast runtime factory", () => {
    expect(createForecastRuntimeFactory).toEqual(expect.any(Function));
  });
});
