# Mise à jour des données

Un seul script : `update_data.py` (Python 3, aucune dépendance).

| Commande | Effet |
|---|---|
| `python scripts/update_data.py check` | Compare `src/data/*.json` aux références. Code retour 1 s'il y a un écart. |
| `python scripts/update_data.py apply` | Montre les corrections à faire, sans rien écrire. |
| `python scripts/update_data.py apply --write` | Applique les corrections (originaux copiés dans `src/data/_backup_AAAA-MM-JJ/`). |
| `python scripts/update_data.py report` | État des lieux : recettes « gabarits », Aniimo sans référence, graines vérifiées. |

Équivalents npm : `npm run data:check`, `npm run data:apply`, `npm test`.

## Quand le jeu change

1. Mettez à jour le ou les fichiers de `scripts/reference/` (chaque fichier indique sa source et sa date de vérification).
2. `python scripts/update_data.py apply --write`
3. `npm test` pour s'assurer que rien n'est incohérent.

## Références

- `aniimo_elements.json` : élément(s) de chaque Aniimo (« Roche » du site = « Terre » dans l'app).
- `rv_levels.json` : coût de chaque niveau du camping-car (pièces, durée, matériaux).
- `graines_niveaux.json` : niveau requis des paliers de graines à haut rendement (4 cultures vérifiées sur 38).
- `recettes_overrides.json` : valeurs vérifiées de recettes de base (r1, r2, r4).

## Ce qui reste à faire

Les 182 recettes r100–r281 ont été complétées (durée, quantité, profit) via `build_gabarits_overrides.py`.
Restent non vérifiés : les dimensions `w`/`h` de toutes les recettes, et les ingrédients (conservés tels quels).

## Intégration continue

`.github/workflows/ci.yml` lance à chaque push / pull request : `npm run lint`, `npm test`, `npm run data:check` et `npm run build`.
Les ingrédients des 149 recettes de transformation sont comparés au relevé `scripts/reference/recettes_ingredients_site.txt` (test `data.test.js`).

## Mise en ligne (GitHub Pages)

`.github/workflows/deploy.yml` construit l'app et la publie à chaque push sur `main`
(adresse : `https://<compte>.github.io/<dépôt>/`). Activation unique : sur GitHub, **Settings → Pages → Source : GitHub Actions**.
Le sous-chemin est fourni par la variable `VITE_BASE` (vide en local).
