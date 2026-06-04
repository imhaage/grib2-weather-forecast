import { describe, expect, test } from "vitest";
import { createForecastResourceRefreshService } from "./forecast-resource-refresh-service.js";

describe("forecast resource refresh service", () => {
  test("creates active refresh keys tied to the current state generation", () => {
    const service = createForecastResourceRefreshService();
    const state = {};

    const firstKey = service.begin(state);
    const secondKey = service.begin(state);

    expect(firstKey).toEqual({ state, refreshId: 1 });
    expect(secondKey).toEqual({ state, refreshId: 2 });
    expect(service.isActive(state, firstKey)).toBe(false);
    expect(service.isActive(state, secondKey)).toBe(true);
  });

  test("rejects missing, null, or foreign refresh keys", () => {
    const service = createForecastResourceRefreshService();
    const state = {};
    const key = service.begin(state);

    expect(service.isActive(null, key)).toBe(false);
    expect(service.isActive(state, null)).toBe(false);
    expect(service.isActive({}, key)).toBe(false);
  });
});
