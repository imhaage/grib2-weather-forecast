# Frontend Modernization Plan

This document tracks the progressive modernization of `apps/visualize`.

The goal is to reduce risk while moving the frontend to Vite, TypeScript, and Biome, then progressively extract a framework-agnostic core that can later be consumed by React, Vue, Svelte, or another UI layer without rewriting the data pipeline.

## Principles

- [x] Keep behavior identical unless an intentional UX change is explicitly decided.
- [x] Commit after every small task.
- [x] Keep `grib2-decoder` consumed through its package export.
- [ ] Keep heavy runtime objects out of shared UI state.
- [ ] Prefer pure modules by default.
- [ ] Use stateful services only for lifecycle or resource owners.
- [ ] Keep the core framework-agnostic and React-ready.
- [ ] Keep the vanilla UI as an adapter until a framework migration is justified.

## Target Architecture

The future frontend should separate:

- **Pure domain modules**: resource parsing, run freshness, variable metadata, palettes, scale calculations, formatting, selectors.
- **Stateful services**: workers, IndexedDB cache, download queue, animation bitmap cache, MapLibre renderer, event subscriptions.
- **Minimal typed store**: selected package, selected variable, palette, current hour, playback status, download summary, animation readiness.
- **UI adapter**: current vanilla DOM layer, later replaceable by React/Vue/Svelte.

The store must not own `ImageBitmap`, GRIB buffers, worker instances, MapLibre instances, or large mutable queues. Those stay inside services with explicit lifecycles.

## Phase 1 — Tooling Foundation

- [x] Add Vite to `apps/visualize`.
- [x] Add TypeScript config for `apps/visualize`.
- [x] Add Biome config scoped to `apps/visualize/src`.
- [x] Move the app entry into a Vite-compatible structure.
- [x] Replace CDN imports with npm dependencies.
- [x] Keep app behavior identical.
- [x] Update npm scripts.
- [x] Update Netlify/build output config.
- [x] Verify local dev, build, static tests, and decoder tests.

## Phase 2 — Source Layout Without Behavior Change

- [x] Create `apps/visualize/src`.
- [x] Move current app files with minimal code changes.
- [x] Keep workers working under Vite.
- [x] Choose and migrate one worker as the pilot pattern.
- [x] Keep legacy static tests during migration.

## Phase 3 — Typed Boundaries

- [x] Define core domain types: package, resource, block status, cache status, animation status.
- [x] Extract pure resource/run helpers.
- [x] Extract variable metadata and type boundaries.
- [x] Extract palette and scale helpers.
- [ ] Add Vitest for new pure modules.
- [ ] Keep regex tests until equivalent unit tests exist.

## Phase 4 — Headless Services

- [ ] Extract download/cache service.
- [ ] Extract model block service.
- [ ] Extract animation cache service.
- [ ] Extract worker client helpers.
- [ ] Extract map renderer lifecycle service.
- [ ] Keep UI vanilla as an adapter only.

## Phase 5 — Minimal Store

- [ ] Add a typed micro-store.
- [ ] Store only lightweight state: selected package, selected variable, palette, current hour, playback, download summary, animation readiness.
- [ ] Keep `ImageBitmap`, buffers, workers, and MapLibre outside the store.
- [ ] Connect the vanilla UI to store subscriptions.
- [ ] Document a future Jotai/React adapter path.

## Phase 6 — Cleanup And Stabilization

- [ ] Reduce `index.ts` to bootstrap and orchestration.
- [ ] Remove obsolete static regex tests when covered by Vitest.
- [ ] Update `docs/frontend.md`.
- [ ] Update `docs/mobile-performance.md` if architecture changes performance assumptions.
- [ ] Run full verification.

## First Milestone

- [x] Add this modernization document.
- [x] Add Vite and TypeScript dependencies/scripts without moving code.
- [x] Add Biome configuration limited to `apps/visualize/src`.
- [x] Create the Vite source structure.
- [x] Move the app entry while preserving behavior.
- [x] Move `maplibre-gl` and `chroma-js` from CDN imports to npm dependencies.
- [x] Adapt workers to the Vite pattern, starting with one pilot worker.
- [x] Adapt build and deploy configuration.
- [x] Verify and stabilize before starting architectural extraction.
