// « Que faire maintenant ? » : une recommandation unique, déduite de l'état du joueur.
// Logique pure (sans React) : testable avec `npm test`.
import { levelRequirements, formatDuration } from './progression.js';

/** Meilleure culture déjà débloquée (rendement horaire le plus élevé). */
export function meilleureGraine(graines, level) {
  return graines
    .filter((g) => (g.niveau_requis || 1) <= level)
    .reduce((best, g) => (!best || g.pieces_h > best.pieces_h ? g : best), null);
}

const nombre = (n) => Math.round(n).toLocaleString('fr-FR');

/**
 * Renvoie { id, titre, detail, cta: { label, tab } | null, niveau: 'info'|'ok'|'attention' }.
 * tab ∈ 'grille' | 'progression' | 'graines' | 'equipe'.
 */
export function prochaineAction({ level, pieces = 0, niveaux, graines, nbStructures, profitHoraire = 0 }) {
  const graine = meilleureGraine(graines, level);
  const conseilGraine = graine
    ? `${graine.culture} (${graine.structure}) est votre meilleure culture : ${nombre(graine.pieces_h)} pièces/h.`
    : '';

  if (!nbStructures) {
    return {
      id: 'demarrer',
      niveau: 'attention',
      titre: 'Commencez par poser une première recette sur la grille',
      detail: conseilGraine || 'Choisissez une recette dans la liste, puis cliquez sur la grille.',
      cta: { label: 'Ouvrir la grille', tab: 'grille' },
    };
  }

  const prochain = levelRequirements(niveaux, level + 1);
  if (!prochain) {
    return {
      id: 'niveau-max',
      niveau: 'ok',
      titre: 'Niveau maximum atteint',
      detail: 'Il ne reste qu\'à optimiser votre production.',
      cta: null,
    };
  }

  if (profitHoraire <= 0) {
    return {
      id: 'sans-production',
      niveau: 'attention',
      titre: 'Votre grille ne produit pas de pièces',
      detail: conseilGraine || 'Ajoutez des cultures ou des recettes avec un profit.',
      cta: { label: 'Voir les meilleures graines', tab: 'graines' },
    };
  }

  const manque = Math.max(0, prochain.pieces - pieces);
  if (manque === 0) {
    return {
      id: 'pret',
      niveau: 'ok',
      titre: `Vous avez assez de pièces pour le niveau ${level + 1}`,
      detail: 'Vérifiez qu\'il ne vous manque aucun matériau, puis lancez la construction.',
      cta: { label: 'Voir les besoins', tab: 'progression' },
    };
  }
  return {
    id: 'epargner',
    niveau: 'info',
    titre: `Niveau ${level + 1} dans environ ${formatDuration(manque / profitHoraire)}`,
    detail: `Il manque ${nombre(manque)} pièces ; votre grille en produit ${nombre(profitHoraire)} par heure.${conseilGraine ? ' ' + conseilGraine : ''}`,
    cta: { label: 'Suivre la progression', tab: 'progression' },
  };
}
