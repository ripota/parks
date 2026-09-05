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
