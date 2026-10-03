import { useMemo, useState } from 'react';
import {
  EMOJI_ELEMENT, EMOJI_CAPACITE, CAPACITES_ORDRE, ELEMENTS_ORDRE, CADENCES,
  couverture, suggererEquipe,
} from '../lib/equipe.js';
import { normaliser } from '../lib/recettes-liste.js';

const STYLE_CAPACITE = {
  Loisir: 'border-yellow-500/50 text-yellow-300',
  Artisanat: 'border-amber-500/50 text-amber-300',
  Porter: 'border-sky-500/50 text-sky-300',
  Parfumerie: 'border-purple-500/50 text-purple-300',
  Aucune: 'border-slate-600 text-slate-300',
};

function description(a) {
  const els = (a.elements && a.elements.length ? a.elements : [a.element]).join(' + ');
  const cap = a.capacite === 'Aucune' ? 'sans capacité de transport/atelier' : `${a.capacite} (niv. max ${a.nivMax})`;
  return `${a.nom} — ${els} · ${cap}`;
}

/** Onglet « Équipe » : couverture de la grille, suggestion, sélection filtrable des Aniimo. */
export default function EquipeAniimo({ db, equipe, onChange, besoins, onAller }) {
  const [recherche, setRecherche] = useState('');
  const [capacite, setCapacite] = useState('');
  const [element, setElement] = useState('');
  const [seulementEquipe, setSeulementEquipe] = useState(false);

  const cov = useMemo(() => couverture(equipe, besoins, db), [equipe, besoins, db]);
  const suggestion = useMemo(() => suggererEquipe(equipe, besoins, db), [equipe, besoins, db]);
  const nbCouverts = cov.filter((b) => b.couvert).length;

  const visibles = useMemo(() => {
    const q = normaliser(recherche);
    return db
      .filter((a) => (!capacite || a.capacite === capacite)
        && (!element || (a.elements || [a.element]).includes(element))
        && (!seulementEquipe || equipe.includes(a.nom))
        && (!q || normaliser(a.nom).includes(q)))
      .sort((a, b) => CAPACITES_ORDRE.indexOf(a.capacite) - CAPACITES_ORDRE.indexOf(b.capacite) || a.nom.localeCompare(b.nom, 'fr'));
  }, [db, recherche, capacite, element, seulementEquipe, equipe]);

  const basculer = (nom) => onChange(equipe.includes(nom) ? equipe.filter((n) => n !== nom) : [...equipe, nom]);
  const toutSelectionner = () => onChange([...new Set([...equipe, ...visibles.map((a) => a.nom)])]);
  const toutDeselectionner = () => onChange(equipe.filter((n) => !visibles.some((a) => a.nom === n)));

  return (
    <section aria-labelledby="equipe-titre" className="bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-700 space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="equipe-titre" className="text-2xl font-bold">🐾 Mon équipe d'Aniimo</h2>
        <p className="text-sm text-slate-300">
          <strong className="text-white">{equipe.length}</strong> Aniimo possédé{equipe.length > 1 ? 's' : ''} sur {db.length}
        </p>
      </header>

      {/* ---- Couverture de la grille ---- */}
      <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700">
        <h3 className="font-bold text-slate-200 mb-1">⚡ Votre équipe couvre-t-elle votre grille ?</h3>
        {besoins.length === 0 ? (
          <p className="text-sm text-slate-300">
            Votre grille est vide : posez quelques installations pour voir quels Aniimo il vous faut.{' '}
            <button onClick={() => onAller('grille')} className="text-amber-300 underline hover:text-amber-200">Ouvrir la grille</button>
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-300 mb-3" aria-live="polite">
              {nbCouverts === cov.length
                ? '✅ Toutes les compétences nécessaires sont couvertes.'
                : `⚠️ ${cov.length - nbCouverts} besoin${cov.length - nbCouverts > 1 ? 's' : ''} sans Aniimo sur ${cov.length}.`}
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {cov.map((b) => (
                <li key={b.structure} className={`flex items-start gap-2 text-sm rounded-lg px-2.5 py-1.5 border ${b.couvert ? 'border-emerald-700/50 bg-emerald-950/30' : 'border-amber-600/60 bg-amber-950/30'}`}>
                  <span aria-hidden="true">{b.couvert ? '✅' : '⚠️'}</span>
                  <span className="min-w-0">
                    <span className="font-semibold text-white">{b.structure}</span>
                    <span className="text-slate-300"> ×{b.nombre} · {b.roles.map((r) => `${EMOJI_ELEMENT[r] || EMOJI_CAPACITE[r] || ''} ${r}`).join(' / ')}</span>
                    <span className="block text-xs text-slate-300">
                      {b.couvert ? `${b.membres.slice(0, 4).join(', ')}${b.membres.length > 4 ? ` +${b.membres.length - 4}` : ''}` : 'Aucun Aniimo de votre équipe'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {suggestion.length > 0 && (
              <div className="mt-3 p-3 rounded-lg border border-indigo-500/50 bg-indigo-950/30">
                <p className="text-sm text-slate-200 mb-2">
                  <strong>Suggestion :</strong> ajoutez {suggestion.length} Aniimo pour tout couvrir.
                </p>
                <ul className="flex flex-wrap gap-1.5 mb-2">
                  {suggestion.map((s) => (
                    <li key={s.aniimo.nom} className="text-xs bg-slate-800 border border-slate-600 rounded-full px-2.5 py-1 text-slate-100" title={`Couvre : ${s.couvre.join(', ')}`}>
                      {(s.aniimo.elements || [s.aniimo.element]).map((e) => EMOJI_ELEMENT[e]).join('')} {s.aniimo.nom}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onChange([...new Set([...equipe, ...suggestion.map((s) => s.aniimo.nom)])])}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Ajouter ces {suggestion.length} Aniimo à mon équipe
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ---- Sélection ---- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="equipe-recherche">Rechercher un Aniimo</label>
          <input
            id="equipe-recherche"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="🔍 Rechercher un Aniimo…"
            className="flex-1 min-w-[12rem] bg-slate-900 text-sm px-3 py-2 rounded-lg border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
          />
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={seulementEquipe} onChange={(e) => setSeulementEquipe(e.target.checked)} className="accent-indigo-500 w-4 h-4" />
            Mon équipe seulement
          </label>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filtrer par capacité">
          <Puce actif={capacite === ''} onClick={() => setCapacite('')}>Toutes capacités</Puce>
          {CAPACITES_ORDRE.map((c) => (
            <Puce key={c} actif={capacite === c} onClick={() => setCapacite(capacite === c ? '' : c)}>
              {EMOJI_CAPACITE[c]} {c === 'Aucune' ? 'Éléments seuls' : c}
            </Puce>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filtrer par élément">
          <Puce actif={element === ''} onClick={() => setElement('')}>Tous éléments</Puce>
          {ELEMENTS_ORDRE.map((e) => (
            <Puce key={e} actif={element === e} onClick={() => setElement(element === e ? '' : e)}>{EMOJI_ELEMENT[e]} {e}</Puce>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
          <span aria-live="polite">{visibles.length} Aniimo affiché{visibles.length > 1 ? 's' : ''}</span>
          <span className="flex gap-2">
            <button onClick={toutSelectionner} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">Tout cocher (affichés)</button>
            <button onClick={toutDeselectionner} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">Tout décocher</button>
          </span>
        </div>

        {visibles.length === 0 ? (
          <p className="text-sm text-slate-300 italic py-4 text-center">Aucun Aniimo ne correspond à ces filtres.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {visibles.map((a) => {
              const choisi = equipe.includes(a.nom);
              return (
                <li key={a.nom}>
                  <button
                    onClick={() => basculer(a.nom)}
                    aria-pressed={choisi}
                    aria-label={`${description(a)}${choisi ? ' — dans votre équipe' : ''}`}
                    title={description(a)}
                    className={`w-full min-h-[48px] text-left flex items-center gap-2 px-3 py-2 rounded-xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      choisi ? 'bg-indigo-700/70 border-indigo-300 text-white' : 'bg-slate-900 border-slate-600 text-slate-100 hover:bg-slate-700'
                    }`}
                  >
                    <span className="text-lg leading-none" aria-hidden="true">{(a.elements || [a.element]).map((e) => EMOJI_ELEMENT[e]).join('')}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-sm truncate">{a.nom}</span>
                      <span className={`inline-block text-xs border rounded px-1.5 mt-0.5 ${STYLE_CAPACITE[a.capacite]}`}>
                        {EMOJI_CAPACITE[a.capacite]} {a.capacite === 'Aucune' ? (a.elements || [a.element]).join(' + ') : `${a.capacite} niv. ${a.nivMax}`}
                      </span>
                    </span>
                    <span aria-hidden="true" className={`text-lg ${choisi ? 'text-emerald-300' : 'text-transparent'}`}>✓</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---- Aide : cadences ---- */}
      <details className="text-sm text-slate-300">
        <summary className="cursor-pointer font-semibold text-slate-200 select-none">Comprendre les capacités et les cadences</summary>
        <ul className="mt-2 space-y-1">
          {Object.entries(CADENCES).map(([cap, [n1, n2, n3]]) => (
            <li key={cap}>
              <strong className="text-white">{EMOJI_CAPACITE[cap]} {cap}</strong> : {n1} / {n2} / {n3} travail par minute pour des recettes de niveau 1 / 2 / 3 (à niveau d'Aniimo suffisant).
            </li>
          ))}
          <li>Un Aniimo peut travailler sur toute installation correspondant à l'un de ses éléments (ex. Givrotus : Eau et Glace) ou à sa capacité.</li>
          <li>La couverture compte au moins un Aniimo par besoin. Pour que toutes les installations tournent en continu, prévoyez idéalement un Aniimo par installation.</li>
          <li>+20 % si la lettre de personnalité correspond à l'installation.</li>
        </ul>
      </details>
    </section>
  );
}

function Puce({ actif, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`flex-shrink-0 px-3 py-1.5 min-h-[36px] rounded-full text-sm font-semibold border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
        actif ? 'bg-indigo-600 border-indigo-300 text-white' : 'bg-slate-900 border-slate-600 text-slate-200 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}
