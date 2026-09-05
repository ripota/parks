/** Pure inventory comparison. Invalid IDs are reported by input index. */
export type ReferenceInput = { readonly reference: string };
export type ReferenceDiffOptions<Field extends string = string> = {
  readonly fields?: readonly Field[];
};
export type ReferenceDiff = {
  added: string[];
  missing: string[];
  changed: Array<{
    reference: string;
    fields: Record<string, { expected: unknown; actual: unknown }>;
  }>;
  duplicates: { expected: string[]; actual: string[] };
  invalid: { expected: number[]; actual: number[] };
};
const defaults: readonly string[] = [
  "name",
  "latitude",
  "longitude",
  "grid",
  "locationDesc",
];

export function diffReferences<
  Expected extends ReferenceInput,
  Actual extends ReferenceInput,
>(
  expected: readonly Expected[],
  actual: readonly Actual[],
  options: ReferenceDiffOptions<
    Extract<keyof Expected | keyof Actual, string>
  > = {},
): ReferenceDiff {
  const diff: ReferenceDiff = {
    added: [],
    missing: [],
    changed: [],
    duplicates: { expected: [], actual: [] },
    invalid: { expected: [], actual: [] },
  };
  function index(
    records: readonly ReferenceInput[],
    side: "expected" | "actual",
  ): Map<string, ReferenceInput> {
    const result = new Map<string, ReferenceInput>();
    const duplicates = new Set<string>();
    records.forEach((record, offset) => {
      const id =
        typeof record?.reference === "string"
          ? record.reference.toUpperCase()
          : "";
      if (!/^US-\d+$/.test(id)) {
        diff.invalid[side].push(offset);
        return;
      }
      if (result.has(id)) duplicates.add(id);
      else result.set(id, record);
    });
    diff.duplicates[side] = [...duplicates].sort();
    return result;
  }
  function value(record: ReferenceInput, field: string): unknown {
    const input = record as unknown as Record<string, unknown>;
    let result = input[field];
    if (field === "locationDesc" && result === undefined)
      result = input.location;
    if (
      (field === "latitude" || field === "longitude") &&
      typeof result === "string" &&
      result.trim() !== "" &&
      Number.isFinite(Number(result))
    )
      result = Number(result);
    if (
      field === "counties" &&
      Array.isArray(result) &&
      result.every((item) => typeof item === "string")
    )
      result = [...result].sort();
    return result;
  }
  function equal(left: unknown, right: unknown): boolean {
    if (left === right || Object.is(left, right)) return true;
    if (Array.isArray(left) && Array.isArray(right))
      return (
        left.length === right.length &&
        left.every((item, i) => equal(item, right[i]))
      );
    if (
      left &&
      right &&
      typeof left === "object" &&
      typeof right === "object"
    ) {
      const a = Object.keys(left).sort(),
        b = Object.keys(right).sort();
      return (
        equal(a, b) &&
        a.every((key) =>
          equal(
            (left as Record<string, unknown>)[key],
            (right as Record<string, unknown>)[key],
          ),
        )
      );
    }
    return false;
  }
  const before = index(expected, "expected"),
    after = index(actual, "actual");
  const ambiguous = new Set([
    ...diff.duplicates.expected,
    ...diff.duplicates.actual,
  ]);
  const fields = [...new Set<string>(options.fields ?? defaults)].sort();
  diff.added = [...after.keys()].filter((id) => !before.has(id)).sort();
  diff.missing = [...before.keys()].filter((id) => !after.has(id)).sort();
  for (const id of [...before.keys()].sort()) {
    if (!after.has(id) || ambiguous.has(id)) continue;
    const changes: ReferenceDiff["changed"][number]["fields"] =
      Object.create(null);
    for (const field of fields) {
      const left = value(before.get(id)!, field),
        right = value(after.get(id)!, field);
      if (!equal(left, right))
        changes[field] = { expected: left, actual: right };
    }
    if (Object.keys(changes).length)
      diff.changed.push({ reference: id, fields: changes });
  }
  return diff;
}
