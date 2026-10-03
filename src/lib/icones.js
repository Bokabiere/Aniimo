// Icône (emoji) d'un produit ou d'une recette, déduite de son nom puis de sa structure.
// Aucune image externe : fonctionne hors ligne et dans tous les thèmes.

const MOTS_CLES = [
  [/aniipod/i, '📦'],
  [/croissance/i, '🌱'],
  [/canneberge/i, '🫐'],
  [/fraise/i, '🍓'],
  [/pomme de terre|patate|kvass/i, '🥔'],
  [/pomme/i, '🍎'],
  [/citron/i, '🍋'],
  [/raisin/i, '🍇'],
  [/noix de coco|coco/i, '🥥'],
  [/cerise|cerisier/i, '🌸'],
  [/oranger/i, '🌼'],
  [/rose/i, '🌹'],
  [/lavande/i, '💜'],
  [/piment/i, '🌶️'],
  [/radis/i, '🥕'],
  [/ginseng/i, '🌿'],
  [/bambou/i, '🎋'],
  [/érable|sucre|bille de sucre|bonbon|confiture|tanghulu|gelée|cacao|chocolat/i, '🍬'],
  [/riz/i, '🍚'],
  [/blé|farine|pain|biscuit|cookie|sablé|tarte|gâteau|chou à la crème|pudding/i, '🌾'],
  [/soja|tofu/i, '🫘'],
  [/thé|jus|boisson|lait|eau|vin|rosée|lotion/i, '🥤'],
  [/soupe|ragoût|bouillie|pickles|vinaigre|sauce/i, '🍲'],
  [/châtaigne|noix/i, '🌰'],
  [/coton|laine|tissu|fil |pelote|corde|teinture|poupée/i, '🧵'],
  [/encens|parfum|savon|arôme|désodorisant|sachet/i, '🪔'],
  [/bois|planche|poutre|bloc de bois|saule|sculpture|écorce/i, '🪵'],
  [/minerai|brique|plaque|roche|pierre|sable|argile|porcelaine|poterie|gemme|poussière/i, '⛏️'],
  [/carillon|lanterne|attrape|collier|perle|canard|jouet|coquillage|bouquet|fleur|plateau|vaisselle/i, '🎁'],
  [/capitaine/i, '👒'],
  [/caoutchouc/i, '🛞'],
];

const PAR_STRUCTURE = {
  'Ferme': '🌾',
  'Pépinière': '🌳',
  'Mine': '⛏️',
  'Puits': '💧',
  'Établi artisanal': '🔨',
  'Séchoir jukebox': '☀️',
  'Attrape-popote': '🍪',
  'Grande roue à tisser': '🧶',
  'Établi phonolfactif': '🪔',
  'Trempo-barils': '🥤',
  'Marmite à mijoter': '🍯',
  'Cuisinière flamboyante': '🔥',
  'Établi de menuiserie': '🪵',
  'Four de cheminée': '🧱',
  'Moulin-carrousel': '🎠',
  'Bocal à pickles': '🫙',
  'Machine à Aniipod': '📦',
  'Polissoir dansant': '💃',
};

/** Emoji pour un nom de produit/recette (structure facultative pour le repli). */
export function iconeProduit(nom = '', structure = '') {
  for (const [re, emoji] of MOTS_CLES) {
    if (re.test(nom)) return emoji;
  }
  return PAR_STRUCTURE[structure] || '📋';
}
