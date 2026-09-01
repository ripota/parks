# Contributing and data maintenance

## Setup

Start on current `main` with no unrelated working-tree changes:

```sh
mise install
npm ci
mise run check
```

The initial offline check must pass before a data refresh.

## Maintenance commands

| Command            | Network | Tracked writes   | Purpose                                                                                            |
| ------------------ | ------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| `mise run check`   | No      | No               | Check formatting, types, tests, snapshot validity, packed consumption, and package reproducibility |
| `mise run test`    | No      | No               | Run offline data, failure-path, release-contract, and packaging tests                              |
| `mise run package` | No      | `dist/`          | Rebuild distributable artifacts from checked-in data                                               |
| `mise run update`  | Yes     | `data/`, `dist/` | Refresh the complete reviewed snapshot from upstream services                                      |

`mise run update` is the only networked snapshot path. Each request has at most three 15-second attempts with capped transient-failure delays. The updater stages and validates complete `data/` and `dist/` trees before swapping them; handled commit failures restore the prior trees.

## Sources of truth

| Path                           | Ownership                                                      |
| ------------------------------ | -------------------------------------------------------------- |
| `config/reviewed-sources.json` | Human-reviewed per-reference mappings, queries, and source IDs |
| `config/boundary-sources.ts`   | Human-reviewed service endpoints and shared derivation rules   |
| `schemas/`                     | Intentionally maintained public contracts                      |
| `data/`                        | Generated checked-in snapshot; do not hand-edit                |
| `dist/`                        | Generated package artifacts; rebuild with `mise run package`   |
| `src/`, `tests/`               | Updater, validation, packaging, release, and regression logic  |

Resolve blocked updates in reviewed configuration or pipeline code. Never make an update pass by weakening validation or patching `data/` or `dist/` directly.

## Refresh and review

1. Establish the clean, passing baseline above.
2. Run `mise run update`.
3. If it stops on coverage, query, feature-ID, geometry, or inventory changes, research the upstream change and update reviewed inputs deliberately. New reviewed boundary and point records require no placeholder files.
4. Rerun `mise run update` after the reviewed decision.
5. Review every generated diff using the checklist below.
6. Update [DATA_SOURCES.md](DATA_SOURCES.md) when facts, counts, source terms, limitations, transformations, or the review date change; keep evergreen rights policy in [DATA_LICENSE.md](DATA_LICENSE.md).
7. Run `mise run package` and `mise run check`.

Stale live boundary files are an error and must be removed only after explicit review. The candidate must contain exactly the files declared by its manifest.

### Generated-diff checklist

- [ ] Added, removed, or renamed POTA references are accounted for.
- [ ] Official names, coordinates, grids, and locations match the reviewed source.
- [ ] Source URLs, queries, feature IDs, and per-reference feature counts are expected.
- [ ] Geometry type, extent, obvious shape changes, and the 100-foot trail activation-zone derivation are correct.
- [ ] County assignments reflect geometry intersection, including boundary contact.
- [ ] Boundary inventory has no orphaned or unexpectedly missing files.
- [ ] Aggregate reference and feature counts are explained.
- [ ] Attribution, linked terms, limitations, snapshot version, and review date remain current.
- [ ] Rebuilt `dist/` files and byte-level SHA-256 checksums are deterministic.

## Failed refreshes

Do not bypass a reported gate. Inspect `git status` and the error, preserve unrelated work, correct the reviewed input or pipeline, and return to a passing baseline before rerunning. Do not use destructive reset commands. If rollback itself cannot complete, the updater preserves its reported `.update-*` recovery directory; stop and retain it for diagnosis.

## Release procedure

1. Decide the semantic version: patch for a reviewed snapshot refresh, minor for backward-compatible contract additions, major for breaking paths or schema changes.
2. Update `package.json`, regenerate package artifacts, and run `mise run check` from a clean checkout.
3. Verify `npm pack --dry-run` contains `data/`, `dist/`, and the attribution documents.
4. Land the signed commit on `main`, push `main`, and create the signed `vX.Y.Z` tag from that exact commit.
5. Build release assets from the tag. Attach `dist/catalog.json`, `dist/all.geojson`, `dist/checksums.sha256`, and the `npm pack` tarball to the GitHub release.
6. A consumer may update only after the tag and release assets are public and independently verified.

Geometry changes are never auto-released. CI validates proposed changes; a maintainer must review and publish them.
