# AROME 0.01 Reference

This document is the project source of truth for Météo-France AROME 0.01° open-data packages used by the visualizer.

Last reviewed: 2026-05-19.

## Sources

- [data.gouv.fr — Paquets Arome - Résolution 0,01°](https://www.data.gouv.fr/fr/datasets/paquets-arome-resolution-0-01deg/)
- [Météo-France technical description — AROME packages, 2025-04-01](https://www.data.gouv.fr/api/1/datasets/r/3aa3ce62-1f69-4ea1-8157-a53eac61c6bb)
- [Météo-France parameter glossary — ARPEGE/AROME](https://www.data.gouv.fr/api/1/datasets/r/eac02578-f1f1-47b0-a01b-0ae4b1eee2b8)
- [Météo-France — Weather forecast models](https://meteofrance.com/modeles-prevision-meteo)
- [meteofetch Arome001 table](https://meteofetch.readthedocs.io/fr/latest/arome.html#arome001), used as a practical cross-check for GRIB names, dimensions, and run shapes.

## Model Overview

AROME is Météo-France's high-resolution limited-area model for metropolitan France and surrounding seas. Météo-France describes AROME as covering mainland France and Corsica with a 1.3 km mesh, intended for detailed short-range forecasts.

The public AROME 0.01° package dataset provides hourly GRIB2 files on the EURW1S100 grid. It is not the complete native model state; it is a curated set of public packages.

## Dataset

| Item | Value |
| --- | --- |
| Dataset | `Paquets Arome - Résolution 0,01°` |
| Current app dataset ID | `65bd1247a6238f16e864fa80` |
| Producer | Météo-France |
| License | Licence Ouverte / Open Licence 2.0 |
| Format | GRIB2, CCSDS compressed (`grid_ccsds`) |
| Forecast runs | `00`, `03`, `06`, `09`, `12`, `15`, `18`, `21` UTC |
| Forecast range | `H+00` to `H+51`, hourly |
| Public file layout | 51 hourly files per package/run for AROME 0.01° |

## Grid

| Item | Value |
| --- | --- |
| Grid name | `EURW1S100` |
| Resolution | `0.01°`, about 1.3 km |
| Domain | `55.4N` to `37.5N`, `12W` to `16E` |
| Expected dimensions | `2801 x 1791` lon/lat points |
| Full run shape for 2D fields | commonly `(52, 1791, 2801)` when `H+00..H+51` exists |

Important: since 2019, Météo-France states that native AROME grids on this domain are trapezoidal, while GRIB stores rectangular grids. A significant number of missing values is therefore expected. Missing values can differ by parameter, so multi-parameter GRIB files must be handled parameter by parameter.

Visualization consequences:

- Missing values must remain transparent/neutral and must not be included in min/max, contours, interpolation, or tooltip statistics.
- The map domain should fit `[-12, 37.5]` to `[16, 55.4]`.
- Any pixel-to-map overlay must use the actual grid corners and handle north-to-south scanning.

## Package Summary

### AROME 0.01 Surface Packages

| Package | Official content | Approx. file size | App status |
| --- | --- | ---: | --- |
| `SP1` | 10 m wind components, 10 m gust components, 2 m temperature, 2 m relative humidity | 23 MB/hour | Used |
| `SP2` | rain, snow, graupel, surface pressure, cloud cover, CAPE, max reflectivity | 23 MB/hour | Used partially |
| `SP3` | constant altitude, brightness temperature | 4 MB/hour | Not used |

### AROME 0.01 Height Package

| Package | Official content | Approx. file size | App status |
| --- | --- | ---: | --- |
| `HP1` | humidity, U wind, V wind on 10, 20, 50, and 100 m height levels | 70 MB/hour | Used experimentally / needs re-check |

## Variables

The tables below use the official Météo-France package definitions first. `Observed GRIB name` comes from meteofetch and/or current decoder observations. Some GRIB short names can vary depending on the decoding table; prefer product discipline/category/number and level metadata when adding robust support.

### SP1

| Official parameter | Observed GRIB name | Level | Unit | Temporal type | Description | Visualization notes |
| --- | --- | --- | --- | --- | --- | --- |
| `U(10m)` | `u10` / app `u` | 10 m above model relief | `m s-1` | Instantaneous | Zonal wind component at 10 m. Positive values represent eastward flow in GRIB convention. | Combine with `V(10m)` for wind speed/direction. Convert speed to km/h only for display if desired. |
| `V(10m)` | `v10` / app `v` | 10 m above model relief | `m s-1` | Instantaneous | Meridional wind component at 10 m. Positive values represent northward flow in GRIB convention. | Combine with `U(10m)`. |
| `U_RAF(10m)` | `efg10` / app `ugust` | 10 m above model relief | `m s-1` | Maximum over previous hour | Eastward component of maximum 10 m wind gust. | `H+00` is usually absent for max-over-period fields; app currently skips hour 0 for AROME packages. |
| `V_RAF(10m)` | `nfg10` / app `vgust` | 10 m above model relief | `m s-1` | Maximum over previous hour | Northward component of maximum 10 m wind gust. | Combine with `U_RAF(10m)` for gust intensity/direction. |
| `T(2m)` | `t2m` / app `t` | 2 m above model relief | `K` | Instantaneous | 2 m diagnostic air temperature, comparable with near-surface station observations. | Display as Celsius: `K - 273.15`. |
| `HU(2m)` | `r2` / app `r` | 2 m above model relief | `%` | Instantaneous | 2 m relative humidity. Météo-France defines relative humidity against saturation over liquid water, even below 0 °C. | Keep as `%`, usually `0..100`. |

### SP2

| Official parameter | Observed GRIB name | Level | Unit | Temporal type | Description | Visualization notes |
| --- | --- | --- | --- | --- | --- | --- |
| `EAU` | `tirf` / app `rrate` after increment transform | Ground surface | `kg m-2` cumulative | Accumulated | Liquid precipitation from stratiform and convective processes since run start. | For hourly rain rate, compute `H[n] - H[n-1]`; `1 kg m-2` equals about `1 mm` of water. |
| `NEIGE` | `tsnowp` / app `srate` after increment transform | Ground surface | `kg m-2` cumulative | Accumulated | Snowfall accumulation since run start. | For hourly snow precipitation, compute `H[n] - H[n-1]`. Treat as liquid-water equivalent unless another conversion is explicitly documented. |
| `GRAUPEL` | `tgrp` | Ground surface | `kg m-2` cumulative | Accumulated | Graupel / snow-pellet precipitation accumulation. For AROME, total precipitation includes rain + snow + graupel. | For hourly graupel rate, compute `H[n] - H[n-1]`. |
| `P(sol)` | `sp` / app `p` | Model surface | `Pa` | Instantaneous | Surface pressure used as a model prognostic variable. It is tied to the model internal relief, not sea-level pressure. | Display as hPa: `Pa / 100`. Do not use for classic synoptic isobars. |
| `NEBBAS` | `lcc` | Ground surface diagnostic | `%` | Instantaneous or post-processed over step | Low cloud cover. Météo-France defines it using combined cloud fractions at pressure levels above 785 hPa, typically below about 2500 m above model relief. | Use a `0..100%` scale. |
| `NEBHAU` | `hcc` | Ground surface diagnostic | `%` | Instantaneous or post-processed over step | High cloud cover. Defined from cloud fractions at pressure levels below 450 hPa, typically above about 5000 m. | Use a `0..100%` scale. |
| `NEBMOY` | `mcc` | Ground surface diagnostic | `%` | Instantaneous or post-processed over step | Medium cloud cover. Defined from cloud fractions between 785 and 450 hPa, typically about 2500 to 5000 m. | Use a `0..100%` scale. |
| `CAPE_INS` | `CAPE_INS` / app `cape` | Surface-based diagnostic | `J kg-1` / `m2 s-2` | Instantaneous | Most Unstable CAPE: maximum convective available potential energy computed in the first 3000 m above ground. | Values can be zero over broad areas; keeping zero visible can make maps easier to read. |
| `RFLCTVT_MAX(sol)` | observed as unknown in meteofetch | Ground surface / max reflectivity diagnostic | unknown in public table | Time maximum / diagnostic | Maximum radar reflectivity diagnostic from model hydrometeors. | Not currently supported; needs real-message inspection before UI exposure. |

Pressure warning: `P(sol)` is not `P(mer)`. Météo-France defines `P(mer)` as pressure reduced to conventional sea level, while `P(sol)` is the model surface pressure tied to model relief. Classical weather-map isobars should use `P(mer)` / mean sea-level pressure, not `P(sol)`.

### SP3

| Official parameter | Observed GRIB name | Level | Unit | Temporal type | Description | Visualization notes |
| --- | --- | --- | --- | --- | --- | --- |
| `ALTITUDE` | `h` | Ground/model relief | `m` | Constant field | Geometric height of the model relief. Météo-France notes this relief can differ from other orographic references. | Useful for debugging pressure/topography effects and missing-value masks. |
| `BT` | unknown in meteofetch | Channel level `CANAUX 108` | `K` | Instantaneous | Brightness temperature. | Not currently supported; requires product metadata inspection. |

### HP1

The official 0.01° technical description says HP1 contains `HU`, `U`, and `V` on height levels `10`, `20`, `50`, and `100 m`.

meteofetch reports a practical decoded table with some fields split between explicit 2D short names and multi-level height dimensions. This needs direct GRIB inspection before expanding app support.

| Official parameter | Observed GRIB name | Levels | Unit | Temporal type | Description | Visualization notes |
| --- | --- | --- | --- | --- | --- | --- |
| `HU` | `r` | 10, 20, 50, 100 m above model relief | `%` | Instantaneous | Relative humidity at height levels. | Multi-level variable; UI must distinguish levels. |
| `U` | `u`, plus possible `u10`, `u100` aliases | 10, 20, 50, 100 m above model relief | `m s-1` | Instantaneous | Zonal wind component at height levels. | Prefer U/V source fields for derived wind speed/direction. |
| `V` | `v`, plus possible `v10`, `v100` aliases | 10, 20, 50, 100 m above model relief | `m s-1` | Instantaneous | Meridional wind component at height levels. | Prefer U/V source fields for derived wind speed/direction. |
| Derived `FF` / speed | `ws`, `si10`, `si100` in meteofetch | 10, 20, 50, 100 m may not all be present as direct fields | `m s-1` | Instantaneous | Wind speed, either directly provided or derived from U/V depending on GRIB product. | App should not assume all levels exist until real-message metadata confirms it. |
| Derived `DD` / direction | `wdir`, `wdir10` in meteofetch | 10, 20, 50, 100 m may not all be present as direct fields | degrees true | Instantaneous | Wind direction, either directly provided or derived from U/V depending on GRIB product. | Direction palettes need circular handling; a linear palette around `0/360` can be misleading. |

## Pressure and Isobars

For this visualizer, pressure fields must be treated as separate meteorological concepts:

| Concept | Météo-France name | Meaning | App decision |
| --- | --- | --- | --- |
| Local pressure | `P` | Pressure at the considered vertical level. | Display only when level is explicit. |
| Mean sea-level pressure | `P(mer)` | Pressure reduced from model relief to conventional sea level. | Correct source for synoptic isobars. |
| Surface pressure | `P(sol)` | Model surface pressure prognostic variable tied to internal model relief. | Display as surface pressure, but do not draw synoptic isobars from it. |

Current implication: AROME 0.01° public `SP2` provides `P(sol)`, not `P(mer)`. Therefore AROME 0.01° SP2 cannot currently provide meteorologically standard sea-level isobars. If the UI needs isobars for France, use a package/model that contains `P(mer)` / `prmsl` / `msl`, or add a clearly labelled non-standard surface-pressure contour mode.

## Temporal Semantics

Fields are not all equivalent over time:

- Instantaneous fields can be displayed at their forecast hour directly.
- Maximum-over-period fields such as gust components represent a maximum over the preceding post-processing interval, generally one hour.
- Accumulated precipitation fields represent cumulative totals since the start of the simulation. For hourly visualization, compute an increment between consecutive forecast hours.
- Some accumulated or max fields naturally have no meaningful `H+00`, which explains `(51, 1791, 2801)` shapes instead of `(52, 1791, 2801)`.

## Current App Coverage

| Package | Current app variables | Notes |
| --- | --- | --- |
| `AROME_SP1` | `t`, `r`, `u`, `v`, `ugust`, `vgust` | Matches the useful SP1 subset. |
| `AROME_SP2` | `p`, `cape`, `lcc`, `mcc`, `hcc`, `tgrp`, `rrate`, `srate` | `p` is surface pressure. `rrate`, `srate`, and `tgrp` are display rates derived from cumulative fields. |
| `AROME_HP1` | wind speed/direction at selected heights | Needs direct metadata verification against current public files. Official package says `HU`, `U`, `V`; app currently exposes derived wind speed/direction concepts. |

## Implementation Checklist for Data Correctness

- Keep package metadata separate from visual styling.
- Identify variables by GRIB product metadata plus level, not only `shortName`.
- Treat `P(sol)` and `P(mer)` as different variables.
- Generate classic isobars only from mean sea-level pressure.
- Preserve missing-value masks through rendering, statistics, contours, and tooltips.
- For precipitation, store/display both source accumulation and derived hourly increment semantics.
- For wind speed/direction, prefer deriving from U/V when the source fields are available and clearly level-matched.
- For direction fields, use circular color/legend logic instead of a normal linear scalar palette.
- Re-check HP1 against real files before making it a stable UI feature.

## Open Questions

- Does current AROME 0.01° HP1 expose direct `ws`/`wdir` products consistently, or should the app derive speed/direction from U/V at all levels?
- What is the exact GRIB identity of `RFLCTVT_MAX(sol)` in current files?
- Is there a current public 0.01° package containing `P(mer)`? The official 2025 package description does not list it for AROME 0.01°.
- Should `H+00` be shown when available for instantaneous fields, while disabled only for accumulated/max fields?
