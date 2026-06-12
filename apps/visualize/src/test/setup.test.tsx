import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

describe("test setup", () => {
  test("provides jsdom and Testing Library matchers", () => {
    render(<p>Ready</p>);

    expect(screen.getByText("Ready")).toBeVisible();
  });
});
