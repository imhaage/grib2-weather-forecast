# Validation croisée — décodeur JS vs eccodes

## Pourquoi cette approche

Comparer les valeurs décodées contre des données téléchargées depuis une API
ne valide pas le décodeur : ce serait comparer deux instants ou deux runs différents.

**eccodes** (ECMWF) est l'implémentation de référence du format GRIB2. Si notre
décodeur produit exactement les mêmes valeurs qu'eccodes sur le même fichier,
c'est la preuve la plus solide possible de l'exactitude du décodage.

---

## Ce que les autres tests ne couvrent pas

Les 98 tests unitaires vérifient :
- le parsing des sections 0–5 (en-têtes, grille, représentation)
- la formule de décompression CCSDS : min = R, max cohérent avec 16 bits
- les plages physiques plausibles (température entre 254 K et 320 K)

Ils ne vérifient **pas** :
- l'exactitude valeur par valeur
- l'application correcte du bitmap (un décalage d'un point serait invisible)
- la fidélité de la décompression CCSDS sur chaque valeur individuelle

---

## Architecture du test

### Fixture (`packages/grib2-decoder/test/fixtures/arome_t_ref.json`)

Généré une seule fois via `npm run make-fixture -w packages/grib2-decoder` (requiert `brew install eccodes`),
puis commité. Les tests n'ont pas besoin d'eccodes pour s'exécuter.

Le script `packages/grib2-decoder/test/generate-fixture.js` :

1. Lit les paramètres de grille depuis notre propre décodeur (`parseGRIB2Header`) :
   `ni`, `la1`, `lo1`, `di`, `dj`.
2. Appelle `grib_get_data -w shortName=T <file> | head -n 501` (eccodes).
3. Parse les 500 premières lignes valides (format : `Latitude  Longitude  Value`).
4. Calcule l'index flat dans la grille à partir du (lat, lon) eccodes :

```js
row = Math.round((la1 - lat) / dj)
col = Math.round((lon  - lo1) / di)
idx = row * ni + col
```

5. Écrit 500 objets `{ idx, lat, lon, val }` dans le fixture.

### Test (`packages/grib2-decoder/test/cross-decode.test.js`)

Pour chaque point du fixture :
```
|values[idx] - val| < 1e-3 K
```

---

## Points de vigilance

### `grib_get_data` saute les points manquants

La valeur sentinelle GRIB2 (`9.999e+20`) est un float fini ; un filtre
`!isFinite()` ne la détecterait pas. Mais eccodes omet silencieusement
les points masqués par le bitmap dans sa sortie — on ne les voit jamais.

Conséquence : le premier point du fixture est à `idx=4054`
(`lat=55.39, lon=0.53`), pas à `idx=0`. Les ~4053 premiers points de la
grille (haut-gauche du domaine, au-dessus de l'Atlantique) sont masqués.

### Dépendance circulaire partielle

L'index est calculé à partir de nos propres paramètres de grille (`la1`, `lo1`,
`di`, `dj`). Si notre parsing de la section 3 était incorrect, les indices
seraient décalés et les valeurs ne correspondraient pas. Le fait que le test
passe (diff = 4.1e-9 K) valide donc aussi indirectement le parsing de la
section 3 et de la grille.

### Couverture

500 points sur ~5 M (0.01 %), tous dans la zone en haut du domaine (scan
linéaire). L'échantillonnage n'est pas aléatoire, mais couvre la décompression
CCSDS et la formule de dépaquetage `Y = (R + X × 2^E) × 10^(-D)` sur un
ensemble de valeurs réelles.

---

## Résultats

```
max diff vs eccodes: 4.10e-9 K   (tolérance : 1e-3 K)
```

La différence est de l'ordre du bruit d'arrondi float64. En théorie, la
précision théorique est limitée par le float32 utilisé pour `R` et le step
de quantification `2^E ≈ 9.77e-4 K` (binary scale −10) ; en pratique les
deux décodeurs appliquent la même formule et arrivent au même résultat.

---

## Régénérer le fixture

```bash
brew install eccodes   # une seule fois
npm run make-fixture -w packages/grib2-decoder
```

Le fichier `packages/grib2-decoder/test/fixtures/arome_t_ref.json` est commité dans le dépôt.
`npm test` n'a pas besoin d'eccodes.
