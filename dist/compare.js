const defaults = [
    "name",
    "latitude",
    "longitude",
    "grid",
    "locationDesc",
];
export function diffReferences(expected, actual, options = {}) {
    const diff = {
        added: [],
        missing: [],
        changed: [],
        duplicates: { expected: [], actual: [] },
        invalid: { expected: [], actual: [] },
    };
    function index(records, side) {
        const result = new Map();
        const duplicates = new Set();
        records.forEach((record, offset) => {
            const id = typeof record?.reference === "string"
                ? record.reference.toUpperCase()
                : "";
            if (!/^US-\d{4,}$/.test(id)) {
                diff.invalid[side].push(offset);
                return;
            }
            if (result.has(id))
                duplicates.add(id);
            else
                result.set(id, record);
        });
        diff.duplicates[side] = [...duplicates].sort();
        return result;
    }
    function value(record, field) {
        const input = record;
        let result = input[field];
        if (field === "locationDesc" && result === undefined)
            result = input.location;
        if ((field === "latitude" || field === "longitude") &&
            typeof result === "string" &&
            result.trim() !== "" &&
            Number.isFinite(Number(result)))
            result = Number(result);
        if (field === "counties" &&
            Array.isArray(result) &&
            result.every((item) => typeof item === "string"))
            result = [...result].sort();
        return result;
    }
    function equal(left, right) {
        if (Object.is(left, right))
            return true;
        if (Array.isArray(left) && Array.isArray(right))
            return (left.length === right.length &&
                left.every((item, i) => equal(item, right[i])));
        if (left &&
            right &&
            typeof left === "object" &&
            typeof right === "object") {
            const a = Object.keys(left).sort(), b = Object.keys(right).sort();
            return (equal(a, b) &&
                a.every((key) => equal(left[key], right[key])));
        }
        return false;
    }
    const before = index(expected, "expected"), after = index(actual, "actual");
    const ambiguous = new Set([
        ...diff.duplicates.expected,
        ...diff.duplicates.actual,
    ]);
    const fields = [...new Set(options.fields ?? defaults)].sort();
    diff.added = [...after.keys()].filter((id) => !before.has(id)).sort();
    diff.missing = [...before.keys()].filter((id) => !after.has(id)).sort();
    for (const id of [...before.keys()].sort()) {
        if (!after.has(id) || ambiguous.has(id))
            continue;
        const changes = Object.create(null);
        for (const field of fields) {
            const left = value(before.get(id), field), right = value(after.get(id), field);
            if (!equal(left, right))
                changes[field] = { expected: left, actual: right };
        }
        if (Object.keys(changes).length)
            diff.changed.push({ reference: id, fields: changes });
    }
    return diff;
}
