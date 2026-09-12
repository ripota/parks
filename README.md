# Rhode Island POTA parks

`@ripota/parks` provides complete, typed visitor records for Rhode Island Parks on the Air references: park type, manager, amenities, access notes, activation advice, fluorescent-orange guidance, and source links.

## Use park records

```ts
import { parks, getPark, type Park } from "@ripota/parks";

const park: Park | undefined = getPark("US-0513");
const managementAreas = parks.filter(({ type }) => type === "management-area");
```

`getPark` trims whitespace and ignores case. Records and their nested collections are readonly in TypeScript. The root loads only park JSON; geometry is available separately.

Visitor information is best effort, with links to the relevant managers and rules. Empty amenities and omitted access notes mean undocumented, not unavailable. Orange guidance describes the season in words; it does not calculate today's requirements. Check the linked rules, current notices, and posted signs before visiting. Park type is a directory category, not a legal designation. These records do not grant access or activation permission.

## Use JSON without JavaScript

Download [parks.json for v4.1.0](https://github.com/ripota/parks/releases/download/v4.1.0/parks.json)
for the same complete records, with no package installation or JavaScript runtime.
It is a UTF-8 JSON array with one object per POTA reference. Pin the release URL
in static-site builds or download it alongside your site's other data files.

```python
import json
from urllib.request import urlopen

url = "https://github.com/ripota/parks/releases/download/v4.1.0/parks.json"
with urlopen(url) as response:
    parks = json.load(response)
park = next(park for park in parks if park["reference"] == "US-0513")
print(park["orange"]["details"])
```

The generated file is also checked in at `dist/parks.json` and included in the
package. Releases include its SHA-256 digest in `checksums.release.sha256`.

## Optional park photos

A park may have `heroImageId` and a short `summary`. Resolve the ID through
`@ripota/parks/images.json`; its `artifact` points to a checked-in WebP master
included in the release tarball. Photos carry individual credits, rights, source
links, dimensions, and checksums. Generate responsive sizes during your build.
Omitted heroes need no placeholder. See [image consumption](API.md#park-photos).

## Choose map and data exports

| Need                                    | Export                                          |
| --------------------------------------- | ----------------------------------------------- |
| Complete park records as JSON           | `@ripota/parks/parks.json`                      |
| Image metadata and provenance           | `@ripota/parks/images.json`                     |
| Versioned image binary                  | `@ripota/parks/images/<filename>.webp`          |
| Canonical POTA identity only            | `@ripota/parks/references.json`                 |
| Lightweight map points and bounds       | `@ripota/parks/display`                         |
| Identity and display geometry           | `@ripota/parks/catalog.json`                    |
| One detailed boundary                   | `@ripota/parks/boundaries/us-NNNN.geojson`      |
| Smaller map boundary                    | `@ripota/parks/boundaries-web/us-NNNN.geojson`  |
| Original normalized source features     | `@ripota/parks/source-features/us-NNNN.geojson` |
| Offline inventory comparison            | `@ripota/parks/compare`                         |
| Public types, including `PotaReference` | `@ripota/parks/types`                           |

Node ESM uses JSON import attributes; GeoJSON exports resolve as files:

```js
import { readFile } from "node:fs/promises";
import { parks, getPark } from "@ripota/parks";
import parkRecords from "@ripota/parks/parks.json" with { type: "json" };
import { getDisplayReference } from "@ripota/parks/display";

const park = getPark("us-0513");
const display = getDisplayReference(park.reference);
const boundary = JSON.parse(
  await readFile(new URL(import.meta.resolve(display.artifact)), "utf8"),
);
void [parks, parkRecords, boundary];
```

See [API contracts](API.md) for all geometry tiers, comparison behavior, and metadata field meanings. Geometry is for general reference and display; it does not establish legal boundaries, ownership, access, or activation eligibility. [Official POTA resources](https://parksontheair.com/) govern reference and activation rules.

## Install and maintain

Install the immutable `ripota-parks-4.1.0.tgz` asset from [GitHub Releases](https://github.com/ripota/parks/releases); the package is not published to npm.

Version 4 replaces root `references`/`getReference` with `parks`/`getPark`. Move raw identity types to `/types` and use `/references.json` where exact identity-only JSON is needed. Existing display, comparison, geometry, and schema-v2/v3 exports retain their contracts.

Maintain visitor records in `config/park-metadata.json`, then run `mise run package` and `mise run check`. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the separate snapshot-refresh and release workflows. Provenance lives in [DATA_SOURCES.md](DATA_SOURCES.md); redistribution responsibilities are in [DATA_LICENSE.md](DATA_LICENSE.md).
