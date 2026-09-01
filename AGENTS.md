commit-message-default: auto

# Repository guidance

This repository publishes reviewed, versioned POTA metadata and GeoJSON; correctness and provenance outrank convenience.

- Use the Mise tasks. Run `mise run check` after changes and `mise run package` after data or packaging changes.
- Treat `config/` as human-reviewed source mappings and endpoints. `data/` and `dist/` are generated; never hand-edit them.
- `mise run update` is networked and rewrites the snapshot. Run it only when the user explicitly requests a refresh.
- Never weaken coverage, source-ID, geometry, inventory, orphan, or reproducibility gates to force an update through. Stop and report upstream changes that need review.
- Preserve schema-v1 paths and field meanings unless the task explicitly authorizes a breaking release.
- Do not tag, publish, or create a release without explicit authorization.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before snapshot or release work. Use [DATA_SOURCES.md](DATA_SOURCES.md) and [DATA_LICENSE.md](DATA_LICENSE.md) for provenance and rights context.

## Code Review Rules

Flag hand-edited generated data; bypassed validation; unreviewed source-ID, geometry, county, or feature-count changes; breaking stable paths or fields without a major schema/version decision; network dependencies added to offline checks or packaging; and release behavior without explicit authorization.

Safe path: update reviewed inputs or pipeline code, regenerate with Mise, and surface changes for review.
