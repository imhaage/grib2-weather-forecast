# AROME 0.025 Reference

This document is the project source of truth for Météo-France AROME 0.025° open-data packages used or considered by the visualizer.

Last reviewed: 2026-05-19.

## Sources

- [data.gouv.fr — Paquets Arome - Résolution 0,025°](https://www.data.gouv.fr/fr/datasets/paquets-arome-resolution-0-025deg/)
- [Météo-France technical description — AROME packages, 2025-04-01](https://static.data.gouv.fr/resources/paquets-arome-resolution-0-025deg/20250401-061917/descriptiontechnique-paquetsarome-donneespubliques-v4-20250401.pdf)
- [Météo-France parameter glossary — ARPEGE/AROME](https://www.data.gouv.fr/api/1/datasets/r/eac02578-f1f1-47b0-a01b-0ae4b1eee2b8)
- [Météo-France — Weather forecast models](https://meteofrance.com/modeles-prevision-meteo)
- [meteofetch Arome025 table](https://meteofetch.readthedocs.io/fr/latest/arome.html#arome025), used as a practical cross-check for GRIB short names, dimensions, and run shapes.

## Model and Dataset

AROME 0.025° is a lower-resolution public export of the same Météo-France AROME limited-area model family as AROME 0.01°. It covers the same France-centered domain but exposes many more meteorological variables and vertical packages than the AROME 0.01° public dataset.

| Item | Value |
| --- | --- |
| Dataset | `Paquets Arome - Résolution 0,025°` |
| Dataset ID | `65bd12d7bfd26e26804204cb` |
| Producer | Météo-France |
| License | Licence Ouverte / Open Licence 2.0 |
| Format | GRIB2, CCSDS compressed (`grid_ccsds`) |
| Forecast runs | `00`, `03`, `06`, `09`, `12`, `15`, `18`, `21` UTC |
| Forecast range | `H+00` to `H+51`, hourly |
| Forecast grouping | 9 files per package/run: `00H06H`, `07H12H`, `13H18H`, `19H24H`, `25H30H`, `31H36H`, `37H42H`, `43H48H`, `49H51H` |

## Grid

| Item | Value |
| --- | --- |
| Grid name | `EURW1S40` |
| Resolution | `0.025°`, about 2.5 km |
| Domain | `55.4N` to `37.5N`, `12W` to `16E` |
| Expected dimensions | `1121 x 717` lon/lat points |
| Full run shape for 2D fields | commonly `(52, 717, 1121)` when `H+00..H+51` exists |

Important: Météo-France states that native AROME grids on this domain are trapezoidal, while GRIB stores rectangular grids. A significant number of missing values is expected. Missing values can differ by parameter, so multi-parameter GRIB files must be handled parameter by parameter.

Visualization consequences:

- Missing values must be excluded from min/max, contours, interpolation, tooltips, and derived products.
- The map domain should fit `[-12, 37.5]` to `[16, 55.4]`.
- AROME 0.025 is much lighter per pixel than AROME 0.01, but many packages are much larger because they contain multiple levels and multiple hours per file.

## Package Summary

Current data.gouv resources contain 9 GRIB2 files per package/run. Sizes below are indicative: the official PDF gives approximate size per forecast group, and live dataset sizes vary by run and meteorological situation.

| Package | Official content | Official approx. size per group | Current dataset order of magnitude | App priority |
| --- | --- | ---: | ---: | --- |
| `SP1` | Main surface fields: MSL pressure, 10 m wind, 2 m temperature/humidity, precipitation, radiation | 45 MB | about 50 MiB/group | High |
| `SP2` | Extra surface fields: altitude, surface pressure, skin temperature, clouds, CAPE, boundary layer height, 2 m dew point/specific humidity | 58 MB | about 38 MiB/group | High |
| `SP3` | Surface fluxes and radiation budget | 56 MB | about 56 MiB/group | Medium / scientific |
| `IP1` | Basic isobaric fields on 24 pressure levels | 444 MB | about 397 MiB/group | Expert / later |
| `IP2` | Cloud hydrometeors and cloud fraction on 24 pressure levels | 198 MB | about 126 MiB/group | Expert / later |
| `IP3` | Wind, moisture, dew point, vertical velocity, potential vorticity on 24 pressure levels | 693 MB | about 640 MiB/group | Expert / later |
| `IP4` | TKE on 24 pressure levels, reflectivity on 16 levels | 82 MB | about 52 MiB/group | Expert / later |
| `IP5` | Vorticity, pseudo-adiabatic potential temperature, potential-vorticity-level fields | 144 MB | about 130 MiB/group | Expert / later |
| `HP1` | Main height-level fields from near surface to 3000 m | 700 MB | about 633 MiB/group | Expert / later |
| `HP2` | Hydrometeors, humidity, dew point, TKE on height levels | 612 MB | about 474 MiB/group | Expert / later |
| `HP3` | Reflectivity on 7 height levels | 20 MB | about 8 MiB/group | Medium / later |

## Surface Variables

### SP1

SP1 is the best first AROME 0.025 package for this visualizer because it contains `P(mer)` / `prmsl`, the correct source for classic synoptic isobars.

| Official parameter | Observed GRIB name | Level | Unit | Temporal type | Description | Visualization notes |
| --- | --- | --- | --- | --- | --- | --- |
| `P(mer)` | `prmsl` | Mean sea level | `Pa` | Instantaneous | Pressure reduced to mean sea level. | Correct source for weather-map isobars. Display as hPa: `Pa / 100`. |
| `U(10m)` | `u10` | 10 m above model relief | `m s-1` | Instantaneous | Zonal wind component at 10 m. | Combine with `v10`; derive speed/direction when needed. |
| `V(10m)` | `v10` | 10 m above model relief | `m s-1` | Instantaneous | Meridional wind component at 10 m. | Combine with `u10`. |
| `DD(10m)` | `wdir10` | 10 m above model relief | degrees true | Instantaneous | 10 m wind direction. | Direction is circular; avoid normal linear palettes around `0/360`. |
| `FF(10m)` | `si10` | 10 m above model relief | `m s-1` | Instantaneous | 10 m wind speed. | Can be displayed directly or derived from U/V. |
| `FF_RAF(10m)` | `max_i10fg` | 10 m above model relief | `m s-1` | Maximum over previous period | Maximum 10 m wind gust speed. | Usually no `H+00`; shape commonly `(51, 717, 1121)`. |
| `U_RAF(10m)` | `efg10` | 10 m above model relief | `m s-1` | Maximum over previous period | Eastward component of maximum 10 m gust. | Combine with `nfg10` for gust vector. |
| `V_RAF(10m)` | `nfg10` | 10 m above model relief | `m s-1` | Maximum over previous period | Northward component of maximum 10 m gust. | Combine with `efg10`. |
| `T(2m)` | `t2m` | 2 m above model relief | `K` | Instantaneous | 2 m diagnostic air temperature. | Display as Celsius: `K - 273.15`. |
| `HU(2m)` | `r2` | 2 m above model relief | `%` | Instantaneous | 2 m relative humidity. | Keep as `%`, usually `0..100`. |
| `NEBUL` | `unknown` in meteofetch | Ground surface diagnostic | unknown | Cloud diagnostic | Total cloudiness / cloud-cover style field in the official package list. | Needs direct GRIB inspection before UI exposure. |
| `PRECIP` | `tp` | Ground surface | `kg m-2` cumulative | Accumulated | Total precipitation accumulation. | `1 kg m-2` equals about `1 mm` water equivalent; hourly rate requires differencing consecutive hours. |
| `NEIGE` | `tsnowp` | Ground surface | `kg m-2` cumulative | Accumulated | Snow precipitation accumulation. | Use hourly increments for rate maps. |
| `FLSOLAIRE_D` | `ssrd` | Ground surface | `J m-2` | Accumulated / time-integrated | Downward surface short-wave solar radiation. | Convert to W/m² only if the time interval is known and clearly displayed. |
| `GRAUPEL` | `tgrp` | Ground surface | `kg m-2` cumulative | Accumulated | Graupel / snow-pellet precipitation accumulation. | Use hourly increments for rate maps. |

### SP2

SP2 is the second useful surface package. It adds boundary-layer and moisture diagnostics that AROME 0.01 does not expose in the current app.

| Official parameter | Observed GRIB name | Level | Unit | Temporal type | Description | Visualization notes |
| --- | --- | --- | --- | --- | --- | --- |
| `ALTITUDE` | `h` | Ground/model relief | `m` | Constant field | Geometric height of model relief. | Useful for debugging missing masks, topographic pressure effects, and context layers. |
| `P(sol)` | `sp` | Model surface | `Pa` | Instantaneous | Surface pressure tied to model relief. | Display as hPa, but do not use for synoptic isobars. |
| `T(sol)` | `t` | Ground surface / skin level | `K` | Instantaneous | Surface or skin temperature. | Must be labelled distinctly from 2 m air temperature. |
| `NEBBAS` | `lcc` | Ground surface diagnostic | `%` | Cloud diagnostic | Low cloud cover. | Use `0..100%`. |
| `NEBHAU` | `hcc` | Ground surface diagnostic | `%` | Cloud diagnostic | High cloud cover. | Use `0..100%`. |
| `NEBMOY` | `mcc` | Ground surface diagnostic | `%` | Cloud diagnostic | Medium cloud cover. | Use `0..100%`. |
| `CAPE_INS` | `CAPE_INS` | Surface-based diagnostic | `J kg-1` / `m2 s-2` | Instantaneous | Most Unstable CAPE, computed in the first 3000 m above ground. | Keep zero values visible. |
| `H_COULIM` | `blh` | Boundary layer | `m` | Instantaneous | Boundary layer height. | Valuable for convection, mixing, smoke/pollution, and wind-context visualization. |
| `EAU` | `tirf` | Ground surface | `kg m-2` cumulative | Accumulated | Liquid precipitation accumulation. | Hourly increment required for rain-rate maps. |
| `TMIN(2m)` | `t2m` in meteofetch, time-minimum metadata expected | 2 m above model relief | `K` | Time minimum | Minimum 2 m temperature over the interval. | Direct short name may collide with normal `t2m`; product/statistical metadata is required. |
| `TMAX(2m)` | `t2m` in meteofetch, time-maximum metadata expected | 2 m above model relief | `K` | Time maximum | Maximum 2 m temperature over the interval. | Direct short name may collide with normal `t2m`; product/statistical metadata is required. |
| `TD(2m)` | `d2m` | 2 m above model relief | `K` | Instantaneous | 2 m dew point temperature. | Display as Celsius; useful with humidity and fog risk. |
| `Q(2m)` | `sh2` | 2 m above model relief | `kg kg-1` | Instantaneous | 2 m specific humidity. | More physical than relative humidity for air-mass moisture. |

### SP3

SP3 contains surface fluxes and radiation-budget variables. It is more scientific than the current app but useful for solar/energy, surface exchange, and boundary-layer analysis.

| Official parameter | Observed GRIB name | Unit | Description | Visualization notes |
| --- | --- | --- | --- | --- |
| `COLONNE_VAPO` | `unknown` in meteofetch | unknown | Integrated atmospheric water-vapor column. | Needs direct GRIB inspection. |
| `FLEVAP` | not explicitly mapped in meteofetch table | likely `kg m-2` or flux-derived | Evaporation-related flux. | Needs direct GRIB inspection and interval semantics. |
| `FLLAT` | `slhf` | `J m-2` | Time-integrated surface latent heat net flux. | Interval-aware conversion needed for W/m². |
| `FLSEN` | `sshf` | `J m-2` | Time-integrated surface sensible heat net flux. | Interval-aware conversion needed for W/m². |
| `FLTHERM_D` | `strd` | `J m-2` | Surface downward long-wave radiation. | Useful for night cooling / radiation balance. |
| `FLSOLAIRE` | `ssr` | `J m-2` | Surface net short-wave radiation. | Interval-aware conversion needed. |
| `FLTHERM` | `str` | `J m-2` | Surface net long-wave radiation. | Interval-aware conversion needed. |
| `FLRASOL_CC` | `ssrc` | `J m-2` | Surface net short-wave radiation, clear sky. | Can compare against all-sky radiation for cloud impact. |
| `FLRATHE_CC` | `strc` | `J m-2` | Surface net long-wave radiation, clear sky. | Can compare against all-sky radiation. |
| `USTR` | `iews` | `N m-2` | Instantaneous eastward turbulent surface stress. | Specialist field; vector pairing with `VSTR`. |
| `VSTR` | `inss` | `N m-2` | Instantaneous northward turbulent surface stress. | Specialist field; vector pairing with `USTR`. |

## Isobaric Packages

Isobaric packages use pressure levels rather than ground-relative height. They are powerful for expert meteorological analysis but require a level selector and careful memory/download strategy.

The official pressure levels are `100` to `1000 hPa`, 24 levels, unless noted otherwise.

### IP1

| Official parameter | Observed GRIB name | Levels | Unit | Description |
| --- | --- | --- | --- | --- |
| `T` | `t` | 24 isobaric levels | `K` | Temperature. |
| `HU` | `r` | 24 isobaric levels | `%` | Relative humidity. |
| `U` | `u` | 24 isobaric levels | `m s-1` | Zonal wind component. |
| `V` | `v` | 24 isobaric levels | `m s-1` | Meridional wind component. |
| `Z` | `z` | 24 isobaric levels | `m2 s-2` | Geopotential. Convert to geopotential height with `z / g0` if needed. |

### IP2

| Official parameter | Observed GRIB name | Levels | Unit | Description |
| --- | --- | --- | --- | --- |
| `CLD_WATER` | `clwc` | 24 isobaric levels | `kg kg-1` | Specific cloud liquid water content. |
| `CLD_RAIN` | `crwc` | 24 isobaric levels | `kg kg-1` | Specific rain water content. |
| `CLD_SNOW` | `cswc` | 24 isobaric levels | `kg kg-1` | Specific snow water content. |
| `CIWC` | `ciwc` | 24 isobaric levels | `kg kg-1` | Specific cloud ice water content. |
| `CLD_FRACT` | `cc` | 24 isobaric levels | `0..1` | Fraction of cloud cover. |

### IP3

| Official parameter | Observed GRIB name | Levels | Unit | Description |
| --- | --- | --- | --- | --- |
| `TD` | `dpt` | 24 isobaric levels | `K` | Dew point temperature. |
| `Q` | `q` | 24 isobaric levels | `kg kg-1` | Specific humidity. |
| `DD` | `wdir` | 24 isobaric levels | degrees true | Wind direction. |
| `FF` | `ws` | 24 isobaric levels | `m s-1` | Wind speed. |
| `VV` | `w` | 24 isobaric levels | `Pa s-1` | Pressure vertical velocity. |
| `VV2` | `wz` | 24 isobaric levels | `m s-1` | Geometric vertical velocity. |
| `TP` | `pv` | 24 isobaric levels | `K m2 kg-1 s-1` | Potential vorticity. |

### IP4

| Official parameter | Observed GRIB name | Levels | Unit | Description |
| --- | --- | --- | --- | --- |
| `TKE` | `tke` | 24 isobaric levels | `J kg-1` | Turbulent kinetic energy. |
| `RFLCTVT` | `unknown` in meteofetch | 16 isobaric levels, `200..925 hPa` | unknown | Radar reflectivity diagnostic. |

### IP5

| Official parameter | Observed GRIB name | Levels | Unit | Description |
| --- | --- | --- | --- | --- |
| `TA` | `vo` | `300`, `500`, `600`, `700`, `850 hPa` | `s-1` | Relative vorticity. |
| `TB` | `absv` | `300`, `500`, `600`, `700`, `850 hPa` | `s-1` | Absolute vorticity. |
| `THETAPW` | `papt` | 20 isobaric levels, `200..1000 hPa` | `K` | Pseudo-adiabatic potential temperature. |
| `U` on `ISO_TP` | `u` | potential-vorticity levels `2000`, `1500` | `m s-1` | U wind on potential-vorticity levels. |
| `V` on `ISO_TP` | `v` | potential-vorticity levels `2000`, `1500` | `m s-1` | V wind on potential-vorticity levels. |
| `Z` on `ISO_TP` | `z` | potential-vorticity levels `2000`, `1500` | `m2 s-2` | Geopotential on potential-vorticity levels. |

## Height Packages

Height packages use meters above model relief. They are useful for wind profiles, low-level structure, aviation-style inspection, and boundary-layer analysis, but they are large.

### HP1

The official HP1 package contains `T`, `HU`, `U`, `V`, `DD`, `FF`, `P`, and `Z` on 24 levels from `20` to `3000 m`.

meteofetch reports common decoded products including:

| Observed GRIB name | Levels / dimensions | Unit | Description |
| --- | --- | --- | --- |
| `ws` | 22 height levels | `m s-1` | Wind speed. |
| `u` | 22 height levels | `m s-1` | U wind component. |
| `v` | 22 height levels | `m s-1` | V wind component. |
| `pres` | 25 height levels | `Pa` | Pressure at height above ground. |
| `t` | 25 height levels | `K` | Temperature. |
| `r` | 25 height levels | `%` | Relative humidity. |
| `u10`, `v10`, `si10`, `wdir10` | 2D fields | `m s-1` / degrees true | Explicit 10 m wind fields included in decoded output. |
| `u100`, `v100`, `si100` | 2D fields | `m s-1` | Explicit 100 m wind fields. |
| `u200`, `v200`, `si200` | 2D fields | `m s-1` | Explicit 200 m wind fields. |
| `wdir` | 24 height levels | degrees true | Wind direction. |

The mismatch between official 24 levels and decoded 22/25-level shapes must be verified on real GRIB metadata before exposing HP1 as a stable UI feature.

### HP2

Official HP2 contains `Z` on 24 levels and `TKE`, hydrometeors, cloud fraction, `TD`, and `Q` on 25 levels from `10` to `3000 m`.

| Observed GRIB name | Unit | Description |
| --- | --- | --- |
| `z` | `m2 s-2` | Geopotential. |
| `tke` | `J kg-1` | Turbulent kinetic energy. |
| `clwc` | `kg kg-1` | Specific cloud liquid water content. |
| `crwc` | `kg kg-1` | Specific rain water content. |
| `cswc` | `kg kg-1` | Specific snow water content. |
| `ciwc` | `kg kg-1` | Specific cloud ice water content. |
| `cc` | `0..1` | Fraction of cloud cover. |
| `dpt` | `K` | Dew point temperature. |
| `q` | `kg kg-1` | Specific humidity. |

### HP3

| Official parameter | Observed GRIB name | Levels | Description |
| --- | --- | --- | --- |
| `RFLCTVT` | `unknown` in meteofetch | `500`, `750`, `1000`, `1500`, `2000`, `2500`, `3000 m` | Radar reflectivity diagnostic on height levels. |

## Pressure and Isobars

AROME 0.025 SP1 provides `P(mer)` / `prmsl`, which is the correct field for classic synoptic isobars. This is the main reason AROME 0.025 is valuable alongside AROME 0.01.

| Field | Package | Meaning | App decision |
| --- | --- | --- | --- |
| `prmsl` / `P(mer)` | `SP1` | Pressure reduced to mean sea level | Use for isobars. |
| `sp` / `P(sol)` | `SP2` | Surface pressure tied to model relief | Display as surface pressure only; do not use for synoptic isobars. |
| `pres` / `P` on height levels | `HP1` | Pressure at explicit height above ground | Expert vertical analysis only. |

## Temporal Semantics

- Instantaneous fields commonly have `52` forecast steps (`H+00..H+51`).
- Accumulated and maximum-over-period fields commonly have `51` forecast steps because `H+00` is not meaningful.
- Grouped files mix 6 or 7 forecast hours per block. The app must index individual messages by forecast hour, variable, level, and statistical-processing metadata.
- Accumulated fields such as precipitation and radiation should not be labelled as rates unless converted using the exact interval.
- Statistical fields such as `TMIN(2m)`, `TMAX(2m)`, gust maxima, and time-integrated fluxes require product/statistical metadata to avoid collisions with instantaneous variables that share the same short name.

## Recommended App Adoption

### Phase 1: Add `AROME_0025_SP1`

Purpose: clean isobars and a compact advanced surface package.

Suggested variables:

- `prmsl` as mean sea-level pressure with isobars.
- `t2m`, `r2`.
- `u10`, `v10`, `si10`, `wdir10`.
- `max_i10fg`, optionally `efg10`/`nfg10`.
- `tp`, `tsnowp`, `tgrp`, if we want lower-resolution accumulated precipitation as a comparison layer.
- `ssrd`, if we want solar radiation.

### Phase 2: Add `AROME_0025_SP2`

Purpose: boundary-layer and moisture diagnostics.

Suggested variables:

- `blh`.
- `d2m`, `sh2`.
- `sp`, clearly labelled as surface pressure.
- `lcc`, `mcc`, `hcc`, `CAPE_INS`.
- `h` as model relief/context.

### Phase 3: Decide on Expert Vertical UI

Do not add `IP*` or `HP*` packages as simple flat package buttons. They require:

- a level selector,
- variable identity based on level and statistical metadata,
- careful memory/download warnings,
- possibly selective file/level extraction rather than full package loading.

## Implementation Checklist for Data Correctness

- Add package metadata using the dataset ID `65bd12d7bfd26e26804204cb`.
- Extend filename parsing to grouped AROME files if the current ARPEGE grouped-file logic is not generic enough.
- Index messages by `{forecastHour, shortName, level type, level value, statistical processing}`.
- Treat `prmsl` and `sp` as distinct pressure fields.
- Generate isobars only from `prmsl`.
- Convert pressure `Pa -> hPa` for display.
- Convert temperature `K -> °C` for display.
- Keep accumulated/time-integrated fields as totals unless interval-aware rate conversion is implemented.
- Avoid exposing vertical packages until the UI can represent levels cleanly.

## Open Questions

- Which exact SP1 unknown field corresponds to official `NEBUL` in current files?
- Which exact SP3 unknown field corresponds to official `COLONNE_VAPO` or `FLEVAP`?
- How should the app label and convert time-integrated radiation/flux variables: accumulated energy (`J m-2`) or interval mean flux (`W m-2`)?
- Should AROME 0.025 be presented as a separate model section, or as an "Advanced AROME" group under AROME?
- Do we want AROME 0.025 SP1 isobars overlaid on AROME 0.01 maps, or only displayed inside AROME 0.025 products?
