// Plan du domaine : vue « façon Aniimax » de la grille (blocs colorés + sigles).
// Logique pure (sans React), testée par `npm test`.

/** Sigles explicites des installations (clé en minuscules). */
const SIGLES = {
  'ferme': 'F',
  'pépinière': 'Pé',
  'mine': 'M',
  'puits': 'Pu',
  'zone de coupe': 'ZC',
  'moulin-carrousel': 'MC',
  'établi artisanal': 'EA',
  'machine à aniipod': 'MA',
  'polissoir dansant': 'PD',
  'attrape-popote': 'AP',
  'séchoir jukebox': 'SJ',
  'château de sable murmarée': 'CS',
  'marmite à mijoter': 'MM',
  'établi de menuiserie': 'EM',
  'établi phonolfactif': 'EP',
  'four de cheminée': 'FC',
  'maison de plumiel': 'MP',
  'trempo-barils': 'TB',
  'climatisation': 'Cl',
  'fournaise': 'Fo',
  'fournaise thermique': 'Fo',
  'grande roue à tisser': 'GR',
  'bocal à pickles': 'BP',
  'cuisinière flamboyante': 'CF',
  "lampe d'incubation": 'LI',
  'lit de cumulaine': 'LC',
  "hamac d'astrechute": 'HA',
  'moulin floral': 'MF',
  'éclorateur': 'Éc',
};

/** Catégories d'installations et leurs couleurs (fond, bordure). */
export const CATEGORIES = {
  culture: { label: 'Cultures', fond: '#2f6b3a', bord: '#5fbf6f' },
  recolte: { label: 'Récolte', fond: '#6b6440', bord: '#b5a96a' },
  transformation: { label: 'Transformation', fond: '#4c3f7a', bord: '#9a86e0' },
  aura: { label: 'Aura (froid / chaud)', fond: '#1f6a7a', bord: '#5fd0e6' },
  autre: { label: 'Autres', fond: '#6a3d3d', bord: '#d98a8a' },
};

const CULTURE = new Set(['ferme', 'pépinière']);
const RECOLTE = new Set(['mine', 'puits', 'zone de coupe']);
const AURA = new Set(['climatisation', 'fournaise', 'fournaise thermique']);
const AUTRE = new Set([
  'éclorateur', 'lit de cumulaine', "hamac d'astrechute", 'maison de plumiel',
  'château de sable murmarée', "lampe d'incubation", 'machine à aniipod', 'polissoir dansant',
]);

/** Catégorie d'une installation : 'culture' | 'recolte' | 'transformation' | 'aura' | 'autre'. */
export function categorie(structure) {
  const s = (structure || '').trim().toLowerCase();
  if (CULTURE.has(s)) return 'culture';
  if (RECOLTE.has(s)) return 'recolte';
  if (AURA.has(s)) return 'aura';
  if (AUTRE.has(s)) return 'autre';
  return 'transformation';
}

/** Sigle court d'une installation (explicite si connue, sinon initiales des mots significatifs). */
export function sigle(structure) {
  const s = (structure || '').trim();
  if (!s) return '?';
  const connu = SIGLES[s.toLowerCase()];
  if (connu) return connu;
  const mots = s.split(/[\s'’-]+/).filter((m) => m.length > 2);
  return (mots.length ? mots : [s]).slice(0, 3).map((m) => m[0].toUpperCase()).join('');
}

/**
 * Blocs du plan : une entrée par installation posée sur la grille.
 * `profitH` = pièces par heure au niveau 1 (hors Aniimo), 0 si la recette ne rapporte rien.
 */
export function blocsPlan(grid, recettes) {
  const parId = new Map(recettes.map((r) => [r.id, r]));
  const blocs = [];
  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell || cell.originR !== r || cell.originC !== c) return;
    const rec = parId.get(cell.rId);
    if (!rec) return;
    blocs.push({
      cle: `${r}-${c}`,
      r, c,
      w: rec.w || 1,
      h: rec.h || 1,
      structure: rec.structure,
      recette: rec.nom,
      sigle: sigle(rec.structure),
      categorie: categorie(rec.structure),
      profitH: rec.profit > 0 ? (rec.profit * 60) / Math.max(0.1, rec.tempsMin) : 0,
    });
  }));
  return blocs;
}

/**
 * Cadre affiché : toute la grille, ou la zone occupée + une marge (limitée à la grille).
 * Renvoie { r0, c0, lignes, colonnes }.
 */
export function cadrePlan(blocs, taille, { tout = false, marge = 1 } = {}) {
  if (tout || !blocs.length) return { r0: 0, c0: 0, lignes: taille, colonnes: taille };
  const r0 = Math.max(0, Math.min(...blocs.map((b) => b.r)) - marge);
  const c0 = Math.max(0, Math.min(...blocs.map((b) => b.c)) - marge);
  const r1 = Math.min(taille, Math.max(...blocs.map((b) => b.r + b.h)) + marge);
  const c1 = Math.min(taille, Math.max(...blocs.map((b) => b.c + b.w)) + marge);
  return { r0, c0, lignes: r1 - r0, colonnes: c1 - c0 };
}

/** Légende : catégories présentes avec leur nombre d'installations, ordre stable. */
export function legendePlan(blocs) {
  const n = {};
  for (const b of blocs) n[b.categorie] = (n[b.categorie] || 0) + 1;
  return Object.keys(CATEGORIES).filter((k) => n[k]).map((k) => ({ id: k, ...CATEGORIES[k], nombre: n[k] }));
}
