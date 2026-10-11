/**
 * Objectifs proches du joueur sur un plan : œuf (nid) et clé les plus proches parmi ceux qui ne sont pas déjà faits.
 * Logique pure (sans React), testée par `npm test`.
 * Les positions (pins, joueur) sont en % du plan ; `dim` = { largeur, hauteur, taille } de la miniature en pixels,
 * `taille` = taille de la salle de départ (pour exprimer la distance en « salles »).
 */

const FLECHES = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

/** Flèche (8 directions, y vers le bas) du vecteur (dx, dy). */
export function fleche(dx, dy) {
  const a = Math.atan2(dy, dx); // -π..π, 0 = est
  return FLECHES[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

/** Pins « objectif » : œufs (nest) et clés (key-*). */
export const estOeuf = (pin) => pin.type === 'nest';
export const estCle = (pin) => pin.type.startsWith('key-');

/** Le plus proche des pins retenus par `filtre` et absents de `faits` (Set d'indices) : { i, pin, salles, fleche } ou null. */
export function plusProche(plan, joueur, faits, dim, filtre) {
  if (!plan || !joueur || !dim || !dim.largeur || !dim.hauteur) return null;
  let meilleur = null;
  plan.pins.forEach((pin, i) => {
    if (!filtre(pin) || (faits && faits.has(i))) return;
    const dx = ((pin.x - joueur.x) / 100) * dim.largeur;
    const dy = ((pin.y - joueur.y) / 100) * dim.hauteur;
    const d = Math.hypot(dx, dy);
    if (!meilleur || d < meilleur.d) meilleur = { i, pin, d, dx, dy };
  });
  if (!meilleur) return null;
  const salles = dim.taille ? meilleur.d / dim.taille : null;
  return { i: meilleur.i, pin: meilleur.pin, salles: salles === null ? null : Math.round(salles * 10) / 10, fleche: fleche(meilleur.dx, meilleur.dy) };
}
