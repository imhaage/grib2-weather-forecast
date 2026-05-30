import { describe, expect, test } from "vitest";
import { resolveMapBackHash } from "./map-back-action.js";

describe("map back action", () => {
  test("returns to the forecast home route after viewing a forecast run", () => {
    expect(resolveMapBackHash({ hasModelState: true })).toBe("#forecast");
  });

  test("returns to the file inspector home route after viewing an uploaded field", () => {
    expect(resolveMapBackHash({ hasModelState: false })).toBe("#inspect");
  });
});
