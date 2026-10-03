import { TRIS } from '../lib/recettes-liste.js';

/** Filtres de la liste de recettes : installation, tri, masquage des recettes verrouillées. */
export default function FiltresRecettes({ installations, structure, onStructure, tri, onTri, masquerVerrouillees, onMasquer, nbMasquees }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]" role="group" aria-label="Filtrer par installation">
        <Puce actif={structure === ''} onClick={() => onStructure('')}>Toutes</Puce>
        {installations.map((i) => (
          <Puce key={i.nom} actif={structure === i.nom} onClick={() => onStructure(structure === i.nom ? '' : i.nom)}>
            {i.nom} <span className="opacity-60">{i.n}</span>
          </Puce>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="tri-recettes">Trier les recettes</label>
        <select
          id="tri-recettes"
          value={tri}
          onChange={(e) => onTri(e.target.value)}
          className="flex-1 min-w-0 bg-slate-800 text-xs px-2 py-1.5 rounded-lg border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          {TRIS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
        <input type="checkbox" checked={masquerVerrouillees} onChange={(e) => onMasquer(e.target.checked)} className="accent-indigo-500" />
        <span>Masquer les recettes verrouillées{masquerVerrouillees && nbMasquees > 0 ? ` (${nbMasquees} cachées)` : ''}</span>
      </label>
    </div>
  );
}

function Puce({ actif, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
        actif ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}
