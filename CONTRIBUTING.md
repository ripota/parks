# Contributing and data maintenance

## Refresh and review

`mise run update` is the single networked generation pipeline. Normal validation and packaging are offline.

1. Start from a clean checkout and run `npm ci` and `mise run check`.
2. Run `mise run update`. It fetches the current `US-RI` list, applies only mappings in `config/reviewed-sources.json`, fetches geometry in EPSG:4326, builds the trail activation zone, derives counties, validates the complete candidate, and writes atomically. Each upstream request is limited to three attempts of at most 15 seconds, with capped delays for transient failures.
3. If the command reports a new/missing reference, empty query, or changed source feature IDs, stop. Research the upstream change and update the reviewed mapping deliberately. Do not weaken or remove the check.
4. Review every source-data diff, including names, coordinates, queries, IDs, geometry, counties, and feature counts. Confirm source attribution and terms remain current.
5. Run `mise run package` and `mise run check`. The package check must prove that committed distributable files reproduce byte-for-byte offline.

Orphan boundary files are an error and must be reviewed and removed explicitly. The updater never silently turns an unmatched reference into a boundary or deletes stale files.

## Release procedure

1. Decide the semantic version: patch for a reviewed snapshot refresh, minor for backward-compatible contract additions, major for breaking paths or schema changes.
2. Update `package.json`, regenerate package artifacts, and run `mise run check` from a clean checkout.
3. Verify `npm pack --dry-run` contains `data/`, `dist/`, and the attribution documents.
4. Land the signed commit on `main`, push `main`, and create the signed `vX.Y.Z` tag from that exact commit.
5. Build release assets from the tag. Attach `dist/catalog.json`, `dist/all.geojson`, `dist/checksums.sha256`, and the `npm pack` tarball to the GitHub release.
6. A consumer may update only after the tag and release assets are public and independently verified.

Geometry changes are never auto-released. CI validates proposed changes; a maintainer must review and publish them.
