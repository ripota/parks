import type { Park } from "./public-types.js";
export type { Park, ParkType, ParkAmenity, OrangeGuidance, } from "./public-types.js";
/** Complete park records, generated offline from the accepted identity snapshot. */
export declare const parks: readonly Park[];
/** Trimmed, case-insensitive lookup; unknown or malformed IDs return undefined. */
export declare function getPark(reference: string): Park | undefined;
