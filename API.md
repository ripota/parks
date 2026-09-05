# Consumer API contracts

## Lightweight display metadata and public types

```ts
import { references, getReference } from "@ripota/parks";
import { dataset, getDisplayReference } from "@ripota/parks/display";
import type {
  Catalog,
  CatalogRecord,
  GeoJsonFeatureCollection,
} from "@ripota/parks/types";
const display = getDisplayReference("US-4582");
const boundaryUrl = display?.artifact && import.meta.resolve(display.artifact);
```

The display entrypoint contains presentation metadata only, including the reviewed
US-4582 override, standard `[west, south, east, north]` bounds, attribution,
disclaimer, counts, and the existing explicit boundary export. Each exported
display boundary and catalog geometry has matching `bbox`; coordinates remain
unchanged. `displayPoint.source` is `reviewed` for configured overrides and
`official` otherwise (the type reserves `point-on-surface` for future derivations).
Official root coordinates remain unchanged. Both lookup functions accept
case-insensitive IDs and return `undefined` for unknown/malformed IDs; whitespace
is not trimmed. No fetch occurs. Load a boundary deliberately using its export,
or keep using `catalog.json` for the complete detailed catalog.

New `/display` and `/types` collections and nested arrays are readonly. The
existing root `PotaReference` and `references` types remain mutable for source
compatibility. This is additive package API v3; artifact schema v2 remains intact.
Packaging reports minified/Brotli sizes; display budgets are 30 kB/8 kB and root
budgets remain 50 kB/20 kB. No wall-clock timestamp is generated.

## Offline inventory comparison

```ts
import { references } from "@ripota/parks";
import {
  diffReferences,
  type ReferenceInput,
  type ReferenceDiff,
  type ReferenceDiffOptions,
} from "@ripota/parks/compare";
// Fetching, validation of the response, and failure policy belong to the caller.
const response = await fetch("https://api.pota.app/location/parks/US-RI");
if (!response.ok) throw new Error(`POTA returned ${response.status}`);
const current = await response.json();
const diff = diffReferences(references, current);
if (
  diff.added.length ||
  diff.missing.length ||
  diff.changed.length ||
  diff.duplicates.expected.length ||
  diff.duplicates.actual.length ||
  diff.invalid.expected.length ||
  diff.invalid.actual.length
) {
  throw new Error(JSON.stringify(diff));
}
```

IDs are uppercased, with no whitespace trimming, and must match `US-` followed
by at least four digits. Invalid IDs are excluded and reported as zero-based
input indices. Duplicate normalized IDs are reported once, sorted; ambiguous
records are excluded from field comparison, but still participate in inventory
membership. Inputs are never mutated.

Default fields are `name`, `latitude`, `longitude`, `grid`, and `locationDesc`.
Use `{ fields: ["name", "counties"] }` to replace this list with typed keys from
either input; extend it by explicitly including the defaults. Volatile counters
and unknown fields are ignored unless selected. `locationDesc` falls back to
`location` only when undefined. Missing/undefined values are equal; null and empty
strings are distinct. Text whitespace and case are significant. Finite nonempty
numeric coordinate strings compare as numbers, with exact numeric precision and
no rounding. Selected counties are sorted but not deduplicated; other arrays
retain order. JSON objects compare structurally regardless of key order.
All reference lists and changed-field keys are sorted; invalid indices retain
input order. Expected/actual values contain these normalized values. The API
accepts JSON-like records and has no runtime imports, network, clock, filesystem,
catalog, or geometry dependencies.
