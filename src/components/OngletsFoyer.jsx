/** Barre d'onglets du foyer (défile horizontalement sur petit écran). */
export default function OngletsFoyer({ onglets, actif, onSelect }) {
  return (
    <nav
      aria-label="Sections de l'application"
      className="sticky top-0 z-30 -mx-2 sm:mx-0 px-2 sm:px-0 py-2 bg-slate-900/90 backdrop-blur-md"
    >
      <div role="tablist" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {onglets.map((o) => {
          const selectionne = o.id === actif;
          return (
            <button
              key={o.id}
              role="tab"
              id={`onglet-${o.id}`}
              aria-selected={selectionne}
              aria-controls="panneau-principal"
              onClick={() => onSelect(o.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-sm font-bold border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                selectionne
                  ? 'bg-amber-500 text-slate-900 border-amber-300 shadow-lg shadow-amber-900/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span aria-hidden="true">{o.icone}</span>
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
