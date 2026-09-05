import referencesJson from "../data/references.json" with { type: "json" };
export const references = referencesJson;
/** Case-insensitive lookup; unknown or malformed IDs return undefined. */
export function getReference(reference) {
    return references.find((record) => record.reference === reference.toUpperCase());
}
