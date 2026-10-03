const STYLES = {
  info: 'border-indigo-500/60 bg-indigo-950/40',
  ok: 'border-emerald-500/60 bg-emerald-950/40',
  attention: 'border-amber-500/70 bg-amber-950/40',
};
const PUCES = { info: '🎯', ok: '✅', attention: '👉' };

/** Bandeau « Que faire maintenant ? » : une seule recommandation, un seul bouton. */
export default function ProchaineAction({ action, onAller, ongletActif }) {
  if (!action) return null;
  return (
    <section
      aria-labelledby="prochaine-action-titre"
      className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${STYLES[action.niveau] || STYLES.info}`}
    >
      <div className="text-3xl leading-none" aria-hidden="true">{PUCES[action.niveau] || PUCES.info}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Prochaine étape</div>
        <h2 id="prochaine-action-titre" className="text-base sm:text-lg font-bold text-white leading-snug">{action.titre}</h2>
        <p className="text-sm text-slate-300 mt-0.5">{action.detail}</p>
      </div>
      {action.cta && action.cta.tab !== ongletActif && (
        <button
          onClick={() => onAller(action.cta.tab)}
          className="flex-shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm px-4 py-2.5 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {action.cta.label} →
        </button>
      )}
    </section>
  );
}
