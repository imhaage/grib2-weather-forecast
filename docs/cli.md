# CLI tools

## npm scripts

```bash
npm test                                                        # 115 tests (delegates to packages/grib2-decoder)
npm run build                                                   # build decoder → packages/grib2-decoder/dist/
npm run info  -- <file.grib2> [output.txt]                      # metadata report
npm run export -- <file.grib2> --variable <shortName> [out.csv] # CSV export
npm run serve                                                   # npx serve . → http://localhost:3000/apps/visualize/ (via serve.json)
```

---

## grib2-info.js

Textual metadata report for a GRIB2 file (sections 0–7).
Does not invoke WASM, does not decode values.

```bash
npm run info -- <file.grib2>             # stdout (from repo root)
npm run info -- <file.grib2> meta.txt   # to a file
# or directly:
node packages/grib2-decoder/grib2-info.js <file.grib2>
```

Sections covered: indicator, identification, grid definition,
data representation, bitmap, compressed/uncompressed size.

Imports WMO tables and helpers from `grib2-decoder` (via `src/wmo-tables.js`).

---

## grib2-export.js

Lists variables in a file or exports a variable to CSV.

```bash
# List variables
npm run export -- <file.grib2>
# or: node packages/grib2-decoder/grib2-export.js <file.grib2>

# Stats + preview (no file written)
npm run export -- <file.grib2> --variable t

# CSV export (lat,lon,value)
npm run export -- <file.grib2> --variable t output.csv
```

CSV format: `lat,lon,value` — one line per valid point (missing points omitted).

Uses `iterateGRIB2Messages()` to list, `decodeGRIB2()` to decode,
`computeStats()` for stats, `indexToLatLon()` for coordinates.

---

## serve.json

Configuration file for `npx serve` (Vercel) at the repository root. Redirects `/` to
`/apps/visualize/` so that `npm run serve` opens the application directly instead of
showing a file listing.
