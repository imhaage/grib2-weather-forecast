import { describe, expect, test } from "vitest";
import { createForecastResourceRefreshUseCase } from "./resource-refresh";

describe("forecast resource refresh use case", () => {
  test("creates active refresh keys tied to the current state generation", () => {
    const useCase = createForecastResourceRefreshUseCase();
    const state = {};

    const firstKey = useCase.begin(state);
    const secondKey = useCase.begin(state);

    expect(firstKey).toEqual({ state, refreshId: 1 });
    expect(secondKey).toEqual({ state, refreshId: 2 });
    expect(useCase.isActive(state, firstKey)).toBe(false);
    expect(useCase.isActive(state, secondKey)).toBe(true);
  });

  test("rejects missing, null, or foreign refresh keys", () => {
    const useCase = createForecastResourceRefreshUseCase();
    const state = {};
    const key = useCase.begin(state);

    expect(useCase.isActive(null, key)).toBe(false);
    expect(useCase.isActive(state, null)).toBe(false);
    expect(useCase.isActive({}, key)).toBe(false);
  });
});
