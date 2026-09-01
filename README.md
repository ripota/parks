# Rhode Island POTA parks data

`@ripota/parks` provides typed, lightweight Rhode Island Parks on the Air (POTA) reference metadata by default. Reviewed geometry, provenance, and raw artifacts remain available through explicit package subpaths.

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

## Choose raw or geometry artifacts

Geometry-bearing imports are deliberately explicit and can add several megabytes to an application bundle.

| Need                         | Package export                               |
| ---------------------------- | -------------------------------------------- |
| Raw reference metadata       | `@ripota/parks/references.json`              |
| Metadata plus geometry       | `@ripota/parks/catalog.json`                 |
| Map-ready aggregate          | `@ripota/parks/all.geojson`                  |
| One reviewed boundary        | `@ripota/parks/boundaries/us-NNNN.geojson`   |
| Provenance and review status | `@ripota/parks/manifest.json`                |
| Byte-integrity verification  | `@ripota/parks/checksums.sha256`             |
| Portable schemas             | `@ripota/parks/schemas/{catalog,geojson}...` |

Node ESM consumers use JSON import attributes for JSON exports. Non-JSON extensions resolve as files:

```js
import { readFile } from "node:fs/promises";

import { references } from "@ripota/parks";
import catalog from "@ripota/parks/catalog.json" with { type: "json" };
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
```

The package checks verify that `references` and `referencesJson` are identical and report minified and Brotli sizes for the root runtime and full catalog.

## Version and compatibility

Package API versions and artifact schema versions are independent:

- Package API v2 changes `@ripota/parks` from the v1 catalog JSON default export to the lightweight ESM `references` named export and public `PotaReference` type.
- To migrate v1 geometry consumers, change the old root JSON import to `@ripota/parks/catalog.json`; its shape is unchanged.
- `references.json`, `catalog.json`, `all.geojson`, `manifest.json`, boundaries, checksums, and schemas retain their existing paths and meanings.
- Catalog and GeoJSON artifacts remain at `schemaVersion: 1`. A package major does not by itself change data schemas.

Every geometry record labels its kind as `boundary`, `activation-zone`, or `point`. Draft-07 schemas use stable `$id` URLs under `https://ripota.org/schemas/`; repository checks enforce additional geometry, source-identity, inventory, and reproducibility gates.

## Install and maintain

Download and install the versioned `ripota-parks-<version>.tgz` from [GitHub Releases](https://github.com/ripota/parks/releases); this package is not published to the npm registry. Pin immutable releases or tags rather than `main` URLs.

Run `mise install`, `npm ci`, and `mise run check` from a clean checkout. Read [CONTRIBUTING.md](CONTRIBUTING.md) before refreshing data or preparing a release. Versioned provenance and limitations live in [DATA_SOURCES.md](DATA_SOURCES.md); redistribution responsibilities live in [DATA_LICENSE.md](DATA_LICENSE.md).
