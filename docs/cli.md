# Outils CLI

## Scripts npm

```bash
npm test                                                        # 115 tests (délègue à packages/grib2-decoder)
npm run build                                                   # build decoder → packages/grib2-decoder/dist/
npm run info  -- <file.grib2> [output.txt]                      # rapport métadonnées
npm run export -- <file.grib2> --variable <shortName> [out.csv] # export CSV
npm run serve                                                   # npx serve . → http://localhost:3000/apps/visualize/ (via serve.json)
```

---

## grib2-info.js

Rapport textuel des métadonnées d'un fichier GRIB2 (sections 0–7).
N'invoque pas le WASM, ne décode pas les valeurs.

```bash
npm run info -- <file.grib2>             # stdout (depuis la racine)
npm run info -- <file.grib2> meta.txt   # vers un fichier
# ou directement :
node packages/grib2-decoder/grib2-info.js <file.grib2>
```

Sections couvertes : indicateur, identification, définition de grille,
représentation des données, bitmap, taille compressée/non-compressée.

Importe les tables WMO et helpers depuis `grib2-decoder` (via `src/wmo-tables.js`).

---

## grib2-export.js

Liste les variables d'un fichier ou exporte une variable en CSV.

```bash
# Lister les variables
npm run export -- <file.grib2>
# ou : node packages/grib2-decoder/grib2-export.js <file.grib2>

# Stats + preview (sans écriture)
npm run export -- <file.grib2> --variable t

# Export CSV (lat,lon,value)
npm run export -- <file.grib2> --variable t output.csv
```

Format CSV : `lat,lon,value` — une ligne par point valide (points manquants omis).

Utilise `iterateGRIB2Messages()` pour lister, `decodeGRIB2()` pour décoder,
`computeStats()` pour les stats, `indexToLatLon()` pour les coordonnées.

---

## serve.json

Fichier de configuration pour `npx serve` (Vercel) situé à la racine. Redirige `/` vers
`/apps/visualize/` afin qu'`npm run serve` ouvre directement l'application au lieu
d'afficher un listing de fichiers. Miroir local du redirect défini dans `netlify.toml`.
