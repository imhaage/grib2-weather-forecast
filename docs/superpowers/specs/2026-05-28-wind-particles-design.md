# Wind Particles Layer Design

## Goal

Add an optional animated particle layer above the existing weather raster map to make wind direction easier to read.

This is an experimental visualization feature. The first version should stay narrow, readable, and easy to remove or replace if the result is not good enough.

## Agreed scope

- Target only `AROME_HP1`.
- Target only the 10 m wind level.
- Use `wspd_10` for particle speed.
- Use `wdir_10` for particle direction.
- Render particles as a separate animated layer above the current heatmap.
- Show the layer only when the selected parameter is wind-related at 10 m.
- Keep the first implementation simple before extending to other levels, U/V fields, or other models.

## First visualization model

Particles should encode:

- direction through movement;
- speed through movement velocity;
- optionally speed through subtle opacity or color later, if needed.

The existing heatmap remains the scalar background layer. For example, the user could display wind speed as a Viridis heatmap and enable particles above it to understand flow direction.

## Data requirements

The layer needs both fields for the same forecast hour:

- `wspd_10`: wind speed at 10 m, displayed in `km/h` in the app;
- `wdir_10`: wind direction at 10 m, in degrees.

Open question for implementation: confirm the meteorological convention of `wdir` in the decoded GRIB field. GRIB wind direction is usually the direction from which the wind blows. Particle movement visually often represents where the air is going. If `wdir` is "from", movement direction should be rotated by 180 degrees to show advection.

## Rendering options

### Option A: DOM overlay canvas

Place a transparent canvas absolutely above the MapLibre map container. On each animation frame:

1. Fade the previous frame slightly to create trails.
2. Sample the wind field at each particle position.
3. Move the particle.
4. Respawn particles that leave the map, age out, or hit missing data.

Advantages:

- Lowest integration risk.
- No new heavy dependencies.
- Easy to prototype and debug.
- Keeps MapLibre, the heatmap canvas source, and particles decoupled.

Risks:

- Requires careful synchronization with map resize, move, zoom, pitch, and bounds.
- Projection drift can appear if particles are stored in screen coordinates while the map moves.
- CPU cost can become visible on mobile if particle count is too high.

Recommended for the first prototype.

### Option B: MapLibre custom WebGL layer

Use MapLibre's `CustomLayerInterface` to render directly into the map WebGL context.

Advantages:

- Better long-term integration with map rendering.
- Potentially better performance for many particles.
- Layer ordering can be controlled like other map layers.

Risks:

- More complex GL state management.
- Must handle WebGL context loss and restoration.
- Harder to debug.
- Higher implementation cost while the app is still being modularized.

Good candidate for a second iteration if the canvas prototype proves valuable.

### Option C: deck.gl / WeatherLayers-style particle layer

Adopt a specialized layer approach inspired by deck.gl and WeatherLayers.

Advantages:

- Existing ecosystem has mature concepts: particle count, max age, speed factor, line width, color palette.
- WeatherLayers documents a ParticleLayer with `numParticles`, `maxAge`, `speedFactor`, `width`, `color`, and `palette`.

Risks:

- Adds significant dependencies.
- deck.gl interleaved MapLibre mode has known lifecycle and bundling pitfalls.
- Could conflict with the current "small, vanilla core first" refactor direction.

Not recommended for the first implementation, but useful as a reference.

## Existing references and lessons

- Mapbox GL JS has a native `raster-particle` layer example for GFS wind. It uses a `raster-array` source and exposes tuning parameters such as speed factor, fade opacity, reset rate, particle count, max speed, and speed-based color.
  - https://docs.mapbox.com/mapbox-gl-js/example/raster-particle-layer/
- Mapbox's open-source `webgl-wind` demo claims WebGL can render very large particle counts efficiently and is inspired by Earth/nullschool and the US Wind Map.
  - https://github.com/mapbox/webgl-wind
- WeatherLayers GL provides a dedicated `ParticleLayer` for vector variables and documents the same kind of parameters we should expect to tune: particle count, max age, speed factor, width, color, and palette.
  - https://docs.weatherlayers.com/weatherlayers-gl/layers/particle-layer
- WeatherLayers troubleshooting highlights real integration risks with deck.gl and MapLibre: duplicate deck.gl bundles, layers needing recreation after disabling/enabling overlays, and layer-order issues.
  - https://docs.weatherlayers.com/weatherlayers-gl/troubleshooting
- MapLibre custom layers allow direct WebGL rendering through `CustomLayerInterface`, but custom layers must manage render lifecycle details and WebGL context loss/restoration.
  - https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/
- Leaflet Velocity and wind-js are useful conceptual references for CPU/canvas particle systems: interpolate a vector surface, evolve particles through the field, and tune velocity scale / particle age.
  - https://www.npmjs.com/package/leaflet-velocity
  - https://github.com/Esri/wind-js

## Known hard parts

### Direction convention

Weather maps often describe wind direction as where the wind comes from, while animated particles usually move toward where the air goes. This must be verified before visual testing, otherwise the animation can look plausible but be 180 degrees wrong.

### Projection and sampling

The heatmap currently uses a Mercator-proportional canvas. Particles need a clear coordinate strategy:

- store particles in geographic coordinates and project them to screen each frame; or
- store particles in screen coordinates and unproject to sample the grid each frame.

For correctness during pan/zoom, geographic coordinates are probably safer. For speed, screen coordinates are simpler. The prototype should start simple but keep the coordinate boundary isolated.

### Interpolation

Nearest-neighbor sampling may be fast but can make motion jittery on coarse fields. Bilinear interpolation of direction is tricky because angles wrap around at 360 degrees.

Safer options:

- convert `wspd + wdir` to vector components internally, then interpolate U/V-like values;
- interpolate speed separately and direction using circular interpolation;
- start with nearest-neighbor for the prototype and improve only if visual artifacts are obvious.

### Performance on mobile

Particles compete with:

- MapLibre rendering;
- heatmap image updates;
- animation cache generation;
- downloads and decoding.

The first version should have conservative defaults:

- lower particle count on coarse pointer / small viewport;
- pause during tab invisibility;
- pause or reduce density while the map is actively moving;
- avoid allocating particle objects per frame;
- reuse typed arrays for particle state.

### Interaction with forecast animation

The wind particle layer should follow the current forecast hour. When the time slider or playback changes:

- update the wind fields used by particles;
- keep animation running if both fields are ready;
- clear or pause particles if one field is missing.

Avoid making the wind particle layer a blocker for the existing bitmap animation cache.

### Data loading

Current forecast rendering is centered around one selected field. Wind particles need two fields at the same time. This can create UX and architecture questions:

- If user selects `Wind direction (10m)`, should `Wind speed (10m)` be loaded as a companion field?
- If user selects `Wind speed (10m)`, should `Wind direction (10m)` be loaded as a companion field?
- Should companion loading use the same cache and status UI, or stay silent until the layer is stable?

For the first prototype, companion loading should be explicit in code and narrow to HP1 10 m only.

## Suggested prototype behavior

1. User opens `AROME HP1`.
2. User selects `Wind speed (10m)` or `Wind direction (10m)`.
3. The app checks whether both `wspd_10` and `wdir_10` are available for the current hour.
4. If both fields are available, the particle layer appears above the map.
5. If one field is missing, the particle layer stays hidden.
6. The heatmap behavior remains unchanged.
7. Slider and playback continue to work; particles update to the current hour when possible.

## Implementation boundaries

Potential modules:

- `wind-particle-layer-service.js`
  - owns canvas, animation loop, resize, mount/unmount;
  - no GRIB cache knowledge.
- `wind-field-sampler.js`
  - maps coordinates to grid indices;
  - samples `wspd_10` and `wdir_10`;
  - hides interpolation details.
- `wind-particle-state.js`
  - owns particle arrays, respawn, aging, movement.
- small UI integration in the forecast route/controller:
  - decides when the layer is eligible;
  - passes current hour fields to the service.

Keep this feature independent from the heatmap renderer service unless sharing map projection helpers becomes clearly useful.

## Open questions before implementation

- Should particles be enabled by default for wind 10 m, or controlled by a toggle?
- Should the first prototype show particles over both `Wind speed (10m)` and `Wind direction (10m)`, or only one of them?
- Should particles pause while the user drags the slider?
- Should we show a small "Wind particles unavailable" state, or silently hide the layer when the companion field is missing?
- What is the minimum acceptable mobile performance target: 30 fps, "feels smooth", or no visible app freeze?

## Recommendation

Start with Option A: a separate transparent canvas overlay. Keep particle count low and adaptive, store state in typed arrays, and isolate all particle logic in new modules.

Do not add deck.gl or WeatherLayers yet. Use them as design references, not dependencies.

Do not try to solve all wind levels or U/V-derived fields in the first pass. The only goal of the prototype is to answer: does animated wind direction add enough meteorological value to deserve deeper integration?
