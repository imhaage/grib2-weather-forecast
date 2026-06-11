import { describe, expect, test } from "vitest";
import type {
  DecodedField,
  GridDefinition,
  NumericFieldValues,
  ProductDefinition,
} from "./field-types";

describe("field type contracts", () => {
  test("represents decoded fields without browser rendering objects", () => {
    const grid = {
      ni: 2,
      nj: 2,
      dj: 1,
      latitudeOfFirstPoint: 2,
      longitudeOfFirstPoint: 0,
      latitudeOfLastPoint: 1,
      longitudeOfLastPoint: 1,
    } satisfies GridDefinition;
    const product = {
      shortName: "t",
      name: "Temperature",
      units: "K",
    } satisfies ProductDefinition;
    const values: NumericFieldValues = new Float32Array([1, 2, 3, 4]);
    const field = {
      values,
      grid,
      product,
      header: {},
    } satisfies DecodedField;

    expect(field.values).toHaveLength(4);
  });
});
