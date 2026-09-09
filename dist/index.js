import parksJson from "../dist/parks.json" with { type: "json" };
/** Complete park records, generated offline from the accepted identity snapshot. */
export const parks = parksJson;
/** Trimmed, case-insensitive lookup; unknown or malformed IDs return undefined. */
export function getPark(reference) {
    const normalized = reference.trim().toUpperCase();
    return parks.find((park) => park.reference === normalized);
}
