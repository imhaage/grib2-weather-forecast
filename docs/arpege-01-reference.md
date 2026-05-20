# ARPEGE 0.1 Reference

This document records the ARPEGE 0.1 package metadata used by the visualizer.
It is based on direct inspection of current public Météo-France `ARPEGE_SP1`
GRIB2 files from data.gouv.fr.

## Package

| Package | Content used by the app | File layout | App status |
| --- | --- | --- | --- |
| `SP1` | 2 m temperature and relative humidity, 10 m wind, mean sea-level pressure, total cloud cover | 9 multi-hour blocks, `H+000` to `H+102` | Used |

ARPEGE SP1 files are grouped by forecast-hour ranges, for example
`000H012H`, `013H024H`, and so on. The app expands those blocks into a flat
forecast-hour list for the slider.

## Variables Used

| App variable | GRIB short name | Level | Source unit | Display unit | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Temperature (2m)` | `t` | 2 m above ground | `K` | `°C` | Weather maps | Display as Celsius: `K - 273.15`. |
| `Relative humidity (2m)` | `r` | 2 m above ground | `%` | `%` | Weather maps | Direct 2 m humidity field. |
| `U (wind, 10m)` | `u` | 10 m above ground | `m s-1` | `m s-1` | Component fields | Zonal wind component. |
| `V (wind, 10m)` | `v` | 10 m above ground | `m s-1` | `m s-1` | Component fields | Meridional wind component. |
| `Mean sea-level pressure` | `msl` | Mean sea level | `Pa` | `hPa` | Weather maps | Correct source for synoptic isobars. Display as `Pa / 100`. |
| `Total cloud cover (column)` | `tcc` | Ground-surface diagnostic | `%` | `%` | Weather maps | Represents total sky/cloud-column cover, not an altitude-specific cloud layer. |
| `Wind speed (10m)` | `wspd` | 10 m above ground | `m s-1` | `km/h` | Weather maps | Display as `m s-1 * 3.6`. |
| `Wind direction (10m)` | `wdir` | 10 m above ground | degrees true | `°` | Weather maps | Direction fields need circular color/legend handling before they are meteorologically ideal. |

## Verified Extra Fields

Direct inspection of `arpege__01__SP1__000H012H__2026-05-20T00:00:00Z.grib2`
also showed these decoded fields:

- `gust`, `ugust`, and `vgust` at 10 m.
- `rrate` and `srate` at ground surface.
- `dswrf` at ground surface.
- Several currently unknown parameters.

These fields are not exposed yet. The main reason is temporal semantics:
several are PDT 4.8 interval fields inside multi-hour ARPEGE blocks. The app
should not expose them until effective forecast time and interval handling are
explicitly verified for ARPEGE range blocks.

## Implementation Notes

- `msl` is the ARPEGE pressure field used for isobars.
- `tcc` is labelled as a column/total-cover diagnostic in the UI, even though
  the GRIB level is ground surface.
- U/V remain component fields because they are useful for calculations but less
  directly readable than wind speed and direction maps.
- Precipitation and gust interval fields should be added only after validating
  their forecast-hour mapping across all ARPEGE SP1 blocks.
