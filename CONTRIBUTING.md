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

| Command                                                     | Network | Tracked writes     | Purpose                                                                                            |
| ----------------------------------------------------------- | ------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `mise run check`                                            | No      | No                 | Check formatting, types, tests, snapshot validity, packed consumption, and package reproducibility |
| `mise run test`                                             | No      | No                 | Run offline data, failure-path, release-contract, and packaging tests                              |
| `mise run package`                                          | No      | `dist/`            | Rebuild distributable artifacts from checked-in data                                               |
| `mise run update`                                           | Yes     | `data/`, `dist/`   | Refresh the complete reviewed snapshot from upstream services                                      |
| `mise run release-assets -- build --directory <dir>`        | No      | Selected directory | Rehearse the canonical release build without publishing                                            |
| `mise run release-assets -- verify <tag> --directory <dir>` | Yes     | No                 | Compare a public release with a local canonical build                                              |

`mise run update` is the only networked snapshot path. Each request has at most three 15-second attempts with capped transient-failure delays. The updater stages and validates complete `data/` and `dist/` trees before swapping them; handled commit failures restore the prior trees.

## Sources of truth

| Path                              | Ownership                                                                  |
| --------------------------------- | -------------------------------------------------------------------------- |
| `config/reviewed-sources.json`    | Human-reviewed per-reference mappings, queries, and source IDs             |
| `config/map-point-overrides.json` | Explicit display-point exceptions when official coordinates are unsuitable |
| `config/boundary-sources.ts`      | Human-reviewed service endpoints and shared derivation rules               |
| `schemas/`                        | Intentionally maintained public contracts                                  |
| `data/`                           | Generated display, source-feature, and derivation snapshot                 |
| `dist/`                           | Generated package artifacts; rebuild with `mise run package`               |
| `src/`, `tests/`                  | Updater, validation, packaging, release, and regression logic              |

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
- [ ] Source geometry type, extent, properties, IDs, and feature counts are expected.
- [ ] Display unions retain expected components and holes without bridging gaps; the trail retains its reviewed 100-foot activation-zone derivation.
- [ ] County assignments reflect geometry intersection, including boundary contact.
- [ ] Display and source-feature inventories have no orphaned or unexpectedly missing files.
- [ ] Aggregate reference and feature counts are explained.
- [ ] Attribution, linked terms, limitations, snapshot version, and review date remain current.
- [ ] Rebuilt `dist/` files and byte-level SHA-256 checksums are deterministic.

## Failed refreshes

Do not bypass a reported gate. Inspect `git status` and the error, preserve unrelated work, correct the reviewed input or pipeline, and return to a passing baseline before rerunning. Do not use destructive reset commands. If rollback itself cannot complete, the updater preserves its reported `.update-*` recovery directory; stop and retain it for diagnosis.

## Release procedure

[`src/release.ts`](src/release.ts) is the executable source of truth for asset construction, required filenames, publication state, and digest comparison. The [tag workflow](.github/workflows/release.yml) invokes it; the `release-assets` Mise task exposes safe local build and verification commands.

The contract includes display and source-feature catalogs and aggregates, the data checksum manifest, npm tarball, and required `checksums.release.sha256` digest manifest. Per-reference source features and derivation metadata remain available inside the tarball and tagged repository. The tarball is a GitHub release artifact; this project does not publish to the npm registry.

### Prepare and rehearse

1. Start on current `main` with no unrelated changes and a passing `mise run check`.
2. Choose the package API version: patch for a reviewed snapshot refresh, minor for backward-compatible fields or exports, and major for breaking package exports, paths, types, or meanings. Version artifact schemas separately when their fields or meanings change; a package major alone does not change `schemaVersion`.
3. Keep both package files synchronized:

   ```sh
   npm version <version> --no-git-tag-version
   ```

4. Rebuild and validate, including the installed-tarball consumer test:

   ```sh
   mise run package
   mise run check
   ```

5. Rehearse the exact asset build in a new temporary directory and verify its digests:

   ```sh
   release_assets_dir="$(mktemp -d)"
   mise run release-assets -- build --directory "$release_assets_dir"
   (cd "$release_assets_dir" && shasum -a 256 -c checksums.release.sha256)
   ```

### Publish and verify

1. Land the reviewed signed release commit on `main`, push it, and wait for CI to pass.
2. From that exact commit, create and push the signed matching tag with the maintainer's configured signing backend:

   ```sh
   release_tag="v$(node -p "require('./package.json').version")"
   git tag -s "$release_tag"
   git push origin "$release_tag"
   ```

3. The tag workflow rebuilds the canonical assets, creates the public release, then downloads and digest-compares every published asset.
4. Verify the Actions run and public release URL before announcing or consuming it. Stable version tags require a published, non-draft, non-prerelease release.

Tagging and publishing are explicit external actions, never part of ordinary validation. This repository supports stable releases only. Do not upload assets manually or run `npm publish`.

### Failures and reruns

Inspect the failed Actions step first. A rerun is safe only for the unchanged tag: an existing public release succeeds when every required asset is byte-identical. Drafts, prereleases, missing assets, and same-name content mismatches fail with specific filenames and are never overwritten. Diagnose mismatches explicitly; do not replace immutable published assets silently. From the exact tagged checkout, the local `verify` command above can compare a rehearsed build with the public release.

Geometry changes are never auto-released. CI validates proposed changes; a maintainer must review and publish them.

### Additive display tiers

Package API v3.1 adds readonly `/types`, lightweight `/display`, pure `/compare`,
opt-in `/v3/*` fallback contracts, and `boundaries-web/*`/`all-web.geojson`.
Unversioned detailed/source contracts remain schema v2; web has a separate
`web/v1` schema. Web aggregate, derivations, and measurements are required release
assets. Canonical source data remains unchanged by offline packaging. Review web
maps for US-2870, US-6979 (including holes), US-6992, US-0513, and US-4582 before
release. Compare sizes and derivation hashes; never relax topology or size gates
to force a release. A research-needed record requires explicitly accepted metadata
and configuration, then the ordinary update workflow; it is not automatic inventory
acceptance. Such records only enter the opt-in v3 geometry inventory.
