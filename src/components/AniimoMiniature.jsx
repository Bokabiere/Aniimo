import { useState } from 'react';
import { sourcesMiniature } from '../lib/miniatures.js';

const FOND_ELEMENT = {
  Feu: 'bg-orange-700', Eau: 'bg-sky-700', Plante: 'bg-green-700', Terre: 'bg-amber-800', Vent: 'bg-teal-700',
  Foudre: 'bg-yellow-600', Glace: 'bg-cyan-700', Obscurité: 'bg-purple-800', Lumière: 'bg-yellow-500',
};
const TAILLES = {
  xs: 'w-6 h-6 text-[11px]',
  sm: 'w-9 h-9 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-2xl',
};

/** Miniature d'un Aniimo ; repli sur une pastille colorée (initiale) si l'image est introuvable. */
export default function AniimoMiniature({ aniimo, taille = 'md', className = '' }) {
  const sources = sourcesMiniature(aniimo.nom, import.meta.env.BASE_URL);
  const [essai, setEssai] = useState(0);
  const element = (aniimo.elements && aniimo.elements[0]) || aniimo.element;
  const base = `inline-flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden border border-white/25 ${TAILLES[taille] || TAILLES.md} ${className}`;

  if (essai >= sources.length) {
    return (
      <span aria-hidden="true" className={`${base} ${FOND_ELEMENT[element] || 'bg-slate-600'} font-bold text-white`}>
        {aniimo.nom.charAt(0)}
      </span>
    );
  }
  return (
    <span className={`${base} bg-slate-700`}>
      <img
        src={sources[essai]}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setEssai((n) => n + 1)}
        className="w-full h-full object-cover"
      />
    </span>
  );
}
