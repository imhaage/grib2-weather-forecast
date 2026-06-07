# Forecast Animation Cache Use Case Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the forecast animation cache build workflow from transitional `services/` into a strict TypeScript use-case boundary.

**Architecture:** Create `use-cases/forecast/ports.ts` with only the animation-cache build ports needed now. Move `forecast-animation-cache-build-service.js` to `use-cases/forecast/build-animation-cache.ts`, keep the factory behavior stable, and remove the old service file.

**Tech Stack:** TypeScript strict boundaries, Vitest, existing forecast runtime factory.

---

## File Structure

- Create: `apps/visualize/src/use-cases/forecast/ports.ts`
  - Defines `ForecastAnimationCacheState`, `ForecastRefreshSession`, and `ForecastAnimationCacheBuildPorts`.

- Create: `apps/visualize/src/use-cases/forecast/build-animation-cache.ts`
  - Exposes `createForecastAnimationCacheBuildUseCase`.
  - Preserves the existing `buildAfterNetworkSettles(session)` behavior.

- Create: `apps/visualize/src/use-cases/forecast/build-animation-cache.test.ts`
  - Ports the existing behavior tests to the new use-case path.

- Modify: `apps/visualize/src/services/forecast-runtime-factory.js`
  - Import `createForecastAnimationCacheBuildUseCase` from the new use-case.
  - Keep the local variable name stable where possible.

- Delete: `apps/visualize/src/services/forecast-animation-cache-build-service.js`
- Delete: `apps/visualize/src/services/forecast-animation-cache-build-service.test.js`

## DRY and Boundary Notes Before Editing

There is no meaningful duplicated logic in the existing animation cache build service. The improvement is architectural placement and explicit typing.

Do not create adapters for this slice yet: all dependencies are already injected callbacks. The first forecast ports should stay minimal and grow only when another extracted use case needs them.

---

### Task 1: Move the Animation Cache Build Workflow

- [ ] Write a failing test at `apps/visualize/src/use-cases/forecast/build-animation-cache.test.ts` importing the future use-case.
- [ ] Verify the test fails because the module does not exist.
- [ ] Add `apps/visualize/src/use-cases/forecast/ports.ts`.
- [ ] Add `apps/visualize/src/use-cases/forecast/build-animation-cache.ts`.
- [ ] Verify the new use-case test passes.
- [ ] Rewire `forecast-runtime-factory.js`.
- [ ] Delete the old service and old test.
- [ ] Run `npm run test:visualize`.
- [ ] Run `npm run typecheck:visualize`.
- [ ] Run `npm run check:visualize`.
- [ ] Run `npm run build:visualize`.
- [ ] Update `docs/architecture-migration-todo.md`.
- [ ] Commit with message `Extract forecast animation cache use case`.
