// Optimisation de l'affectation Aniimo → installations de la grille.
// Logique pure (sans React), testée par `npm test`.
import { competences } from './equipe.js';

/** Production par minute selon le niveau de compétence de l'Aniimo (1 à 4), relevé sur aniimotools.dev. */
export const PRODUCTION_PAR_NIVEAU = [60, 180, 240, 300];

/** Multiplicateur de vitesse (1 = niveau 1, référence des durées de recette). */
export function vitesse(niveau) {
  if (!niveau || niveau < 1) return 0;
  return PRODUCTION_PAR_NIVEAU[Math.min(niveau, PRODUCTION_PAR_NIVEAU.length) - 1] / PRODUCTION_PAR_NIVEAU[0];
}

/** Niveaux de compétence d'un Aniimo { compétence: niveau }. Sans relevé : toutes ses compétences à nivMax. */
export function niveauxAniimo(a, niveauxDb = {}) {
  if (niveauxDb[a.nom]) return niveauxDb[a.nom];
  const out = {};
  for (const c of competences(a)) out[c] = a.nivMax || 1;
  return out;
}

/** Meilleur niveau d'un Aniimo parmi les compétences demandées (0 s'il n'en a aucune). */
export function niveauPour(a, roles, niveauxDb) {
  const n = niveauxAniimo(a, niveauxDb);
  return roles.reduce((m, r) => Math.max(m, n[r] || 0), 0);
}

/**
 * Installations posées sur la grille (une entrée par installation) avec la recette qu'elle produit.
 * `piecesH` = pièces par heure au niveau 1 (avant Aniimo).
 */
export function installationsGrille(grid, recettes, roles) {
  const parId = new Map(recettes.map((r) => [r.id, r]));
  const out = [];
  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell || cell.originR !== r || cell.originC !== c) return;
    const rec = parId.get(cell.rId);
    if (!rec || !roles[rec.structure]) return;
    const piecesH = rec.profit > 0 ? (rec.profit * 60) / Math.max(0.1, rec.tempsMin) : 0;
    out.push({ cle: `${r}-${c}`, structure: rec.structure, recette: rec.nom, piecesH, roles: roles[rec.structure].elements });
  }));
  return out;
}

/** Algorithme hongrois (minimisation), matrice n×m avec n ≤ m. Renvoie, pour chaque ligne, sa colonne. */
function hongrois(cout) {
  const n = cout.length, m = cout[0].length;
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(m + 1).fill(Infinity), utilise = Array(m + 1).fill(false);
    do {
      utilise[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (utilise[j]) continue;
        const cur = cout[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (utilise[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
  return res;
}

/** Production par heure d'un Aniimo sur une installation (0 s'il n'a pas la compétence). */
export function valeur(a, inst, niveauxDb) {
  return inst.piecesH * vitesse(niveauPour(a, inst.roles, niveauxDb));
}

/**
 * Affectation optimale : au plus un Aniimo par installation, un Aniimo une seule fois.
 * Renvoie { affectations: [{ installation, aniimo, niveau, piecesH }], total }.
 */
export function affecter(installations, aniimos, niveauxDb) {
  if (!installations.length || !aniimos.length) return { affectations: [], total: 0 };
  const cols = Math.max(aniimos.length, installations.length);
  const cout = installations.map((inst) =>
    Array.from({ length: cols }, (_, j) => (j < aniimos.length ? -valeur(aniimos[j], inst, niveauxDb) : 0)));
  const choix = hongrois(cout);
  const affectations = [];
  installations.forEach((inst, i) => {
    const a = aniimos[choix[i]];
    const piecesH = a ? valeur(a, inst, niveauxDb) : 0;
    if (a && piecesH > 0) affectations.push({ installation: inst, aniimo: a, niveau: niveauPour(a, inst.roles, niveauxDb), piecesH });
  });
  return { affectations, total: affectations.reduce((t, x) => t + x.piecesH, 0) };
}

/** Affectation naïve de référence : dans l'ordre de la grille, le premier Aniimo compatible encore libre. */
export function affecterNaif(installations, aniimos, niveauxDb) {
  const pris = new Set();
  let total = 0;
  for (const inst of installations) {
    const a = aniimos.find((x) => !pris.has(x.nom) && niveauPour(x, inst.roles, niveauxDb) > 0);
    if (a) { pris.add(a.nom); total += valeur(a, inst, niveauxDb); }
  }
  return total;
}

/**
 * Plan complet : affectation avec l'équipe possédée, gain face à l'affectation naïve, et Aniimo à acquérir
 * (ceux que choisirait l'affectation idéale sur toute la base, avec le gain qu'ils apportent).
 */
export function planOptimal(installations, db, equipe, niveauxDb) {
  const possedes = db.filter((a) => equipe.includes(a.nom));
  const actuel = affecter(installations, possedes, niveauxDb);
  const naif = affecterNaif(installations, possedes, niveauxDb);
  const ideal = affecter(installations, db, niveauxDb);
  const parInst = new Map(actuel.affectations.map((x) => [x.installation.cle, x.piecesH]));
  const acquerir = ideal.affectations
    .filter((x) => !equipe.includes(x.aniimo.nom))
    .map((x) => ({ ...x, gain: x.piecesH - (parInst.get(x.installation.cle) || 0) }))
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain - a.gain);
  const sansAniimo = installations.filter((i) => !actuel.affectations.some((x) => x.installation.cle === i.cle));
  return { ...actuel, naif, ideal: ideal.total, acquerir, sansAniimo };
}
