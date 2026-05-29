# Wind Particles Layer Design

> Status: implementation is temporarily abandoned. The feature proved too complex for the current iteration and needs a dedicated R&D phase before another implementation attempt.

## Goal

Add a derived `Wind flow (10m)` weather map that combines a wind speed heatmap with animated particles above the existing weather raster map.

This is an experimental visualization feature. The first version should stay narrow, readable, and easy to remove or replace if the result is not good enough.

## Agreed scope

- Target only `AROME_SP1`.
- Target only the 10 m wind level.
- Use `u` for the east-west 10 m wind component.
- Use `v` for the north-south 10 m wind component.
- Add a new `Wind flow (10m)` parameter in `Weather maps`.
- Keep `Temperature (2m)` as the default `AROME_SP1` parameter.
- Render wind speed as a derived heatmap: `sqrt(u² + v²) * 3.6`, in `km/h`.
- Render particles as a separate animated MapLibre custom layer above the derived heatmap.
- Always enable particles for `Wind flow (10m)`; do not add a particle toggle in the first prototype.
- Do not show particles for `U (wind, 10m)` or `V (wind, 10m)` directly.
- Keep `U` and `V` visible as component fields.
- Keep the first implementation simple before extending to HP1 levels, wind direction fields, gust fields, or other models.

## Prerequisite: grouped home parameters

Before implementing `Wind flow (10m)`, update the home package cards so parameter lists follow the same grouping as the parameter selects:

- apply groups to all packages;
- show `Weather maps` before `Component fields`;
- keep HP1 condensed lines, but place them under the right group;
- keep all existing raw/component fields visible so the home page still documents which parameters are available;
- commit this UI change separately from the wind particle prototype.

## First visualization model

Particles should encode:

- direction through movement;
- speed through movement velocity;
- use thin translucent white strokes with a subtle fade/trail;
- keep the first version intentionally sparse and fluid, not spectacular.

The existing heatmap system remains the scalar background layer. For `Wind flow (10m)`, the background is the derived wind speed heatmap using `Viridis` and a fixed `0..160 km/h` domain. Values above `160 km/h` clamp to the maximum color.

The timeline Play button should be disabled for `Wind flow (10m)` because the visible animation comes from particles, not from timestep playback. The slider remains available for manual hour changes.

## Data requirements

The layer needs both fields for the same forecast hour:

- `u`: east-west 10 m wind component, in `m s-1`;
- `v`: north-south 10 m wind component, in `m s-1`.

SP1 is the preferred first source because it already provides the vector components needed for particle advection. This avoids reconstructing vectors from speed and direction, avoids the meteorological "from/to" ambiguity of `wdir`, and uses the same 10 m wind components already exposed in the app.

HP1 also contains U/V fields at 10, 20, 50, and 100 m, plus decoded speed/direction fields. It remains useful for a later multi-level wind feature, but it is not the simplest first prototype.

For the first prototype, load/decode only the current hour's `u` and `v` fields when `Wind flow (10m)` is selected. If slider UX is not good enough, evaluate these alternatives later:

- load all `u/v` timesteps like a full forecast parameter;
- load the current hour first, then prefetch other hours during idle time.

## Rendering options

### Option A: MapLibre custom layer

Render particles as a MapLibre custom layer. On each animation frame:

1. Fade the previous frame slightly to create trails.
2. Sample the wind field at each particle position.
3. Move the particle.
4. Respawn particles that leave the map, age out, or hit missing data.

Advantages:

- Better integration with the map render lifecycle than a DOM overlay.
- Layer ordering can be controlled like other map layers.
- Avoids maintaining an independent overlay canvas above MapLibre.
- Still avoids heavy external dependencies.

Risks:

- Higher implementation cost than a DOM overlay.
- MapLibre custom layers are WebGL-oriented, so the implementation must verify whether a clean Canvas 2D path is possible or whether WebGL is required.
- Must handle map lifecycle details, layer ordering, resize, and potentially context loss/restoration.
- CPU/GPU cost can become visible on mobile if particle count is too high.

Recommended for the first prototype.

### Option B: DOM overlay canvas

Place a transparent canvas absolutely above the MapLibre map container.

Advantages:

- Lowest raw implementation risk.
- Easy to prototype and debug.
- Keeps MapLibre, the heatmap canvas source, and particles decoupled.

Risks:

- Rejected for this prototype because the target is a real MapLibre layer, not an external overlay.
- Requires careful synchronization with map resize, move, zoom, pitch, and bounds.
- Projection drift can appear if particles are stored in screen coordinates while the map moves.

Useful fallback if the custom layer path becomes too heavy.

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

Using SP1 U/V components avoids the main `wdir` convention trap. Particle movement and tooltip direction use geographic flow direction:

- positive `u`: eastward movement;
- positive `v`: northward movement.

Direction convention:

- `0°`: north;
- `90°`: east;
- `180°`: south;
- `270°`: west.

Compute direction with `atan2(u, v)` converted to degrees and normalized to `0..360`.

If a future version uses `wdir`, remember that weather maps often describe wind direction as where the wind comes from, while animated particles usually move toward where the air goes. That case must be verified before visual testing, otherwise the animation can look plausible but be 180 degrees wrong.

### Projection and sampling

The heatmap currently uses a Mercator-proportional canvas. Particles need a clear coordinate strategy:

- store particles in geographic coordinates and project them to screen each frame; or
- store particles in screen coordinates and unproject to sample the grid each frame.

For correctness during pan/zoom, geographic coordinates are probably safer. For speed, screen coordinates are simpler. The prototype should start simple but keep the coordinate boundary isolated.

### Interpolation

Nearest-neighbor sampling may be fast but can make motion jittery on coarse fields. With U/V components, bilinear interpolation is straightforward and avoids circular-angle wrapping issues.

Safer options:

- interpolate U and V separately;
- derive speed from interpolated U/V only when needed for particle speed scaling or styling;
- start with nearest-neighbor for the prototype and improve only if visual artifacts are obvious.

### Performance on mobile

Particles compete with:

- MapLibre rendering;
- heatmap image updates;
- animation cache generation;
- downloads and decoding.

The first version should have conservative defaults:

- low particle count by default, even on desktop;
- pause during tab invisibility;
- pause during map pan/zoom;
- reset particles when the map becomes stable after pan/zoom;
- avoid allocating particle objects per frame;
- reuse typed arrays for particle state.

### Interaction with forecast animation

`Wind flow (10m)` should not use the bitmap animation cache in the first prototype. Timeline playback is disabled for this field.

The wind particle layer should follow the current forecast hour. When the time slider changes:

- update the wind fields used by particles;
- show a short loading state while the new hour's `u/v` fields are fetched/decoded;
- never keep old-hour wind data visible under the new displayed valid time;
- reset particles once the new hour is ready;
- clear or pause particles if one field is missing.

Avoid making the wind particle layer a blocker for the existing bitmap animation cache used by other parameters.

### Data loading

Current forecast rendering is centered around one selected field. `Wind flow (10m)` is different because it is a derived field backed by two SP1 fields at the same time.

When `Wind flow (10m)` is selected, the app should load `u` and `v` for the current timestep only. This companion loading should reuse the existing cache/download mechanisms internally, but the UI should remain at the file/timestep level.

For the first prototype, companion loading should be explicit in code and narrow to SP1 10 m only.

The download/cache UI should stay at the file/timestep level. Do not add separate U/V status details in the first prototype.

## Suggested prototype behavior

1. User opens `AROME SP1`.
2. User selects `Wind flow (10m)`.
3. The app fetches/decodes `u` and `v` for the current hour.
4. If both fields are available, the app renders the derived wind speed heatmap and starts the particle layer.
5. If one field is missing, the map displays the existing empty/data-unavailable state and no particles.
6. The Play button is disabled for this field.
7. The slider remains usable; changing hour clears the old map, shows a short loading state, then resets particles for the new hour.

## Implementation boundaries

Potential modules:

- `wind-particle-layer-service.js`
  - owns MapLibre custom layer lifecycle, animation loop, resize, mount/unmount;
  - no GRIB cache knowledge.
- `wind-field-sampler.js`
  - maps coordinates to grid indices;
  - samples `u` and `v`;
  - interpolates U/V separately;
  - hides grid/projection/interpolation details.
- `wind-particle-state.js`
  - owns particle arrays, respawn, aging, movement.
- `wind-flow-derived-field.js`
  - computes wind speed in `km/h`;
  - computes tooltip direction arrow/cardinal;
  - keeps derived field math testable outside the UI.
- small UI integration in the forecast route/controller:
  - decides when the layer is eligible;
  - passes current hour fields to the service.

Keep this feature independent from the heatmap renderer service unless sharing map projection helpers becomes clearly useful.

Tooltip format for `Wind flow (10m)`:

- speed with one decimal in `km/h`;
- Unicode arrow for flow direction;
- 8-direction cardinal label;
- no degrees in the tooltip.

Example: `42.3 km/h ↙ SW`.

## Open questions before implementation

- Confirm whether MapLibre custom layers require WebGL for this use case, or whether a clean Canvas 2D-backed custom layer is possible.
- Decide the exact disabled Play button title.
- Tune initial particle count, fade, line width, and speed factor visually.
- Decide whether the first version uses nearest-neighbor or bilinear U/V sampling after a quick prototype check.

## Recommendation

Start with Option A: a MapLibre custom layer. Keep particle count low, store state in typed arrays, and isolate all particle logic in new modules.

Do not add deck.gl or WeatherLayers yet. Use them as design references, not dependencies.

Do not try to solve all wind levels, HP1 speed/direction fields, or gust fields in the first pass. The only goal of the prototype is to answer: does animated wind flow add enough meteorological value to deserve deeper integration?
