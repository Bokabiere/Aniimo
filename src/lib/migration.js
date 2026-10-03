// Migration des sauvegardes (localStorage) après correction de la base de recettes.
// Logique pure, testée par `npm test`.

/** Recettes supprimées de la base → recette de remplacement (null = case retirée de la grille). */
export const IDS_MIGRES = {
  r14: null,           // « Pain » au Four à cheminée : n'existe pas en jeu
  r3: 'r106',          // Champ Coton inventé → Coton
  r7: 'base_eau_puits', // Extraction Eau → Eau de puits
  r10: 'r219',         // Tranches citron séché → recette vérifiée
  r11: 'r252',         // Farine inventée → Farine complète
  r13: 'r263',         // Tissu inventé → Tissu en coton
  r15: 'r241',         // Pickles inventés → Fleur de cerisier salée
  r17: null,           // Nettoyage inventé
  r18: null,           // Sommeil inventé
  r107: 'r4',          // doublons exacts
  r118: 'r2',
  base_roche: 'r6',    // la Mine produit Roche + Sable minéral ensemble
  base_sable: 'r6',
  base_petales: null,  // Pétales viennent du Lit de Cumulaine
};

/** Remplace dans une grille les recettes migrées (les cases d'origine d'une structure gardent leur place). */
export function migrerGrille(grid, ids = IDS_MIGRES) {
  if (!Array.isArray(grid)) return grid;
  return grid.map((row) => row.map((cell) => {
    if (!cell || !(cell.rId in ids)) return cell;
    const cible = ids[cell.rId];
    return cible ? { ...cell, rId: cible } : null;
  }));
}

/**
 * Base sauvegardée → base à jour : retire les recettes migrées et ajoute les recettes par défaut manquantes.
 * Avec `remplacer`, les recettes par défaut corrigées écrasent aussi leur ancienne version sauvegardée
 * (à n'utiliser qu'une seule fois, à la migration) ; les recettes ajoutées par l'utilisateur sont conservées.
 */
export function migrerBase(sauvegardee, defauts, { remplacer = false, ids = IDS_MIGRES } = {}) {
  const gardees = sauvegardee.filter((r) => !(r.id in ids));
  const parId = new Map(defauts.map((d) => [d.id, d]));
  const courantes = remplacer ? gardees.map((r) => parId.get(r.id) || r) : gardees;
  const manquantes = defauts.filter((d) => !courantes.some((r) => r.id === d.id));
  return [...courantes, ...manquantes];
}

/** Presets : migre la grille de chacun. */
export function migrerPresets(presets) {
  if (!Array.isArray(presets)) return presets;
  return presets.map((p) => (p && p.grid ? { ...p, grid: migrerGrille(p.grid) } : p));
}
