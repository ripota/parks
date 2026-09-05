# Rhode Island POTA parks data

`@ripota/parks` provides typed, lightweight Rhode Island Parks on the Air (POTA) reference metadata by default. Display geometry and reviewed source features are available through explicit package subpaths.

> [!IMPORTANT]
> Rhode Island POTA is an unofficial community project. [Official POTA resources](https://parksontheair.com/) remain authoritative for current references and activation rules. These data are for general reference—not legal boundaries, property ownership, access, navigation, or surveying.

## Use reference metadata

The package root is the safe default for forms, validation, lists, browsers, and Workers. It loads only `references.json`; no catalog or GeoJSON data is reachable from its runtime graph.

```ts
import { references, type PotaReference } from "@ripota/parks";

const park: PotaReference | undefined = references.find(
  ({ reference }) => reference === "US-0513",
);
```

## Choose geometry artifacts

Geometry-bearing imports are deliberately explicit and can add several megabytes to an application bundle.

| Need                           | Package export                                  |
| ------------------------------ | ----------------------------------------------- |
| Reference metadata             | `@ripota/parks/references.json`                 |
| Metadata plus display geometry | `@ripota/parks/catalog.json`                    |
| Display aggregate              | `@ripota/parks/all.geojson`                     |
| One display boundary           | `@ripota/parks/boundaries/us-NNNN.geojson`      |
| Metadata plus source features  | `@ripota/parks/source-catalog.json`             |
| One source-feature collection  | `@ripota/parks/source-features/us-NNNN.geojson` |
| Review and derivation records  | `@ripota/parks/{manifest,derivations}.json`     |
| Portable schema-v2 contracts   | `@ripota/parks/schemas/v2/*.schema.json`        |

Node ESM consumers use JSON import attributes for JSON exports. Non-JSON extensions resolve as files:

```js
import { readFile } from "node:fs/promises";

import { references } from "@ripota/parks";
import catalog from "@ripota/parks/catalog.json" with { type: "json" };
import derivations from "@ripota/parks/derivations.json" with { type: "json" };
import manifest from "@ripota/parks/manifest.json" with { type: "json" };
import referencesJson from "@ripota/parks/references.json" with { type: "json" };

async function readExport(specifier) {
  return readFile(new URL(import.meta.resolve(specifier)), "utf8");
}

const aggregate = JSON.parse(await readExport("@ripota/parks/all.geojson"));
const checksums = await readExport("@ripota/parks/checksums.sha256");
const boundary = JSON.parse(
  await readExport("@ripota/parks/boundaries/us-0513.geojson"),
);
const sourceFeatures = JSON.parse(
  await readExport("@ripota/parks/source-features/us-0513.geojson"),
);
void catalog;
void derivations;
void manifest;
void referencesJson;
void aggregate;
void checksums;
void boundary;
void sourceFeatures;
```

The package checks verify that `references` and `referencesJson` are identical and report minified and Brotli sizes for the root runtime and full catalog.

## Version and compatibility

Package v3 introduces artifact schema v2. `catalog.json`, `all.geojson`, and `boundaries/*` now contain display geometry: touching and overlapping parcels are dissolved while genuine gaps, disconnected parcels, and interior holes remain. Normalized upstream features are explicit under the `source-*` exports; for the statewide trail, the source artifact retains the upstream route while the display artifact contains its derived activation zone.

The lightweight package root introduced in v2 is unchanged. Historical schema-v1 files remain packaged; new artifacts identify the versioned schema-v2 contracts through `$schema`.

Every geometry record labels its kind as `boundary`, `activation-zone`, or `point`. Draft-07 schemas use stable `$id` URLs under `https://ripota.org/schemas/`; repository checks enforce additional geometry, source-identity, inventory, and reproducibility gates.

## Install and maintain

Download and install the versioned `ripota-parks-<version>.tgz` from [GitHub Releases](https://github.com/ripota/parks/releases); this package is not published to the npm registry. Pin immutable releases or tags rather than `main` URLs.

Run `mise install`, `npm ci`, and `mise run check` from a clean checkout. Read [CONTRIBUTING.md](CONTRIBUTING.md) before refreshing data or preparing a release. Versioned provenance and limitations live in [DATA_SOURCES.md](DATA_SOURCES.md); redistribution responsibilities live in [DATA_LICENSE.md](DATA_LICENSE.md).

## Display metadata

Use `@ripota/parks/display` for reviewed map points, bounds, attribution, and
selective boundary exports without geometry payloads. Readonly types are exported
from `@ripota/parks/types`. See [API contracts and examples](API.md).
