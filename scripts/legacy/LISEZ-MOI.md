# Scripts d'origine (archivés)

Ces scripts ont servi à extraire les données depuis des pages enregistrées. Ils sont conservés pour mémoire,
mais **ne fonctionnent plus tels quels** : ils lisent des fichiers situés dans un dossier temporaire d'un autre
outil (`C:\Users\...\.gemini\...`) et plusieurs écrasent directement `recettes.json` ou `App.jsx`.

Pour mettre à jour les données, utilisez uniquement `python scripts/update_data.py` (voir `scripts/README.md`).
`build_db.py` est à l'origine des 182 recettes « gabarits » (1×1, 30 min, profit 0) : ne pas le relancer.
