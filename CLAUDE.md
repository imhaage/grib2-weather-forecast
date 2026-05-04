# CLAUDE.md — GRIB2 Decoder

## Projet

Décodeur GRIB2 (édition 2) en JavaScript pur, compatible navigateur et Node.js.
Basé sur la spec WMO FM-92 GRIB Edition 2. Décompression CCSDS via WebAssembly (libaec).

**Fichier de test :** `test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2` (~24 MB, AROME, Météo-France)

**État :** Entièrement fonctionnel — 93 tests passent, décodage CCSDS validé sur données réelles.

## Structure de la documentation

- `docs/decoder.md` — Modules src/, format GRIB2, API publique
- `docs/frontend.md` — Application web (index.html)
- `docs/cli.md` — Outils CLI et scripts npm
- `docs/external-resources.md` — Spécifications WMO et références externes

## Language

All generated content in this project must be in **English**: variable names, function names, comments, UI text, descriptions, commit messages.

## Commandes utiles

```bash
npm test                                          # 93 tests
npm run info -- <file.grib2>                      # rapport métadonnées
npm run export -- <file.grib2> --variable <name>  # export CSV
npm run serve                                     # serveur local
```
