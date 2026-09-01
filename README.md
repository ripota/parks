# Rhode Island POTA parks data

`@ripota/parks` is the canonical, versioned catalog of Rhode Island Parks on the Air references and reviewed geospatial data used by [ripota.org](https://ripota.org/).

> [!IMPORTANT]
> Rhode Island POTA is an unofficial community project. [Official Parks on the Air resources](https://parksontheair.com/) remain the source of truth for current references, activation rules, accounts, spots, and logs.

The data are for general reference only. They are not legal boundary, property ownership, access, navigation, or surveying documents. A catalog record may contain a reviewed boundary, a derived activation zone, or a point fallback; those geometry kinds are intentionally distinct.

## Stable data contract

The `v1` contract uses `schemaVersion: 1` in combined artifacts and keeps these paths stable:

- `data/references.json` — normalized POTA reference metadata, sorted by reference.
- `data/manifest.json` — reviewed provenance and geometry status, sorted by reference.
- `data/boundaries/us-NNNN.geojson` — one lowercase, reference-addressable FeatureCollection per reference.
- `dist/catalog.json` — package-friendly references, provenance, and geometry for one static import.
- `dist/all.geojson` — every feature with `potaReference` and `geometryKind` properties.
- `dist/checksums.sha256` — SHA-256 checksums for every source and combined data file.

After installing a GitHub release tarball, Node ESM consumers can use JSON import attributes and resolve raw-text exports through the package map:

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

`catalog` and `catalogByName` are equivalent. `manifest` and `references` are structured JSON; `aggregate`, `checksums`, and `boundary` demonstrate the supported raw-file path for `.geojson` and checksum exports. Browsers and bundlers should fetch the equivalent file from a versioned tag URL rather than a mutable branch.

Raw tagged GitHub URLs are also stable, for example:

```text
https://raw.githubusercontent.com/ripota/parks/v1.0.0/data/boundaries/us-0513.geojson
```

The packaged draft-07 schemas are exported as `./schemas/catalog.schema.json` and `./schemas/geojson.schema.json`. Their stable `$id` URLs use `https://ripota.org/schemas/`; they validate portable data shapes, while `mise run check` additionally enforces ring closure, Rhode Island review bounds, reviewed source identity, inventory, and reproducibility.

Within schema version 1, patch releases are reviewed snapshot refreshes and minor releases may add backward-compatible fields or exports. Breaking field meanings, required fields, or stable paths require a new major release and schema version.

## Development

Install dependencies, validate the checked-in snapshot, and reproduce the distributable files entirely offline:

```sh
npm ci
mise run check
mise run package
```

`mise run update` is the only networked refresh path. It fetches current POTA references and reviewed RI DEM, USFWS, and NPS geometries, derives counties, validates the complete candidate snapshot, and writes only after all review gates pass. See [CONTRIBUTING.md](CONTRIBUTING.md) before running or reviewing an update.

Source provenance, redistribution findings, attribution, and limitations are documented in [DATA_SOURCES.md](DATA_SOURCES.md) and [DATA_LICENSE.md](DATA_LICENSE.md).
