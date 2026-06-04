import { describe, expect, test } from "vitest";
import {
  formatForecastValidTimeLabel,
  formatModelPackageSubtitle,
  getModelPackageLabelParts,
} from "./forecast-package-labels.js";

const packages = {
  AROME_SP1: {
    model: "AROME",
  },
  UNKNOWN_MODEL_SP1: {
    model: "UNKNOWN",
  },
};

const modelInfo = {
  AROME: {
    title: "AROME 0.01",
  },
};

describe("forecast package labels", () => {
  test("formats package labels from model metadata and package key", () => {
    expect(getModelPackageLabelParts(packages, modelInfo, "AROME_SP1")).toEqual({
      modelTitle: "AROME 0.01",
      packageName: "SP1",
    });
    expect(formatModelPackageSubtitle(packages, modelInfo, "AROME_SP1")).toBe("AROME 0.01 SP1");
  });

  test("falls back to package and model keys when metadata is missing", () => {
    expect(formatModelPackageSubtitle(packages, modelInfo, "MISSING")).toBe("MISSING");
    expect(formatModelPackageSubtitle(packages, modelInfo, "UNKNOWN_MODEL_SP1")).toBe(
      "UNKNOWN MODEL_SP1",
    );
  });

  test("formats forecast valid time labels with optional package context", () => {
    expect(formatForecastValidTimeLabel(packages, modelInfo, null, "H+01")).toBe("H+01");
    expect(formatForecastValidTimeLabel(packages, modelInfo, "AROME_SP1", "H+01")).toBe(
      "AROME 0.01 - SP1 : H+01",
    );
    expect(formatForecastValidTimeLabel(packages, modelInfo, "MISSING", "H+01")).toBe(
      "MISSING : H+01",
    );
  });
});
