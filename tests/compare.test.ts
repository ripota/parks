import { expect, it } from "vitest";
import { diffReferences } from "../src/compare.ts";
const record = {
  reference: "US-0001",
  name: "Park",
  latitude: 41,
  longitude: -71,
  grid: "FN41",
  locationDesc: "US-RI",
  counties: ["B", "A"],
};
it("normalizes identity coordinates and location without volatile comparisons", () => {
  const actual = {
    ...record,
    reference: "us-0001",
    latitude: "41.0",
    locationDesc: undefined,
    location: "US-RI",
    attempts: 99,
  };
  expect(diffReferences([record], [actual])).toEqual({
    added: [],
    missing: [],
    changed: [],
    duplicates: { expected: [], actual: [] },
    invalid: { expected: [], actual: [] },
  });
});
it("sorts inventory and fields and reports ambiguous and invalid inputs", () => {
  const result = diffReferences(
    [
      record,
      { ...record, reference: "US-0003" },
      { ...record, reference: "bad" },
    ],
    [
      { ...record, name: "New", grid: "FN42" },
      { ...record, reference: "US-0002" },
      { ...record, reference: "us-0002" },
    ],
  );
  expect(result.added).toEqual(["US-0002"]);
  expect(result.missing).toEqual(["US-0003"]);
  expect(result.duplicates.actual).toEqual(["US-0002"]);
  expect(result.invalid.expected).toEqual([2]);
  expect(Object.keys(result.changed[0].fields)).toEqual(["grid", "name"]);
  expect(result.changed[0].fields.name).toEqual({
    expected: "Park",
    actual: "New",
  });
  expect(
    diffReferences([record, record], [{ ...record, name: "new" }]).changed,
  ).toEqual([]);
});
it("defines whitespace, missing values, county order, and exact precision", () => {
  expect(
    diffReferences([record], [{ ...record, name: "Park " }]).changed,
  ).toHaveLength(1);
  expect(
    diffReferences([record], [{ ...record, latitude: 41.000000001 }]).changed,
  ).toHaveLength(1);
  expect(
    diffReferences([record], [{ ...record, counties: ["A", "B"] }], {
      fields: ["counties"],
    }).changed,
  ).toEqual([]);
  expect(record.counties).toEqual(["B", "A"]);
  expect(
    diffReferences(
      [{ reference: "US-0001", name: undefined }],
      [{ reference: "US-0001", name: null }],
    ).changed[0].fields.name,
  ).toEqual({ expected: undefined, actual: null });
  expect(
    diffReferences([record], [{ ...record, reference: " US-0001" }]).invalid
      .actual,
  ).toEqual([0]);
});

it("uses the artifact ID grammar and numeric zero equivalence", () => {
  expect(
    diffReferences(
      [{ reference: "US-1", latitude: 0 }],
      [{ reference: "us-1", latitude: "-0" }],
    ).changed,
  ).toEqual([]);
  expect(
    diffReferences([{ reference: "US-1" }], [{ reference: "US-1" }]).invalid
      .expected,
  ).toEqual([]);
});
