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
by one or more digits (the artifact ID contract). Invalid IDs are excluded and reported as zero-based
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

## Opt-in schema v3 and research-needed references

`@ripota/parks/v3/catalog.json`, `/v3/all.geojson`, `/v3/boundaries/*`, and
`/v3/derivations.json` include every accepted reference, including explicit
`status: "research-needed"`, `geometryKind: "point"` fallbacks. Their
`fidelity: "official-point-fallback"` and `provenance.kind:
"official-pota-coordinate"` identify an official coordinate, not a reviewed
boundary, access location, or activation area. Fallbacks have no `source` field.
Reviewed records instead carry `fidelity: "reviewed-display"` and retain source
IDs and provenance. A reviewed `point-only` record remains distinct from both a
fallback and a reviewed map-point override.

The lightweight root and display API include every reference; fallback display
artifacts explicitly point to `/v3/boundaries/*`. Existing v1/v2 schema files and
paths remain intact. Unversioned geometry catalogs continue to describe only
reviewed geometry; consumers requiring complete inventory with fallbacks must
opt into v3 and branch on status/fidelity before reading `source`. Changing the
default catalog to v3 would require a package major; this release does not do so.
The checked-in inventory has no research-needed entries; offline fixtures exercise
the feature without a live refresh. V3 derivations and all artifacts are included
in the tarball and checksums. Legacy derivations contain reviewed records only.

A maintainer must accept metadata in reviewed configuration, set research-needed
status with official POTA provenance, and run the ordinary update/review workflow.
No source query, feature ID, geometry kind, or legacy geometry path is permitted
for a research-needed mapping. Replacement requires reviewed source configuration
and all existing source-ID, geometry, county, inventory, and reproducibility gates.

## Opt-in web geometry

```ts
const webBoundary = import.meta
  .resolve("@ripota/parks/boundaries-web/us-2870.geojson");
const webAggregate = import.meta.resolve("@ripota/parks/all-web.geojson");
```

This explicit tier targets overview/detail maps around zooms 8–16 in Rhode Island;
use detailed `boundaries/*` for closer inspection. It is not legal, access,
property, survey, navigation, or activation-eligibility evidence. All detailed
and source coordinates remain unchanged by web generation.

[JSTS 2.12.1 TopologyPreservingSimplifier](https://github.com/bjornharrtell/jsts/blob/2.12.1/src/org/locationtech/jts/simplify/TopologyPreservingSimplifier.js)
uses a maximum tolerance of 0.00002 degrees (about 2.23 meters north/south and
1.67 meters east/west in Rhode Island). The angular distance metric is explicit;
this is a visualization tolerance, not a claim of survey accuracy. A deterministic
halving schedule lowers the tolerance when needed to keep absolute area change
at or below 0.5%. Validation requires valid closed rings and topology, unchanged
component/hole counts, valid coordinate ranges, and bounds within the tolerance.
No disconnected parcels or holes are removed. Point geometries are identity
operations. Activation zones, including US-4582, also retain their exact geometry
and original 100-foot buffer metadata; the web tier never reinterprets the rule.

Web artifacts use their own schema `web/v1`, `fidelity: "web"`, and an explicit
link to the detailed artifact. `web-derivations.json` records algorithm/engine
version, tolerance, coordinate/component/hole counts, areas, and SHA-256 hashes
of both exact input and output files. `web-measurements.json` records raw/gzip
bytes for every reference and the aggregate. Reported areas are rounded to
0.001 square meters to avoid platform-specific floating-point serialization;
geometry and the area gate retain full precision. Packaging deterministically rebuilds
and checks these measurements; the aggregate and US-2870 must each retain at
least a 30% gzip reduction. Root/display JavaScript imports no web geometry.

The measured aggregate drops from 728,254 to 239,496 gzip bytes (67.1%); US-2870
from 187,960 to 9,706 (94.8%). All 50 interior holes are retained. The largest
per-reference absolute area change is 0.439%. US-4582's unchanged coordinates
make its metadata-bearing web file slightly larger. The aggregate, derivations,
and measurements are public release assets; per-reference web files are in the
tarball, all covered by checksums. See `review/WEB_GEOMETRY.md` in the repository
for the visual review and representative measurements.
