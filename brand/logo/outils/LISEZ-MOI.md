# Outils du logo

Scripts maison utilisés à la place de ceux du skill `logo-design`, dont l'exécution
était bloquée dans la session cloud. Python 3 + `fonttools`, `shapely`, `numpy`,
`Pillow` ; rendu avec le Chromium de Playwright (`node`).

| Script | Rôle |
|---|---|
| `concepts.py` | Les trois concepts en arcs exacts : symboles + lockups (`python3 concepts.py v5`) |
| `audit.py` | Audit SVG : texte vivant, rasters, filtres, couleurs, emprise, centrage, topologie 32/16 px |
| `planche.py` | Planche de test : tailles réelles, pixels 16/32, fonds, inversé, flou, miroir, icônes, étagère |
| `comparer.py` | Planche compacte pour comparer des variantes |
| `planche_concepts.py` | Planche du point d'étape (`concepts.png`) |
| `render.js` | SVG → PNG et capture HTML |
| `glyphs.py`, `svgkit.py`, `geo.py` | Contours de police, briques géométriques, booléens d'exploration |

La police (DM Sans Bold, licence SIL OFL) n'est pas versionnée : la télécharger depuis
Google Fonts et passer son chemin dans la variable `DP_FONT`.
