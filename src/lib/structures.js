// Règles de déblocage des installations du Logis (extraites de App.jsx pour être testables).
// Source : pages « stations » d'AniimoTools (vérifiées le 2026-10-03 pour Ferme, Pépinière, Mine,
// Établi de menuiserie et Four de cheminée).

export const NIVEAU_DEBLOCAGE_EZ_MODE = 12;

/**
 * 16 installations du Logis compatibles avec le mode électrique (EZ MODE) dès le niveau 12.
 * En mode électrique, elles tournent sans Aniimo dédié et à 120 % de vitesse réseau.
 */
export const STRUCTURES_ELECTRIQUES = new Set([
  'Mine',
  'Puits',
  'Moulin-carrousel',
  'Établi artisanal',
  'Séchoir jukebox',
  'Attrape-popote',
  'Grande roue à tisser',
  'Établi phonolfactif',
  'Trempo-barils',
  'Marmite à mijoter',
  'Cuisinière flamboyante',
  'Établi de menuiserie',
  'Four de cheminée',
  'Bocal à pickles',
  'Machine à Aniipod',
  'Polissoir dansant',
]);

export const estStructureElectrique = (structureName) => {
  if (!structureName) return false;
  const sTrim = structureName.trim().toLowerCase();
  for (const name of STRUCTURES_ELECTRIQUES) {
    if (name.toLowerCase() === sTrim) return true;
  }
  // Alias fréquents
  if (sTrim.includes('pickle')) return true;
  if (sTrim.includes('menuiserie')) return true;
  if (sTrim.includes('four') && !sTrim.includes('fournaise')) return true;
  if (sTrim.includes('marmite')) return true;
  if (sTrim.includes('baril')) return true;
  if (sTrim.includes('tisser')) return true;
  if (sTrim.includes('cuisinière') || sTrim.includes('cuisiniere')) return true;
  return false;
};

export const STRUCTURE_UNLOCK_LEVELS = {
  'Ferme': [1, 2, 5, 7, 9, 12, 16],
  'Éclorateur': [2],
  'Moulin-carrousel': [2, 5, 9, 13, 16, 18],
  'Pépinière': [2, 4, 7, 11, 14, 18],
  'Polissoir dansant': [2, 5, 7],
  'Établi artisanal': [3, 5, 7, 9, 12, 15, 18, 20],
  'Machine à Aniipod': [3, 6, 9],
  'Mine': [3, 6, 9, 12, 15, 18],
  'Attrape-popote': [4, 5, 7, 9, 12, 16, 19],
  'Puits': [4, 8, 11, 13, 17],
  'Séchoir jukebox': [4, 5, 7, 10, 12, 14, 18],
  'Château de sable Murmarée': [5, 8, 13],
  'Marmite à mijoter': [5, 7, 9, 12, 15, 18],
  'Établi de menuiserie': [6, 10, 14, 18],
  'Établi phonolfactif': [6, 7, 10, 14, 17, 19],
  'Four de cheminée': [6, 10, 14, 18],
  'Maison de Plumiel': [6, 11],
  'Trempo-barils': [6, 9, 13, 17, 19],
  'Climatisation': [7],
  'Fournaise thermique': [7],
  'Fournaise': [7],
  'Grande roue à tisser': [7, 10, 15, 19],
  'Bocal à pickles': [8, 10, 13, 16, 19],
  'Cuisinière flamboyante': [8, 10, 13, 16, 18],
  'Lampe d\'incubation': [9],
  'Lit de Cumulaine': [10, 13, 16],
  'Hamac d\'astrechute': [12],
  'Poteau électrique crépitant': [12],
  'Moulin floral': [18],
  'Générateur crépitant': [1],
  'Zone de coupe': [1, 4, 7, 11, 14, 18]
};

export const getLimitForStructure = (structureName, level) => {
  if (!structureName) return 1;
  const sTrim = structureName.trim();
  
  // Recherche de la clé correspondante avec gestion des alias
  const key = Object.keys(STRUCTURE_UNLOCK_LEVELS).find(k => k.toLowerCase() === sTrim.toLowerCase())
    || (sTrim.toLowerCase().includes('pickle') ? 'Bocal à pickles' : null)
    || (sTrim.toLowerCase().includes('menuiserie') ? 'Établi de menuiserie' : null)
    || (sTrim.toLowerCase().includes('clim') ? 'Climatisation' : null)
    || (sTrim.toLowerCase().includes('fournaise') ? 'Fournaise thermique' : null)
    || (sTrim.toLowerCase().includes('four') ? 'Four de cheminée' : null)
    || (sTrim.toLowerCase().includes('marmite') ? 'Marmite à mijoter' : null)
    || (sTrim.toLowerCase().includes('baril') ? 'Trempo-barils' : null)
    || (sTrim.toLowerCase().includes('tisser') ? 'Grande roue à tisser' : null)
    || (sTrim.toLowerCase().includes('plumiel') ? 'Maison de Plumiel' : null)
    || (sTrim.toLowerCase().includes('cumulaine') ? 'Lit de Cumulaine' : null)
    || (sTrim.toLowerCase().includes('coupe') || sTrim.toLowerCase().includes('bois') ? 'Zone de coupe' : null);

  if (key && STRUCTURE_UNLOCK_LEVELS[key]) {
    const thresholds = STRUCTURE_UNLOCK_LEVELS[key];
    return thresholds.filter(lvl => level >= lvl).length;
  }

  // Fallback standard
  return Math.max(1, Math.floor(level * 0.5));
};

export const getFirstUnlockLevel = (structureName) => {
  if (!structureName) return 1;
  const sTrim = structureName.trim();
  const key = Object.keys(STRUCTURE_UNLOCK_LEVELS).find(k => k.toLowerCase() === sTrim.toLowerCase())
    || (sTrim.toLowerCase().includes('pickle') ? 'Bocal à pickles' : null)
    || (sTrim.toLowerCase().includes('menuiserie') ? 'Établi de menuiserie' : null)
    || (sTrim.toLowerCase().includes('clim') ? 'Climatisation' : null)
    || (sTrim.toLowerCase().includes('coupe') ? 'Zone de coupe' : null);

  if (key && STRUCTURE_UNLOCK_LEVELS[key] && STRUCTURE_UNLOCK_LEVELS[key].length > 0) {
    return STRUCTURE_UNLOCK_LEVELS[key][0];
  }
  return 1;
};
