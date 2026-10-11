/**
 * Suivi multi-hypothèses : quand plusieurs plans partagent la même salle de départ, on suit le joueur sur CHAQUE plan candidat
 * (recalage de la minimap autour de la dernière position) et on cumule la qualité du recalage. En explorant, seul le vrai plan
 * continue à bien correspondre : les autres se « perdent » dans des couloirs qui ne ressemblent pas à ce que montre la minimap.
 * Logique pure (sans React), testée par `npm test`.
 */
import { echantillonnerMinimap, localiser, RAYON_DISQUE } from './localisation.js';

/** Rayon de recherche autour de la dernière position, en tailles de salle de départ. */
export const RAYON_SUIVI = 2.5;
/** Corrélation minimale pour accepter une nouvelle position. */
export const CORR_MIN = 0.5;
/** Poids de la mesure courante dans le score cumulé (moyenne glissante exponentielle). */
const ALPHA = 0.2;

/** Une hypothèse par plan : position (px miniature) au départ = porte orange, score cumulé nul. */
export function creerHypotheses(refs) {
  return refs
    .filter((r) => r.refPad && r.depart && r.taille)
    .map((r) => ({ id: r.id, pos: { x: r.depart.x, y: r.depart.y }, score: 0, corr: 0, ticks: 0, perdus: 0 }));
}

/**
 * Met à jour chaque hypothèse avec l'image courante de la minimap.
 * `mm` = { plein, w, h }, `centre` = joueur (px minimap), `tailleMM` = taille de la salle de départ dans la minimap (px).
 * Modifie et renvoie `hyps`.
 */
export function actualiserHypotheses(hyps, refs, mm, centre, tailleMM, { pas = 2 } = {}) {
  const parId = new Map(refs.map((r) => [r.id, r]));
  for (const h of hyps) {
    const r = parId.get(h.id);
    const ech = echantillonnerMinimap(mm.plein, mm.w, mm.h, centre, r.taille / tailleMM, RAYON_DISQUE * r.taille, pas);
    const res = localiser(ech, r.refPad, { autour: h.pos, rayon: RAYON_SUIVI * r.taille, pas: 2 });
    const corr = res ? Math.max(0, res.corr) : 0;
    if (res && res.corr >= CORR_MIN) { h.pos = { x: res.x, y: res.y }; h.perdus = 0; } else h.perdus++;
    h.corr = corr;
    h.score = h.ticks === 0 ? corr : (1 - ALPHA) * h.score + ALPHA * corr;
    h.ticks++;
  }
  return hyps;
}

/** Hypothèses classées par score décroissant (copie). */
export function classerHypotheses(hyps) {
  return [...hyps].sort((a, b) => b.score - a.score);
}

/**
 * Écarte les hypothèses qui décrochent nettement (score inférieur de `ecart` au meilleur, après `minTicks` mesures),
 * en gardant au moins `garder` candidats. Renvoie la liste restante (nouvelle liste).
 */
export function elaguer(hyps, { ecart = 0.2, minTicks = 8, garder = 3 } = {}) {
  const c = classerHypotheses(hyps);
  if (!c.length || c[0].ticks < minTicks) return hyps;
  const gardees = c.filter((h, i) => i < garder || h.score >= c[0].score - ecart);
  return hyps.filter((h) => gardees.includes(h));
}

/**
 * Plan décidé : meilleur score devant le second d'au moins `marge`, après `minTicks` mesures. Sinon null.
 * `courant` (plan déjà décidé) est conservé tant que son score reste à moins de `marge / 2` du meilleur (évite les va-et-vient).
 */
export function decision(hyps, { marge = 0.05, minTicks = 4, courant = null } = {}) {
  const c = classerHypotheses(hyps);
  if (!c.length || c[0].ticks < minTicks) return null;
  if (courant) {
    const h = c.find((x) => x.id === courant);
    if (h && h.score >= c[0].score - marge / 2) return courant;
  }
  if (c.length === 1) return c[0].id;
  return c[0].score - c[1].score >= marge ? c[0].id : null;
}
