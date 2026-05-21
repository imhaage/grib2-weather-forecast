import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(resolve(__dirname, "../../style.css"), "utf8");

describe("style contracts", () => {
  test("data status counts use semantic status colors", () => {
    expect(css).toMatch(/\.data-status-count\.ready \{\s*color: var\(--color-success\);/);
    expect(css).toMatch(/\.data-status-count\.loaded-from-cache \{\s*color: var\(--color-cache\);/);
    expect(css).toMatch(/\.data-status-count\.downloading \{\s*color: var\(--color-progress\);/);
    expect(css).toMatch(/\.data-status-count\.missing \{\s*color: var\(--color-error\);/);
  });

  test("cache download items use the shared cache color variable", () => {
    expect(css).toMatch(
      /\.forecast-dl-item \{[\s\S]*&\.loaded-from-cache \{\s*background: var\(--color-cache\);/,
    );
    expect(css).not.toMatch(/\.forecast-dl-item \{[\s\S]*&\.loaded-from-cache \{[\s\S]*#7c3aed/);
  });
});
