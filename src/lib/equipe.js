// Équipe d'Aniimo : besoins de la grille, couverture par l'équipe, suggestion.
// Logique pure (sans React), testée par `npm test`.

export const EMOJI_ELEMENT = {
  Feu: '🔥', Eau: '🌊', Plante: '🌿', Terre: '🪨', Vent: '💨', Foudre: '⚡', Glace: '❄️', Obscurité: '🌑', Lumière: '✨',
};
export const EMOJI_CAPACITE = { Loisir: '🎉', Artisanat: '🔨', Porter: '🚚', Parfumerie: '🌸', Aucune: '·' };
export const CAPACITES_ORDRE = ['Loisir', 'Artisanat', 'Porter', 'Parfumerie', 'Aucune'];
export const ELEMENTS_ORDRE = ['Feu', 'Eau', 'Plante', 'Terre', 'Vent', 'Foudre', 'Glace', 'Obscurité', 'Lumière'];

/** Cadence de travail (travail/min) selon la capacité, pour des recettes de niveau 1 / 2 / 3. */
export const CADENCES = {
  Loisir: [150, 135, 120],
  Porter: [120, 105, 90],
  Artisanat: [240, 180, 60],
  Parfumerie: [240, 180, 60],
};

/** Compétences d'un Aniimo : tous ses éléments + sa capacité (hors « Aucune »). */
export function competences(a) {
  const s = new Set(a.elements && a.elements.length ? a.elements : [a.element]);
  if (a.capacite && a.capacite !== 'Aucune') s.add(a.capacite);
  return s;
}

/** Structures posées sur la grille → { nom: nombre } (une case d'origine par structure). */
export function structuresPosees(grid, recettes) {
  const parId = new Map(recettes.map((r) => [r.id, r]));
  const out = {};
  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (cell && cell.originR === r && cell.originC === c) {
      const rec = parId.get(cell.rId);
      if (rec) out[rec.structure] = (out[rec.structure] || 0) + 1;
    }
  }));
  return out;
}

/**
 * Compétences requises par la grille. Une entrée par installation connue (rôles = au moins une de ces
 * compétences), plus un besoin global de transport (Porter) dès qu'il y a une installation.
 */
export function besoinsGrille(posees, roles) {
  const besoins = Object.entries(posees)
    .filter(([structure]) => roles[structure])
    .map(([structure, nombre]) => ({ structure, nombre, roles: roles[structure].elements }))
    .sort((a, b) => a.structure.localeCompare(b.structure, 'fr'));
  const total = Object.values(posees).reduce((t, n) => t + n, 0);
  if (total > 0) besoins.push({ structure: 'Transport des récoltes', nombre: total, roles: ['Porter'] });
  return besoins;
}

export function peutCouvrir(a, besoin) {
  const c = competences(a);
  return besoin.roles.some((r) => c.has(r));
}

/** Pour chaque besoin : les membres de l'équipe qui peuvent le couvrir. */
export function couverture(equipe, besoins, db) {
  const membres = db.filter((a) => equipe.includes(a.nom));
  return besoins.map((b) => {
    const ok = membres.filter((a) => peutCouvrir(a, b)).map((a) => a.nom);
    return { ...b, membres: ok, couvert: ok.length > 0 };
  });
}

/**
 * Équipe minimale à ajouter pour couvrir les besoins restants (algorithme glouton :
 * à chaque tour, l'Aniimo qui couvre le plus de besoins non couverts ; à égalité, meilleur score puis nom).
 * Renvoie [{ aniimo, couvre: [structure…] }].
 */
export function suggererEquipe(equipe, besoins, db) {
  let restants = couverture(equipe, besoins, db).filter((b) => !b.couvert);
  const candidats = db.filter((a) => !equipe.includes(a.nom));
  const choisis = [];
  while (restants.length) {
    let meilleur = null;
    for (const a of candidats) {
      if (choisis.some((c) => c.aniimo.nom === a.nom)) continue;
      const couvre = restants.filter((b) => peutCouvrir(a, b));
      if (!couvre.length) continue;
      const poids = couvre.reduce((t, b) => t + b.nombre, 0);
      if (!meilleur || couvre.length > meilleur.couvre.length ||
          (couvre.length === meilleur.couvre.length && (poids > meilleur.poids ||
            (poids === meilleur.poids && (a.score > meilleur.aniimo.score ||
              (a.score === meilleur.aniimo.score && a.nom.localeCompare(meilleur.aniimo.nom, 'fr') < 0)))))) {
        meilleur = { aniimo: a, couvre, poids };
      }
    }
    if (!meilleur) break; // besoin impossible à couvrir avec la base actuelle
    choisis.push({ aniimo: meilleur.aniimo, couvre: meilleur.couvre.map((b) => b.structure) });
    restants = restants.filter((b) => !meilleur.couvre.includes(b));
  }
  return choisis;
}
