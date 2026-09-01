# Rhode Island POTA parks data

`@ripota/parks` is the versioned catalog of Rhode Island Parks on the Air (POTA) references and reviewed geospatial data used by [ripota.org](https://ripota.org/).

> [!IMPORTANT]
> Rhode Island POTA is an unofficial community project. [Official POTA resources](https://parksontheair.com/) remain authoritative for current references and activation rules. These data are for general reference—not legal boundaries, property ownership, access, navigation, or surveying.

## Choose an artifact

| Need                         | Canonical artifact                |
| ---------------------------- | --------------------------------- |
| Reference metadata           | `data/references.json`            |
| Provenance and review status | `data/manifest.json`              |
| One reference                | `data/boundaries/us-NNNN.geojson` |
| Metadata plus geometry       | `dist/catalog.json`               |
| Map-ready aggregate          | `dist/all.geojson`                |
| Byte-integrity verification  | `dist/checksums.sha256`           |

## Get a version

Use the [latest release](https://github.com/ripota/parks/releases/latest) to discover versions, then pin a specific [release](https://github.com/ripota/parks/releases/tag/v1.0.0) or tag for reproducible use. The release tarball is an installable npm package but is distributed through GitHub Releases, not the npm registry; after downloading it, install the local `ripota-parks-<version>.tgz` file.

Individual files are also available from immutable tags, such as [`v1.0.0/data/boundaries/us-0513.geojson`](https://raw.githubusercontent.com/ripota/parks/v1.0.0/data/boundaries/us-0513.geojson). Avoid URLs from the mutable `main` branch.

## Use the data

After installing a release tarball, Node ESM consumers can use JSON import attributes and resolve raw-file exports through the package map:

```js
import { readFile } from "node:fs/promises";

import catalog from "@ripota/parks" with { type: "json" };
import catalogByName from "@ripota/parks/catalog.json" with { type: "json" };
import manifest from "@ripota/parks/manifest.json" with { type: "json" };
import references from "@ripota/parks/references.json" with { type: "json" };

async function readExport(specifier) {
  return readFile(new URL(import.meta.resolve(specifier)), "utf8");
}

const aggregate = JSON.parse(await readExport("@ripota/parks/all.geojson"));
const checksums = await readExport("@ripota/parks/checksums.sha256");
const boundary = JSON.parse(
  await readExport("@ripota/parks/boundaries/us-0513.geojson"),
);
```

`catalog` and `catalogByName` are equivalent. Browsers and bundlers can fetch the corresponding file from a tagged raw URL or bundle it from the unpacked tarball. The packed-consumer test runs the Node example unchanged on every supported Node version.

## Understand the contract

Every record labels its geometry kind:

- `boundary` — reviewed managing-agency geometry, not a legal boundary or access determination;
- `activation-zone` — a derived visualization of an activation rule, not source boundary data;
- `point` — an explicit coordinate fallback, not an area.

Combined artifacts use `schemaVersion: 1`. The v1 paths and field meanings are stable: patch releases refresh the reviewed snapshot, minor releases may add backward-compatible fields or exports, and breaking paths, required fields, or meanings require a new major release and schema version.

Draft-07 schemas are exported at `./schemas/catalog.schema.json` and `./schemas/geojson.schema.json`, with stable `$id` URLs under `https://ripota.org/schemas/`. They validate portable shapes; repository checks additionally enforce ring closure, Rhode Island review bounds, source identity, inventory, and reproducibility.

## Develop and maintain

Run `mise install`, `npm ci`, and `mise run check` from a clean checkout. Read [CONTRIBUTING.md](CONTRIBUTING.md) before refreshing data or preparing a release. Versioned provenance and limitations live in [DATA_SOURCES.md](DATA_SOURCES.md); evergreen redistribution responsibilities live in [DATA_LICENSE.md](DATA_LICENSE.md).
