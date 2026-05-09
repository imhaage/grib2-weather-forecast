# CLAUDE.md — GRIB2 Decoder

## Projet

Décodeur GRIB2 (édition 2) en JavaScript pur, compatible navigateur et Node.js.
Basé sur la spec WMO FM-92 GRIB Edition 2. Décompression CCSDS via WebAssembly (libaec).

**Fichier de test :** `packages/grib2-decoder/test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2` (~24 MB, AROME, Météo-France)

**État :** Entièrement fonctionnel — 115 tests passent, décodage CCSDS/JPEG2000 validé sur données réelles.
Supporte DRT 0 (simple packing), DRT 2/3 (complex packing + spatial differencing, ICON-D2/GFS),
DRT 40 (JPEG 2000, OpenJPEG WASM), DRT 42 (CCSDS, AROME/ARPEGE), DRT 254 (IEEE 754).

## Structure de la documentation

- `docs/decoder.md` — Modules src/, format GRIB2, API publique
- `docs/frontend.md` — Application web (index.html)
- `docs/cli.md` — Outils CLI et scripts npm
- `docs/external-resources.md` — Spécifications WMO et références externes

## Language

All generated content in this project must be in **English**: variable names, function names, comments, UI text, descriptions, commit messages.

## Commandes utiles

```bash
npm test                                          # 115 tests (runs in packages/grib2-decoder)
npm run build                                     # build decoder → packages/grib2-decoder/dist/
npm run info -- <file.grib2>                      # rapport métadonnées
npm run export -- <file.grib2> --variable <name>  # export CSV
npm run serve                                     # serveur local → http://localhost:3000/apps/visualize/
```
