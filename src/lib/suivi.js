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
export function actualiserHypotheses(hyps, refs, mm, centre, tailleMM, { pas = 2, globalPour = null } = {}) {
  const parId = new Map(refs.map((r) => [r.id, r]));
  for (const h of hyps) {
    const r = parId.get(h.id);
    const f = h.facteur || 1;
    const ech = echantillonnerMinimap(mm.plein, mm.w, mm.h, centre, (f * r.taille) / tailleMM, RAYON_DISQUE * r.taille, pas);
    // Plan validé par le joueur et suivi perdu depuis quelques mesures : on cherche sur tout le plan (exigence de corrélation plus forte).
    const reperdu = h.id === globalPour && h.perdus >= 4;
    let res = reperdu
      ? localiser(ech, r.refPad, { pas: 2 })
      : localiser(ech, r.refPad, { autour: h.pos, rayon: RAYON_SUIVI * r.taille, pas: 2 });
    if (reperdu && res && res.corr < 0.7) res = null;
    if (res && res.corr >= CORR_MIN) {
      // Précision : l'échelle de la minimap n'est connue qu'à ±1 px près. On l'affine (±6 %) et on resserre le disque (pas 1).
      let meilleurF = f;
      let meilleur = localiser(echantillonnerMinimap(mm.plein, mm.w, mm.h, centre, (f * r.taille) / tailleMM, RAYON_DISQUE * r.taille, 1), r.refPad, { autour: { x: res.x, y: res.y }, rayon: 3, pas: 1 }) || res;
      for (const g of [0.94, 0.97, 1.03, 1.06]) {
        const f2 = f * g;
        const e2 = echantillonnerMinimap(mm.plein, mm.w, mm.h, centre, (f2 * r.taille) / tailleMM, RAYON_DISQUE * r.taille, 1);
        const r2 = localiser(e2, r.refPad, { autour: { x: res.x, y: res.y }, rayon: 3, pas: 1 });
        if (r2 && r2.corr > meilleur.corr + 0.003) { meilleur = r2; meilleurF = f2; }
      }
      h.facteur = Math.max(0.8, Math.min(1.25, 0.4 * f + 0.6 * meilleurF));
      res = meilleur;
    }
    const corr = res ? Math.max(0, res.corr) : 0;
    if (res && res.corr >= CORR_MIN) { h.pos = { x: res.fx ?? res.x, y: res.fy ?? res.y }; h.perdus = 0; } else h.perdus++;
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

/**
 * Échelle de la minimap inconnue (suivi lancé en cours de partie, position donnée par le joueur) : on essaie plusieurs tailles de
 * salle de départ (en pixels de minimap) autour de la position connue `h.pos` et on garde la meilleure corrélation.
 * Renvoie { taille, corr } ou null si rien de convaincant (corr < 0,6).
 */
export function calibrerEchelle(h, r, mm, centre, { de = 20, a = 170 } = {}) {
  const essais = [];
  for (let t = de; t <= a; t *= 1.05) {
    const ech = echantillonnerMinimap(mm.plein, mm.w, mm.h, centre, r.taille / t, RAYON_DISQUE * r.taille, 2);
    const res = localiser(ech, r.refPad, { autour: h.pos, rayon: 4, pas: 1 });
    if (res) essais.push({ taille: t, corr: res.corr });
  }
  if (!essais.length) return null;
  const max = Math.max(...essais.map((e) => e.corr));
  if (max < 0.6) return null;
  // Plateau de corrélation (des masques binaires donnent plusieurs échelles quasi équivalentes) : on prend le milieu.
  const plateau = essais.filter((e) => e.corr >= max - 0.01);
  return { taille: plateau[Math.floor((plateau.length - 1) / 2)].taille, corr: max };
}
