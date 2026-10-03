import { iconeProduit } from '../lib/icones.js';

const TAILLES = {
  sm: 'w-5 h-5 text-[11px]',
  md: 'w-7 h-7 text-base',
  lg: 'w-9 h-9 text-xl',
};

/** Pastille d'aperçu d'une recette : emoji du produit sur la couleur de la recette. */
export default function RecetteIcone({ nom, structure, color = 'bg-slate-600', size = 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-md border border-white/20 flex-shrink-0 leading-none ${TAILLES[size] || TAILLES.md} ${color}`}
    >
      {iconeProduit(nom, structure)}
    </span>
  );
}
