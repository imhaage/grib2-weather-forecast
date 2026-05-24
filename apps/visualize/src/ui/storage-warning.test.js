import { describe, expect, test } from "vitest";

import { formatStorageEstimate } from "./storage-warning.js";

describe("storage warning", () => {
	test("formats browser origin storage usage and quota", () => {
		expect(
			formatStorageEstimate({ usage: 850_000_000, quota: 12_000_000_000 }),
		).toBe("850 MB used");
	});

	test("handles unavailable storage estimates", () => {
		expect(formatStorageEstimate(null)).toBe("Storage estimate unavailable");
		expect(formatStorageEstimate({})).toBe("Storage estimate unavailable");
	});
});
