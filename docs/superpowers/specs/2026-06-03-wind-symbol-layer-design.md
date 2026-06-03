# Wind Symbol Layer Design

## Goal

Improve wind visualization by replacing direction-only color maps with a composite wind map:

- wind speed remains a raster layer;
- wind direction is displayed as fixed-size symbols above the speed raster;
- the user selects one `Wind` entry per available level.

This design does not cover animated wind particles. The paused particle work remains separate and is not part of this milestone.

## User Experience

The weather map list exposes composite wind entries such as:

- `Wind (10m)`;
- `Wind (20m)`;
- `Wind (50m)`;
- `Wind (100m)`.

Each entry combines the matching speed and direction fields for the same level. The user does not choose separate speed and direction overlays.

The existing `wspd_*` and `wdir_*` fields move to `Component fields`, alongside the existing `u_*` and `v_*` fields. They remain available for inspection and debugging.

The legend and statistics stay focused on speed only. Tooltips show both speed and direction, for example:

```text
43 km/h · 240° SW
```

Speed values shown to users are expressed in `km/h`.

## Data Pairing

Each composite wind variable is backed by two fields:

- `wspd_*` for wind speed;
- `wdir_*` for wind direction.

If either field is missing for the selected forecast hour, the composite wind entry is unavailable for that hour.

The first implementation uses decoded `wdir_*` values directly as the direction source. Before finalizing arrow rotation, the direction convention must be verified against the matching `u_*` and `v_*` component fields:

- if `wdir_*` represents the direction the wind is blowing toward, symbols use it directly;
- if `wdir_*` represents the meteorological direction the wind comes from, flow arrows rotate by `180°`.

The visible map should communicate flow direction consistently.

## Rendering Strategy

Use MapLibre with:

- the existing raster rendering path for wind speed;
- one GeoJSON source for wind symbols;
- one symbol layer for arrows;
- one circle layer for calm wind markers if that is simpler than mixing icons in one symbol layer.

Wind symbols render above the raster layer and below UI overlays.

Symbols use fixed visual size. Speed is already encoded by the raster, so symbol size and opacity should not encode speed.

Calm wind is displayed with a small circle when speed is below `5 km/h`. If model values are stored in `m/s`, the equivalent threshold is `1.3889 m/s`.

## Sampling And Density

Generate symbol features only for the current visible map bounds.

Density should remain roughly stable in screen space while zooming:

- low zoom uses a coarser sample step;
- high zoom uses a finer sample step;
- the target should be close to the dense prototype density.

The symbol feature builder should use viewport size and zoom to derive a grid stride rather than relying on a fixed data-grid stride.

Feature generation runs on:

- selected forecast hour change;
- selected wind level change;
- map `moveend`;
- meaningful zoom changes.

Avoid regenerating on every frame while the user is panning or zooming.

## Architecture

Keep the first milestone simple and modular. No new worker is introduced for symbols.

The existing model block worker continues to decode field data. The main thread builds GeoJSON features from decoded speed and direction grids, visible bounds, and zoom state.

Recommended modules:

- `wind-composite-variable.js`: maps composite wind entries to speed and direction component fields;
- `wind-symbol-sampler.js`: pure feature builder for visible bounds, density, calm threshold, and direction formatting data;
- `wind-symbol-layer-service.js`: owns MapLibre source/layer lifecycle for wind symbols;
- `wind-direction-format.js`: cardinal direction and tooltip formatting helpers.

The sampler should stay pure and independently testable so it can move to a worker later if performance requires it.

## Tooltip Behavior

The tooltip keeps existing raster lookup behavior for speed and adds direction lookup for composite wind maps.

For composite wind maps, tooltip content includes:

- speed in `km/h`;
- numeric direction in degrees;
- cardinal direction.

For non-wind variables, the existing tooltip behavior remains unchanged.

## Tests

Add focused tests around the new domain logic:

- composite wind variable resolution by level;
- unavailable state when speed or direction is missing;
- calm threshold conversion and marker selection;
- cardinal direction formatting;
- visible-bounds filtering;
- zoom-aware sampling stride;
- GeoJSON feature shape;
- MapLibre source and layer lifecycle with a fake map object;
- tooltip formatting for composite wind maps.

## Risks And Guardrails

Direction convention is the main correctness risk. The implementation must verify `wdir_*` semantics against `u_*` and `v_*` before considering the feature complete.

Performance risk is controlled by generating only visible features and updating on settled map interactions.

The implementation should avoid coupling symbol generation to MapLibre internals. GeoJSON generation remains a pure domain concern; MapLibre integration remains an adapter concern.

The feature should not revive or modify the paused animated particle design.
