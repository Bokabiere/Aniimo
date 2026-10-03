import { useEffect, useMemo, useState } from 'react';
import {
  PIECES,
  cumulativeRequirements,
  computeProgress,
  estimateTotal,
  estimateHours,
  rateFor,
  formatDuration,
  formatBuildTime,
  recordLevel,
  spendStock,
} from '../lib/progression.js';

const STORAGE_KEY = 'aniimo_progression_v1';

function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && typeof s === 'object') {
      return {
        stock: s.stock && typeof s.stock === 'object' ? s.stock : {},
        cumulative: s.cumulative !== false,
        history: Array.isArray(s.history) ? s.history : [],
      };
    }
  } catch { /* stockage indisponible ou corrompu : on repart de zéro */ }
  return { stock: {}, cumulative: true, history: [] };
}

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400';

export default function ProgressionTracker({
  niveaux,
  level,
  pieces,
  onPiecesChange,
  onLevelChange,
  rates,
  profitHoraire,
}) {
  const maxLevel = niveaux[niveaux.length - 1].niveau;
  const [saved] = useState(loadSaved);
  const [stock, setStock] = useState(saved.stock);
  const [cumulative, setCumulative] = useState(saved.cumulative);
  const [history, setHistory] = useState(saved.history);
  const [target, setTarget] = useState(Math.min(level + 1, maxLevel));
  const [confirming, setConfirming] = useState(false);

  // Garde l'objectif au-dessus du niveau courant.
  useEffect(() => {
    setTarget((t) => (t <= level ? Math.min(level + 1, maxLevel) : t));
    setConfirming(false);
  }, [level, maxLevel]);

  // Historique des niveaux atteints.
  useEffect(() => {
    setHistory((h) => recordLevel(h, level));
  }, [level]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ stock, cumulative, history }));
    } catch { /* quota ou navigation privée : l'état reste en mémoire */ }
  }, [stock, cumulative, history]);

  const atMax = level >= maxLevel;

  const requirements = useMemo(
    () => (atMax ? null : cumulative
      ? cumulativeRequirements(niveaux, level, target)
      : cumulativeRequirements(niveaux, target - 1, target)),
    [niveaux, level, target, cumulative, atMax],
  );

  const progress = useMemo(
    () => (requirements ? computeProgress(requirements, { ...stock, [PIECES]: pieces }) : null),
    [requirements, stock, pieces],
  );

  const allRates = useMemo(() => ({ ...(rates || {}), [PIECES]: profitHoraire || 0 }), [rates, profitHoraire]);
  const eta = useMemo(() => (progress ? estimateTotal(progress.rows, allRates) : null), [progress, allRates]);

  const singleStep = !atMax && target === level + 1;
  const canLevelUp = singleStep && progress?.done;

  const setItem = (name, raw) => {
    const v = Math.max(0, parseInt(raw, 10) || 0);
    if (name === PIECES) onPiecesChange(v);
    else setStock((s) => ({ ...s, [name]: v }));
  };

  const levelUp = () => {
    setStock((s) => spendStock(s, requirements));
    onPiecesChange(Math.max(0, pieces - requirements.pieces));
    onLevelChange(level + 1);
    setConfirming(false);
  };

  const targets = niveaux.filter((n) => n.niveau > level);

  return (
    <section className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700" aria-labelledby="progression-titre">
      <details open>
        <summary className={`cursor-pointer flex flex-wrap items-center justify-between gap-2 select-none ${focusRing}`}>
          <h2 id="progression-titre" className="text-2xl font-bold">📈 Suivi de progression</h2>
          <span className="text-slate-300 text-sm">
            {atMax
              ? `Niveau ${level} — maximum atteint`
              : `Niv. ${level} → ${target} · ${progress.overallPct} % prêt`}
          </span>
        </summary>

        {atMax ? (
          <p className="mt-4 text-emerald-300 text-sm">🎉 Votre camping-car a atteint le niveau maximum ({maxLevel}).</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="prog-cible" className="block text-xs font-bold text-slate-300 uppercase mb-1">Niveau visé</label>
                <select
                  id="prog-cible"
                  value={target}
                  onChange={(e) => { setTarget(parseInt(e.target.value, 10)); setConfirming(false); }}
                  className={`bg-slate-900 border border-indigo-500/60 text-indigo-200 font-bold text-sm rounded px-2 py-1.5 cursor-pointer ${focusRing}`}
                >
                  {targets.map((n) => (
                    <option key={n.niveau} value={n.niveau}>Niveau {n.niveau}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cumulative}
                  onChange={(e) => setCumulative(e.target.checked)}
                  className={`w-4 h-4 accent-indigo-500 ${focusRing}`}
                />
                Cumuler tous les niveaux jusqu'à l'objectif
              </label>
              <div className="ml-auto text-xs text-slate-300 text-right space-y-0.5">
                <div>Construction : <strong className="text-slate-100">{formatBuildTime(requirements.dureeMin)}</strong></div>
                <div>Jusqu'à <strong className="text-slate-100">{requirements.aniimo}</strong> Aniimo</div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">
                  Préparation globale
                  {progress.bottleneck && <> · goulot : <strong className="text-amber-300">{progress.bottleneck}</strong></>}
                </span>
                <span className="font-mono font-bold text-indigo-300">{progress.overallPct} %</span>
              </div>
              <div
                role="progressbar"
                aria-label="Préparation globale"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.overallPct}
                className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700"
              >
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progress.overallPct}%` }}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Ressources nécessaires pour atteindre le niveau {target}</caption>
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-300 border-b border-slate-700">
                    <th scope="col" className="py-2 pr-3 font-semibold">Ressource</th>
                    <th scope="col" className="py-2 pr-3 font-semibold text-right">Besoin</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Votre stock</th>
                    <th scope="col" className="py-2 pr-3 font-semibold text-right">Manque</th>
                    <th scope="col" className="py-2 font-semibold text-right">Délai estimé</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.rows.map((r, i) => {
                    const hours = estimateHours(r.missing, rateFor(r.name, allRates));
                    const inputId = `prog-stock-${i}`;
                    return (
                      <tr key={r.name} className="border-b border-slate-700/60 align-middle">
                        <th scope="row" className="py-2 pr-3 text-left font-semibold text-slate-100">
                          <label htmlFor={inputId}>{r.name}</label>
                          <div
                            role="progressbar"
                            aria-label={`${r.name} : ${r.pct} %`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={r.pct}
                            className="mt-1 h-1.5 w-full min-w-[96px] bg-slate-900 rounded-full overflow-hidden"
                          >
                            <div
                              className={`h-full ${r.missing === 0 ? 'bg-emerald-400' : 'bg-indigo-500'}`}
                              style={{ width: `${r.pct}%` }}
                            />
                          </div>
                        </th>
                        <td className="py-2 pr-3 text-right font-mono text-slate-100">{fmt(r.needed)}</td>
                        <td className="py-2 pr-3">
                          <input
                            id={inputId}
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={r.have}
                            onChange={(e) => setItem(r.name, e.target.value)}
                            className={`w-28 bg-slate-900 border border-slate-600 rounded px-2 py-1 font-mono text-slate-100 ${focusRing}`}
                          />
                        </td>
                        <td className={`py-2 pr-3 text-right font-mono ${r.missing === 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          {r.missing === 0 ? '✓' : fmt(r.missing)}
                        </td>
                        <td className="py-2 text-right font-mono text-slate-200">
                          {r.missing === 0 ? '—' : hours === null ? <span title="Aucune production de cette ressource sur la grille">inconnu</span> : formatDuration(hours)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3 justify-between">
              <p className="text-sm text-slate-200" aria-live="polite">
                {progress.done
                  ? '✅ Tout est réuni.'
                  : eta.hours > 0
                    ? <>⏳ Délai estimé : <strong className="font-mono">{formatDuration(eta.hours)}</strong> (limité par « {eta.slowest} »)</>
                    : '⏳ Délai inconnu : aucune production ne couvre ce qui manque.'}
                {eta.unknown.length > 0 && !progress.done && (
                  <span className="block text-xs text-slate-400 mt-0.5">Sans production sur la grille : {eta.unknown.join(', ')}</span>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStock({})}
                  className={`px-3 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600 text-slate-100 ${focusRing}`}
                >
                  Vider mon stock
                </button>
                {canLevelUp && !confirming && (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className={`px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-500 font-bold text-white ${focusRing}`}
                  >
                    Monter au niveau {target}
                  </button>
                )}
                {canLevelUp && confirming && (
                  <>
                    <button
                      type="button"
                      onClick={levelUp}
                      className={`px-3 py-1.5 text-sm rounded bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-900 ${focusRing}`}
                    >
                      Confirmer : déduire les ressources
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className={`px-3 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600 text-slate-100 ${focusRing}`}
                    >
                      Annuler
                    </button>
                  </>
                )}
              </div>
            </div>
            {!singleStep && (
              <p className="text-xs text-slate-400">
                Pour valider une montée de niveau ici, choisissez le niveau suivant ({level + 1}) comme objectif.
              </p>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-700">
            <h3 className="text-xs font-bold text-slate-300 uppercase mb-2">Historique des niveaux</h3>
            <ol className="flex flex-wrap gap-2 text-xs">
              {[...history].reverse().slice(0, 8).map((h) => (
                <li key={`${h.level}-${h.at}`} className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200">
                  Niv. {h.level} · {new Date(h.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </li>
              ))}
            </ol>
          </div>
        )}
      </details>
    </section>
  );
}
