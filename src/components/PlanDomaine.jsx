import { useMemo, useState } from 'react';
import { blocsPlan, cadrePlan, legendePlan, CATEGORIES } from '../lib/plan-domaine.js';

const CASE = 48; // taille d'une case en unités SVG
const GAP = 3;   // espace visuel entre deux blocs

/** Plan du domaine : la grille actuelle rendue en blocs colorés avec sigles (lecture seule). */
export default function PlanDomaine({ grid, recettes, taille }) {
  const [tout, setTout] = useState(false);
  const blocs = useMemo(() => blocsPlan(grid, recettes), [grid, recettes]);
  const cadre = useMemo(() => cadrePlan(blocs, taille, { tout }), [blocs, taille, tout]);
  const legende = useMemo(() => legendePlan(blocs), [blocs]);
  const largeur = cadre.colonnes * CASE;
  const hauteur = cadre.lignes * CASE;

  return (
    <section className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 mt-6" aria-label="Plan du domaine">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 border-b border-slate-700 pb-3">
        <div>
          <h2 className="text-xl font-bold">🧭 Plan du domaine</h2>
          <p className="text-slate-400 text-sm">Votre grille vue d'en haut : un bloc par installation, avec son sigle. Survolez un bloc pour le détail.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={tout} onChange={(e) => setTout(e.target.checked)} />
          Afficher toute la grille
        </label>
      </div>

      {blocs.length === 0 ? (
        <p className="text-slate-400 text-sm py-6 text-center">Aucune installation posée : le plan apparaîtra dès que vous poserez une recette sur la grille.</p>
      ) : (
        <>
          <div className="overflow-auto rounded-xl border border-slate-700 bg-slate-900">
            <svg
              viewBox={`0 0 ${largeur} ${hauteur}`}
              className="block w-full max-w-[720px] mx-auto"
              role="img"
              aria-label={`Plan de ${blocs.length} installations`}
            >
              {Array.from({ length: cadre.colonnes + 1 }, (_, i) => (
                <line key={`v${i}`} x1={i * CASE} y1={0} x2={i * CASE} y2={hauteur} stroke="#1e293b" strokeWidth="1" />
              ))}
              {Array.from({ length: cadre.lignes + 1 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={i * CASE} x2={largeur} y2={i * CASE} stroke="#1e293b" strokeWidth="1" />
              ))}
              {blocs.map((b) => {
                const x = (b.c - cadre.c0) * CASE + GAP / 2;
                const y = (b.r - cadre.r0) * CASE + GAP / 2;
                const w = b.w * CASE - GAP;
                const h = b.h * CASE - GAP;
                const col = CATEGORIES[b.categorie];
                const taillePolice = Math.min(w, h) > CASE ? 18 : 14;
                return (
                  <g key={b.cle}>
                    <title>{`${b.structure} : ${b.recette}${b.profitH > 0 ? ` — ${Math.round(b.profitH).toLocaleString('fr-FR')} pièces/h` : ''}`}</title>
                    <rect x={x} y={y} width={w} height={h} rx="6" fill={col.fond} fillOpacity="0.85" stroke={col.bord} strokeWidth="1.5" />
                    <text
                      x={x + w / 2}
                      y={y + h / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={taillePolice}
                      fontWeight="700"
                      fill="#f1f5f9"
                    >
                      {b.sigle}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-300">
            {legende.map((l) => (
              <li key={l.id} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm border" style={{ background: l.fond, borderColor: l.bord }} aria-hidden="true" />
                {l.label} ({l.nombre})
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
