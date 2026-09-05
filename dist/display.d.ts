import type { DatasetMetadata, DisplayReference } from "./public-types.js";
export type { DatasetMetadata, DisplayReference, DisplayPoint, GeometryKind, ReviewStatus } from "./public-types.js";
export declare const dataset: DatasetMetadata;
export declare const displayReferences: readonly DisplayReference[];
/** Unknown or malformed IDs return undefined; lookup is case-insensitive. */
export declare function getDisplayReference(reference: string): DisplayReference | undefined;
