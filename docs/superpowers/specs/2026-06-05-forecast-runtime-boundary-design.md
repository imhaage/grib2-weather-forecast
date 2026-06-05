# Forecast Runtime Boundary Design

## Goal

Improve the long-term architecture of the forecast visualization flow by making
`forecast-run-controller.js` a thin UI/application adapter instead of the owner
of runtime state, service composition, worker lifecycle, and forecast use-cases.

The refactor must preserve the public behavior and public controller API. The
first implementation pass should prioritize a clear architectural boundary, not
new user-facing features.

## Current Problem

`forecast-run-controller.js` still mixes several responsibilities:

- DOM-backed view creation.
- Forecast service composition.
- Runtime state ownership.
- Download worker lifecycle.
- Model block worker lifecycle.
- Network refresh orchestration.
- Animation cache orchestration.
- Forecast variable and wind direction use-cases.
- Map presentation coordination.

This makes the file harder to read, harder to test in focused units, and harder
to modify safely. It also blurs the UI/application/domain boundary.

## Chosen Approach

Use a three-part architecture:

1. `forecast-run-controller.js`
   - Creates DOM-backed views.
   - Passes external dependencies into the runtime factory.
   - Exposes the same public API as today.
   - Does not own forecast runtime state.

2. `forecast-runtime-factory.js`
   - Composes existing forecast services.
   - Wires runtime callbacks and ports.
   - Creates `forecast-runtime`.
   - Keeps dependency wiring out of both the controller and the runtime use-case
     implementation.

3. `forecast-runtime.js`
   - Owns runtime state through an explicit `runtimeState` object.
   - Exposes forecast use-cases.
   - Does not know the DOM.
   - Talks to UI through explicit ports such as `downloadView`,
     `hourControlView`, `warmupView`, `variableControlsView`, and
     `dataStatusSummaryView`.

This keeps the project style based on factory functions while making mutable
forecast state explicit.

## Runtime State

The runtime should group mutable state in a named object:

```js
const runtimeState = {
  modelState: null,
  modelBlockService: null,
  downloadWorkerClient: null,
  animationPlayer: null,
};
```

This is preferred over scattered `let` bindings because the state ownership is
visible, easier to test, and easier to move again later if needed.

## Public API Compatibility

The public API exposed by `createForecastRunController` must stay stable.
Callers should still be able to use the same methods:

- `getDiagnostics`
- `getModelState`
- `getPackageKey`
- `handleVariableChange`
- `hasModelState`
- `isAnimationCacheReadyForPlayback`
- `isBitmapCacheComplete`
- `onForecastSliderInput`
- `queueCurrentTooltipValueHydration`
- `refreshCurrentModelVisuals`
- `resetModelState`
- `setAnimationPlayer`
- `setWindDirectionVisible`
- `showHour`
- `startDownload`

Internal names may be improved when doing so makes the responsibility clearer.

## Commit Strategy

The implementation should happen in two commits.

### Commit 1: Runtime Boundary

Introduce the new architectural boundary:

- Add `forecast-runtime.js`.
- Add `forecast-runtime-factory.js`.
- Move runtime state and the main forecast use-cases out of
  `forecast-run-controller.js`.
- Keep behavior unchanged.
- Keep existing controller tests passing as integration coverage.

The main success criterion is a clear `controller -> factory -> runtime`
boundary.

### Commit 2: Cleanup and Focused Tests

Clean up the extraction:

- Remove helpers that no longer belong in the controller.
- Improve internal names where clarity benefits future readers.
- Add focused runtime tests if controller integration tests no longer provide
  enough confidence for important use-cases.
- Avoid unrelated refactors.

## Risks

Key risks:

- Breaking implicit coordination between resource refresh, bitmap cache
  invalidation, and animation cache generation.
- Losing render generation stability during `refreshCurrentModelVisuals`.
- Desynchronizing variable selection or wind direction UI state.
- Moving complexity into a large runtime without improving boundaries.

## Guardrails

- Preserve public controller behavior and API.
- Keep the runtime DOM-free.
- Use explicit UI ports instead of direct DOM access from runtime code.
- Keep the factory responsible for wiring.
- Keep the runtime responsible for state and use-cases.
- Run all available tests before considering the implementation complete.

## Out of Scope

- Changing user-facing forecast behavior.
- Introducing a new event bus.
- Replacing existing services with third-party libraries.
- Reworking map rendering, wind symbols, or animation behavior.
- Renaming public controller methods.
