# Visualize Architecture Migration Todo

This document tracks the progressive migration of `apps/visualize` toward the simple hexagonal architecture described in:

- `docs/superpowers/specs/2026-06-05-visualize-simple-hexagonal-architecture-design.md`

Keep this list practical. Move items between sections as decisions are made and commits land.

## Done

- Document the target architecture in `AGENTS.md`.
- Write the simple hexagonal architecture design spec.
- Create the first `use-cases/` and `adapters/` slice with upload inspector.
- Move browser file reading from `services/` to `adapters/upload-inspector/`.
- Add strict TypeScript ports for `use-cases/upload-inspector/`.
- Keep the upload inspector controller public API stable.
- Create the first forecast use-case boundary with animation cache build.
- Add minimal strict TypeScript ports for `use-cases/forecast/`.

## Next

- Identify the next forecast workflow that can migrate without touching the whole runtime factory.
- Expand `use-cases/forecast/ports.ts` only with ports needed by that next workflow.
- Move one cohesive forecast integration from `services/` to `adapters/forecast/` when a concrete external dependency is involved.
- Keep `forecast-run-controller.js` and existing public behavior stable during the migration.

## Backlog

- Progressively shrink `forecast-runtime-factory.js` toward a composition root.
- Split forecast adapters by feature capability without creating feature-level junk drawers.
- Move MapLibre-specific code behind forecast map ports.
- Move browser storage/cache integrations behind forecast cache ports.
- Move HTTP/data.gouv integrations behind forecast resource ports.
- Move worker-backed integrations behind forecast worker or rendering ports.
- Convert migrated `services/` files to strict TypeScript as they move.
- Remove `services/` once all remaining files have a clear target layer.
- Review `BLOCK_STATUS` ownership so application code does not import status constants from UI modules.
- Decide whether some passive UI views should later be grouped by feature.

## Questions

- Which forecast workflow should be migrated next: resource loading, resource refresh, map presentation, or variable selection?
- Which forecast ports are stable enough to name now, and which should emerge only during extraction?
- Should composition live in a dedicated `composition/` folder later, or remain in the current factory until the migration is further along?

## Do Not Do Yet

- Do not migrate all JavaScript files to TypeScript in one large diff.
- Do not move `ui/` files by feature during the first architecture pass.
- Do not create ports for pure domain functions.
- Do not create adapters that simply mirror one implementation without adding a meaningful boundary.
- Do not replace existing working forecast behavior while moving files.
