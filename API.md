# Consumer API contracts

## Complete park records

```ts
import {
  parks,
  getPark,
  type Park,
  type ParkType,
  type ParkAmenity,
  type OrangeGuidance,
} from "@ripota/parks";
import type { PotaReference } from "@ripota/parks/types";
const park = getPark("  us-0513  ");
```

`parks: readonly Park[]` contains every accepted reference in canonical order.
`getPark(reference: string): Park | undefined` trims whitespace, ignores case,
and returns undefined for unknown or malformed strings. Neither API fetches data.
`parks.json` exports identical records for JSON consumers. It is a UTF-8 JSON
array, with one object per accepted reference in canonical order, available as a
[standalone versioned download](https://github.com/ripota/parks/releases/download/v4.1.0/parks.json),
checked in at `dist/parks.json`, and exported at `@ripota/parks/parks.json`.
All fields below are the same in JSON and JavaScript. Pin a release URL for
reproducible builds; no authentication, package installation, or JS runtime is
needed. The release checksum manifest covers the standalone JSON too.

A `Park` retains all eight POTA identity fields (`reference`, `name`, `latitude`,
`longitude`, `grid`, `counties`, `locationDesc`, `potaUrl`) and adds:

| Field                   | Meaning                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                  | Directory category: park, beach, forest, management-area, wildlife-refuge, preserve, historic-site, trail, recreation-area, fishing-access, or campground. It is not a legal designation. |
| `manager`, `websiteUrl` | Human-readable manager and primary visitor-information link.                                                                                                                              |
| `amenities`             | Documented parking, restrooms, picnic-tables, shelter, drinking-water, boat-launch, and/or camping. Empty means undocumented; presence does not promise current availability.             |
| `access`                | Optional short `hours`, `parking`, `fees`, `pets`, and `accessibility` notes. Omitted means undocumented.                                                                                 |
| `activationNotes`       | Practical setup and location notes; these do not replace manager permission or POTA rules.                                                                                                |
| `orange`                | `status`, human-readable `season` (string or null), `details`, and `sourceUrl`.                                                                                                           |
| `heroImageId`           | Optional stable ID in the opt-in image registry; absence means there is no selected photo.                                                                                                |
| `summary`               | Optional original short description for a card or page introduction. Independent of photo availability.                                                                                   |
| `sources`               | Source URLs supporting the visitor metadata.                                                                                                                                              |

Orange `status` is `required`, `recommended`, `area-dependent`, or `not-required`
for non-hunting visitors under the circumstances in `season` and `details`.
`required` can be seasonal; `area-dependent` means the described location or
property scope matters. `not-required` is the current reviewed guidance for the
stated property and scope, not a promise about future rules. A null season means
no specific recurring season is recorded. Always present the details and link
alongside the status. This API has no date evaluator or live closure checks.
Metadata is best effort and may become stale; check the linked current rules.

All park fields and nested collections are readonly TypeScript contracts; runtime
objects are not frozen. Version 4 removes root `references`, `getReference`, and
`PotaReference`. The identity-only JSON remains `/references.json`, and its
`PotaReference` type remains available from `/types`. Consumers that persist an
identity-only projection should explicitly select those eight fields.

The root graph contains only its entry module and generated park JSON. Its
budgets are 150 kB minified and 25 kB Brotli. No geometry, network call, or
wall-clock timestamp enters that graph.

## Park photos

Added in package v4.1.0. Import the registry explicitly; the root does not load
photo records or image bytes. `ParkImage` and `ParkImageRegistry` are readonly
contracts exported from `@ripota/parks/types`. The registry has `schemaVersion: 1`
and `images: readonly ParkImage[]`; its closed schema is exported at
`@ripota/parks/schemas/park-images.schema.json`.

```js
import { getPark } from "@ripota/parks";
import registry from "@ripota/parks/images.json" with { type: "json" };

const park = getPark("US-0516");
const hero = park?.heroImageId
  ? registry.images.find(({ id }) => id === park.heroImageId)
  : undefined;
const master = hero ? new URL(import.meta.resolve(hero.artifact)) : undefined;
// Pass master to a build-time image pipeline; emit no photo element if absent.
```

`artifact` is a package export specifier, not a browser URL. Resolve it during
server-side or static-site builds, then copy or transform the file into your own
site assets. Serve those local outputs with width, height, alt text, and a visible
credit/source/license link. Preserve the supplied title in `caption` when present,
and disclose changes recorded in `transforms` plus any crop or processing you add.
Share-alike photo derivatives retain the corresponding photo license; see
[image rights](DATA_LICENSE.md#photographs).

| Field                                            | Meaning                                                                                                                                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                             | Stable photo identity referenced by `Park.heroImageId`.                                                                                                                                                     |
| `artifact`                                       | `@ripota/parks/images/<id>.<12-character-sha256>.webp`. The filename changes when bytes change.                                                                                                             |
| `width`, `height`, `bytes`, `sha256`, `mimeType` | Actual dimensions, byte length, full SHA-256 digest, and `image/webp` media type of the shipped master.                                                                                                     |
| `alt`, `caption`                                 | Required visual description; optional supplied title or descriptive caption.                                                                                                                                |
| `focalPoint`                                     | Optional normalized `{x, y}` from top-left, each between 0 and 1. A crop hint, not a required crop.                                                                                                         |
| `credit`                                         | Attribution to preserve with the displayed image.                                                                                                                                                           |
| `source`                                         | Source `pageUrl`, exact downloaded `imageUrl` and file `sha256`, and `retrievedAt` date. These URLs document provenance; do not hotlink them at runtime.                                                    |
| `rights`                                         | Reviewed `kind` (`public-domain`, `licensed`, or `permission`), human-readable `label`, evidence/license `url`, and `reviewedAt` date. This applies to the shipped image, separately from the code license. |
| `transforms`                                     | Recorded orientation, resizing, encoding, or other changes from the upstream original.                                                                                                                      |

Images are editorially selected web masters, normally up to 2400 pixels wide,
without enlargement or imposed crop. Native aspect ratios and smaller accepted
sources are preserved. A sufficiently large source-published rendition can be used; `source.imageUrl` and `source.sha256` identify the exact ingested file, and `transforms` records that choice. The tarball contains those masters, not camera originals
or precomputed thumbnails. Generate responsive variants appropriate to your
layout, respecting the actual dimensions and crop quality. Each park may omit
`heroImageId`; do not invent an image or reserve an empty photo box. `summary`
can exist independently. A registry may be empty.

Each release includes standalone `images.json`, alongside `parks.json`, and all
masters inside the same `ripota-parks-<version>.tgz`. Plain-file consumers extract
`package/assets/images/` and map an artifact's final filename there; they need no
Node runtime. `checksums.sha256` covers `dist/images.json` and each
`assets/images/<filename>`. `checksums.release.sha256` covers standalone
`images.json` and the tarball. Pin both JSON files and the tarball to the same
release; the standalone registry alone does not contain the image bytes.

## Lightweight display metadata and public types

```ts
import { dataset, getDisplayReference } from "@ripota/parks/display";
import type {
  Catalog,
  CatalogRecord,
  GeoJsonFeatureCollection,
} from "@ripota/parks/types";
const display = getDisplayReference("US-4582");
const boundaryUrl = display?.artifact && import.meta.resolve(display.artifact);
```

The display entrypoint contains reviewed map points, `[west, south, east, north]`
bounds, attribution, disclaimer, counts, and boundary exports. Official park
coordinates remain unchanged. `displayPoint.source` is `reviewed` for configured
overrides and `official` otherwise (the type reserves `point-on-surface`). Unlike
`getPark`, the existing `getDisplayReference` lookup does not trim whitespace.
It ignores case and returns undefined for unknown IDs. Collections are readonly;
the display payload budgets remain 30 kB minified / 8 kB Brotli. Geometry and
artifact schema versions remain unchanged by package v4.

## Offline inventory comparison

```ts
import { parks } from "@ripota/parks";
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
const diff = diffReferences(parks, current);
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

The measured aggregate drops from 728,316 to 239,496 gzip bytes (67.1%); US-2870
from 187,960 to 9,706 (94.8%). All 50 interior holes are retained. The largest
per-reference absolute area change is 0.439%. US-4582's unchanged coordinates
make its metadata-bearing web file slightly larger. The aggregate, derivations,
and measurements are public release assets; per-reference web files are in the
tarball, all covered by checksums. See `review/WEB_GEOMETRY.md` in the repository
for the visual review and representative measurements.
