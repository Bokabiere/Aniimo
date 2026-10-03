// Filtrage et tri de la liste de recettes (logique pure, testée).

export const TRIS = [
  { id: 'installation', label: 'Par installation' },
  { id: 'nom', label: 'Nom (A → Z)' },
  { id: 'profit', label: 'Profit par heure ↓' },
  { id: 'duree', label: 'Durée du cycle ↑' },
];

/** Minuscules sans accents, pour une recherche tolérante (« ble » trouve « Blé »). */
export function normaliser(s = '') {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Pièces par heure d'une seule installation (0 si la recette ne rapporte rien). */
export function profitParHeure(r) {
  return r.profit > 0 && r.tempsMin > 0 ? (r.profit * 60) / r.tempsMin : 0;
}

/** Texte interrogeable d'une recette : nom, installation, produits et ingrédients. */
function texteRecette(r) {
  return normaliser([r.nom, r.structure, ...Object.keys(r.output || {}), ...Object.keys(r.input || {})].join(' '));
}

/**
 * options : { recherche, structure ('' = toutes), masquerVerrouillees, limite(structure) → nombre, tri }
 * Renvoie { liste, masquees } (masquees = recettes cachées car verrouillées).
 */
export function filtrerRecettes(recettes, { recherche = '', structure = '', masquerVerrouillees = false, limite = () => 1, tri = 'installation' } = {}) {
  const q = normaliser(recherche);
  let masquees = 0;
  const liste = recettes.filter((r) => {
    if (structure && r.structure !== structure) return false;
    if (q && !texteRecette(r).includes(q)) return false;
    if (masquerVerrouillees && limite(r.structure) === 0) { masquees++; return false; }
    return true;
  });
  const parNom = (a, b) => a.nom.localeCompare(b.nom, 'fr');
  const comparateurs = {
    installation: (a, b) => a.structure.localeCompare(b.structure, 'fr') || parNom(a, b),
    nom: parNom,
    profit: (a, b) => profitParHeure(b) - profitParHeure(a) || parNom(a, b),
    duree: (a, b) => a.tempsMin - b.tempsMin || parNom(a, b),
  };
  liste.sort(comparateurs[tri] || comparateurs.installation);
  return { liste, masquees };
}

/** Installations présentes, avec leur nombre de recettes (pour les pastilles de filtre). */
export function installations(recettes) {
  const m = new Map();
  for (const r of recettes) m.set(r.structure, (m.get(r.structure) || 0) + 1);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr')).map(([nom, n]) => ({ nom, n }));
}
