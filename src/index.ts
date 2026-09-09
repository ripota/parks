import parksJson from "../dist/parks.json" with { type: "json" };
import type { Park } from "./public-types.js";

export type {
  Park,
  ParkType,
  ParkAmenity,
  OrangeGuidance,
} from "./public-types.js";

/** Complete park records, generated offline from the accepted identity snapshot. */
export const parks: readonly Park[] = parksJson as readonly Park[];

/** Trimmed, case-insensitive lookup; unknown or malformed IDs return undefined. */
export function getPark(reference: string): Park | undefined {
  const normalized = reference.trim().toUpperCase();
  return parks.find((park) => park.reference === normalized);
}
