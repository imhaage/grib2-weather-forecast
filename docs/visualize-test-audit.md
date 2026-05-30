# Visualize Test Audit

This audit reviews the current `apps/visualize` Vitest suites after the removal of the legacy static regex test.

## Goal

The test suite should stay useful during the ongoing refactor. Tests should protect user-visible behavior, meteorological meaning, and stable module contracts. Tests should not freeze incidental implementation details, CSS selector structure, or cosmetic copy unless those details are explicit product contracts.

## Decision Rules

- **Keep** tests that protect a real user workflow, a meteorological/scientific interpretation, or a stable module contract.
- **Rewrite** tests that protect a useful intent but are too coupled to exact strings, CSS selectors, DOM structure, or helper internals.
- **Remove** tests that duplicate stronger coverage elsewhere or only protect an implementation detail.
- **Missing** marks important use cases that are not covered yet.

Use exact values for explicit domain decisions, such as CAPE thresholds, pressure conversion, or the 0 C temperature anchor. Prefer tolerant assertions for generated algorithmic output or visual styling.

## Current Suites

| Suite | Tests | Verdict | Notes |
| --- | ---: | --- | --- |
| `src/domain/isobars.test.js` | 7 | Keep with small rewrites later | Protects a scientific visualization feature. Some numeric expectations are implementation-shaped but useful while isobars are young. |
| `src/domain/model-packages.test.js` | 5 | Keep, possibly split later | Protects model metadata, variable names, and Weather maps vs Component fields. This is product/domain contract. |
| `src/domain/palettes.test.js` | 7 | Keep with targeted rewrites | Protects color-domain decisions. A few exact hex checks are fragile unless they represent a named palette contract. |
| `src/domain/resources.test.js` | 2 | Keep | Protects run parsing and freshness comparisons used by cache behavior. |
| `src/domain/unit-transforms.test.js` | 2 | Keep | Protects display units and pressure formatting. High value, low maintenance cost. |
| `src/domain/variable-metadata.test.js` | 2 | Rewrite | The single fallback test checks too many unrelated metadata decisions. Split by purpose. |
| `src/services/forecast-block-refresh-service.test.js` | 2 | Keep, add missing cases | Covers the most important cache/network order. Needs interruption and failure-path coverage. |
| `src/services/grib-cache-service.test.js` | 1 | Rewrite/add | The adapter smoke test is useful but too narrow for the actual IndexedDB cache contract. |
| `src/ui/app-shell.test.js` | 2 | Rewrite/remove parts | Some checks protect product copy; others freeze incidental header details. |
| `src/ui/data-status-summary.test.js` | 2 | Rewrite | Good intent, but class-name and exact punctuation checks are too brittle. |
| `src/ui/forecast-route.test.js` | 4 | Keep | Small stable routing contract. Low cost. |
| `src/ui/map-toolbar-controller.test.js` | 2 | Rewrite | Toolbar mode behavior is useful. Markup/id assertions are too structural. |
| `src/ui/model-list-view.test.js` | 1 | Keep with looser assertions | Protects the package-card use case. It should assert meaning and action, not exact classes. |
| `src/ui/style-contracts.test.js` | 2 | Remove or heavily rewrite | This is the most fragile suite. It tests CSS selectors and variables, not user behavior. |

## Detailed Classification

### Keep

- `unit-transforms.test.js`
  - `pressure values are converted to hPa and formatted as integers`
  - `non-pressure values keep the requested display precision`
  - Rationale: protects scientific display units and precision.

- `resources.test.js`
  - `extractRunId accepts data.gouv title and URL timestamps`
  - `formats and compares resource runs`
  - Rationale: protects cache freshness and user-facing run labels.

- `forecast-route.test.js`
  - All current tests.
  - Rationale: hash routing is a stable public UI contract, including legacy `#grid/` and `#arome/` support.

- `forecast-block-refresh-service.test.js`
  - `loads cache first, downloads missing blocks before refreshing stale blocks`
  - `returns typed cache load results for current, stale, and missing blocks`
  - Rationale: directly covers the intended cache/network UX.

- `model-packages.test.js`
  - Current tests are useful because model names, package variables, vertical levels, and groups are domain/product decisions.
  - Later improvement: make failures easier to read by splitting very long package expectations into smaller package-specific assertions.

### Rewrite

- `palettes.test.js`
  - Keep exact assertions for:
    - Temperature domain ticks and 0 C anchor.
    - CAPE domain thresholds.
    - Logarithmic precipitation ticks.
  - Rewrite or reduce exact hex tests for:
    - `buildLUT creates one RGB triplet per byte value`
    - `palettes are defined in their final display order`
  - Reason: exact colors are useful for custom scientific palettes, but less useful for standard palette implementation details. If the color palette is intentionally redesigned, tests should not block cosmetic iteration unnecessarily.

- `variable-metadata.test.js`
  - Split `display metadata has safe fallbacks` into focused tests:
    - default palettes by variable family;
    - static scales by variable family;
    - CAPE description/default;
    - unknown fallback behavior.
  - Reason: one broad assertion creates noisy failures and hides intent.

- `grib-cache-service.test.js`
  - Keep injected storage smoke test.
  - Add tests for:
    - exact/current block read;
    - stale fallback read;
    - newer/equal run accepted by `readCachedGribBlock`;
    - obsolete cache deletion after successful write;
    - storage failure returns safe fallback.
  - Reason: the service is now central to UX, but only the simplest read/write path is covered.

- `data-status-summary.test.js`
  - Keep the semantic order and labels.
  - Avoid asserting exact separator punctuation or full class strings.
  - Prefer assertions like “contains four status items in cache/network/updating/missing order” and “unknown status defaults to missing”.

- `map-toolbar-controller.test.js`
  - Keep mode behavior: field mode shows uploaded-field controls; run mode shows player controls.
  - Remove or rewrite the markup test that asserts exact IDs in `index.html`. IDs are an implementation detail unless a specific id is used as a stable integration point.

- `model-list-view.test.js`
  - Keep the package-card behavior and click callback.
  - Loosen exact class assertions. Prefer role/text/action queries where possible.
  - Consider testing one representative model section, not every generated DOM detail.

- `app-shell.test.js`
  - Keep the two tab labels and upload description only if they are product copy contracts.
  - The repository link is useful but should not require an icon-only structure.
  - The exact logo markup should not be tested.

### Remove

- `style-contracts.test.js`
  - Remove unless we define these colors as accessibility or semantic contracts.
  - Current assertions read raw CSS and match nested selectors. This is brittle and likely to fail during legitimate CSS cleanup.
  - If we still want semantic color protection, move it to a higher-level visual/DOM test later, or assert CSS custom properties exist without binding them to selector shape.

- Exact class-name list in `data-status-summary.test.js`
  - Remove or rewrite. It duplicates implementation details and overlaps with `style-contracts.test.js`.

## Missing Use Cases

### High Priority

- **Refresh cancellation when user changes variable or palette**
  - Scenario: a cache/network refresh is in progress, user changes variable/palette, stale async work must not update the new view.
  - Why: this was a real bug class in the app.

- **Animation cache lifecycle around latest-data gate**
  - Scenario: play is unavailable before animation cache generation, then available once the latest data cache has been generated.
  - Also verify that later per-file updates do not block playback again after the first complete cache generation, if that remains the intended UX.

- **Current visible hour replacement**
  - Scenario: stale cached block is visible, a newer block for the same hour arrives, the visible map and animation cache update for that hour.
  - Why: this is the core value of the IndexedDB + network refresh UX.

- **Unavailable hour behavior**
  - Scenario: slider points to an hour with no data; forecast date/time still updates, map clears, and “Data not available yet” appears.
  - Why: this is a user-visible UX rule that was explicitly chosen.

- **Clear cache behavior**
  - Scenario: user clears cache; storage is cleared and status text updates without breaking loaded in-memory data.

### Medium Priority

- **Download progress and six-file concurrency**
  - The current service test injects `maxParallelDownloads` but does not prove concurrency limiting.
  - A small utility-level test for `runWithConcurrency` would be useful if the helper is extracted.

- **IndexedDB stale/latest cleanup**
  - Verify old cached block is kept until the new block is successfully written, then obsolete records are deleted.

- **Upload-file workflow smoke test**
  - Current tests focus on forecast runs. The drag-and-drop/upload inspector is not covered as a user workflow.
  - Full decoding does not need to be tested in UI; a lightweight adapter test can cover route/state/metadata rendering with fake decoded messages.

- **Player icon state**
  - A regression previously broke play/pause icon swapping. The animation player should own this test if not already covered elsewhere.

### Low Priority

- **CSS layout contracts**
  - Only add if a layout becomes a repeated regression. Prefer browser/screenshot or targeted DOM behavior over CSS selector regex.

## Redundancy Notes

- `style-contracts.test.js` and `data-status-summary.test.js` both protect status coloring/class details. Keep only the semantic status summary behavior unless color semantics become a documented accessibility/product contract.
- `app-shell.test.js` overlaps with manual/product copy review. Keep only copy that is intentionally stable.
- `map-toolbar-controller.test.js` and `app-shell.test.js` both inspect raw `index.html`. This should be minimized because the app is moving toward adapters and modules.
- `model-packages.test.js` and `model-list-view.test.js` overlap on variable labels. This is acceptable if `model-packages` protects data configuration and `model-list-view` only checks that provided variables render.

## Recommended Cleanup Order

1. Remove or rewrite `style-contracts.test.js`.
2. Rewrite `data-status-summary.test.js` around semantic output, not exact class strings.
3. Add missing service tests for cancellation and stale/current cache replacement.
4. Expand `grib-cache-service.test.js` around stale fallback and obsolete deletion.
5. Loosen UI tests that inspect exact markup or CSS selectors.
6. Split broad metadata tests into smaller intent-based tests.
7. Add one upload workflow smoke test when the upload adapter is easier to isolate.

## Target Test Shape

- Domain tests: exact where they document meteorological meaning, tolerant where they check generated output.
- Service tests: scenario-based, with injected dependencies and observable event order.
- UI tests: user intent and visible states, not selector structure.
- CSS tests: rare. Prefer avoiding them unless the variable or color is a documented semantic contract.
