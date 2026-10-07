import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EMOJI_ELEMENT, EMOJI_CAPACITE, CAPACITES_ORDRE, ELEMENTS_ORDRE, CADENCES,
  couverture, suggererEquipe,
} from '../lib/equipe.js';
import { normaliser } from '../lib/recettes-liste.js';
import { planOptimal } from '../lib/optimisation.js';
import NIVEAUX from '../data/aniimo_niveaux.json';
import AniimoMiniature from './AniimoMiniature.jsx';

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
export default function EquipeAniimo({ db, equipe, onChange, besoins, onAller, installations = [], ezMode = false, level = 1 }) {
  const [recherche, setRecherche] = useState('');
  const [capacite, setCapacite] = useState('');
  const [element, setElement] = useState('');
  const [statut, setStatut] = useState('tous'); // tous | possedes | manquants
  const [tri, setTri] = useState('capacite'); // capacite | nom
  const [annulation, setAnnulation] = useState(null); // { libelle, precedent }
  const minuteur = useRef(null);
  useEffect(() => () => clearTimeout(minuteur.current), []);
  const parNom = useMemo(() => new Map(db.map((a) => [a.nom, a])), [db]);

  const cov = useMemo(() => couverture(equipe, besoins, db), [equipe, besoins, db]);
  const suggestion = useMemo(() => suggererEquipe(equipe, besoins, db), [equipe, besoins, db]);
  const plan = useMemo(() => planOptimal(installations, db, equipe, NIVEAUX, { ezMode }), [installations, db, equipe, ezMode]);
  const [voirTout, setVoirTout] = useState(false);
  const nbCouverts = cov.filter((b) => b.couvert).length;

  const visibles = useMemo(() => {
    const q = normaliser(recherche);
    return db
      .filter((a) => (!capacite || a.capacite === capacite)
        && (!element || (a.elements || [a.element]).includes(element))
        && (statut === 'tous' || (statut === 'possedes') === equipe.includes(a.nom))
        && (!q || normaliser(a.nom).includes(q)))
      .sort((a, b) => (tri === 'capacite'
        ? CAPACITES_ORDRE.indexOf(a.capacite) - CAPACITES_ORDRE.indexOf(b.capacite)
        : 0) || a.nom.localeCompare(b.nom, 'fr'));
  }, [db, recherche, capacite, element, statut, tri, equipe]);

  const filtresActifs = Boolean(recherche || capacite || element || statut !== 'tous');
  const reinitialiser = () => { setRecherche(''); setCapacite(''); setElement(''); setStatut('tous'); };

  /** Applique un changement d'équipe en gardant la possibilité de l'annuler (actions groupées). */
  const modifierGroupe = (libelle, suivante) => {
    const precedent = equipe;
    onChange(suivante);
    setAnnulation({ libelle, precedent });
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setAnnulation(null), 10000);
  };
  const annuler = () => { if (annulation) onChange(annulation.precedent); setAnnulation(null); };

  const basculer = (nom) => onChange(equipe.includes(nom) ? equipe.filter((n) => n !== nom) : [...equipe, nom]);
  const toutSelectionner = () => modifierGroupe(`${visibles.length} Aniimo ajoutés`, [...new Set([...equipe, ...visibles.map((a) => a.nom)])]);
  const toutDeselectionner = () => modifierGroupe('Aniimo retirés de votre équipe', equipe.filter((n) => !visibles.some((a) => a.nom === n)));

  const pct = db.length ? Math.round((equipe.length / db.length) * 100) : 0;
  const elementsDe = (a) => (a.elements && a.elements.length ? a.elements : [a.element]);
  const Pastilles = ({ noms, max = 5 }) => (
    <span className="inline-flex items-center -space-x-1.5 align-middle">
      {noms.slice(0, max).map((n) => (parNom.get(n) ? <AniimoMiniature key={n} aniimo={parNom.get(n)} taille="xs" className="ring-2 ring-slate-900" /> : null))}
      {noms.length > max && <span className="ml-2 text-xs text-slate-300">+{noms.length - max}</span>}
    </span>
  );

  return (
    <section aria-labelledby="equipe-titre" className="bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-700 space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="equipe-titre" className="text-2xl font-bold">🐾 Mon équipe d'Aniimo</h2>
          <p className="text-sm text-slate-300">
            <strong className="text-white">{equipe.length}</strong> possédé{equipe.length > 1 ? 's' : ''} sur {db.length}
          </p>
        </div>
        <div className="h-2 rounded-full bg-slate-700 overflow-hidden" role="progressbar" aria-label="Aniimo possédés" aria-valuemin={0} aria-valuemax={db.length} aria-valuenow={equipe.length}>
          <div className="h-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-slate-300">
          Touchez un Aniimo pour l'ajouter à votre équipe, touchez-le à nouveau pour le retirer.
          {besoins.length > 0 && (
            <> {nbCouverts === cov.length
              ? <span className="text-emerald-300">✅ Votre grille est entièrement couverte.</span>
              : <span className="text-amber-300">⚠️ {cov.length - nbCouverts} besoin{cov.length - nbCouverts > 1 ? 's' : ''} de la grille sans Aniimo (voir plus bas).</span>}</>
          )}
        </p>
      </header>

      {/* Bannière EZ MODE */}
      {ezMode ? (
        <div className="p-3 bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border border-amber-500/60 rounded-xl flex items-center gap-3 shadow-md">
          <span className="text-2xl select-none">⚡</span>
          <div className="text-xs sm:text-sm">
            <span className="font-bold text-amber-300">EZ MODE Actif (Mode Électrique — Débloqué au Niv. 12) :</span>
            <p className="text-slate-300 mt-0.5">
              Vos 16 ateliers de fabrication tournent automatiquement <strong className="text-emerald-300">sans Aniimo dédié</strong> à 120 % de vitesse grâce au réseau électrique.
              Un seul Aniimo Foudre est requis pour le Générateur crépitant.
            </p>
          </div>
        </div>
      ) : level < 12 ? (
        <div className="p-3 bg-slate-900/60 border border-slate-700/80 rounded-xl flex items-center gap-3 text-xs text-slate-400">
          <span className="text-xl opacity-60 select-none">🔒</span>
          <div>
            <span className="font-semibold text-slate-300">EZ MODE (Électricité) : Déblocage au Niveau 12</span>
            <p className="text-slate-400 mt-0.5">
              Dès le niveau 12 du camping-car, le réseau électrique automatisera vos ateliers sans nécessiter d'Aniimo dédié !
            </p>
          </div>
        </div>
      ) : null}

      {/* ---- Collection : sélection des Aniimo ---- */}
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
          <div className="inline-flex rounded-lg overflow-hidden border border-slate-600" role="group" aria-label="Afficher">
            {[['tous', 'Tous'], ['possedes', `Possédés (${equipe.length})`], ['manquants', `Manquants (${db.length - equipe.length})`]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setStatut(v)} aria-pressed={statut === v}
                className={`px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${statut === v ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-200 hover:bg-slate-700'}`}>
                {l}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="equipe-tri">Trier par</label>
          <select id="equipe-tri" value={tri} onChange={(e) => setTri(e.target.value)}
            className="bg-slate-900 text-sm px-2 py-2 rounded-lg border border-slate-600 text-white focus:outline-none focus:border-indigo-400">
            <option value="capacite">Trier : par capacité</option>
            <option value="nom">Trier : A → Z</option>
          </select>
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
          <span aria-live="polite">
            {visibles.length} Aniimo affiché{visibles.length > 1 ? 's' : ''}
            {filtresActifs && <button type="button" onClick={reinitialiser} className="ml-2 text-sky-300 underline">Réinitialiser les filtres</button>}
          </span>
          {visibles.length > 0 && (
            <span className="flex gap-2">
              <button type="button" onClick={toutSelectionner} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                {filtresActifs ? 'Cocher les affichés' : 'Tout cocher'}
              </button>
              <button type="button" onClick={toutDeselectionner} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                {filtresActifs ? 'Décocher les affichés' : 'Tout décocher'}
              </button>
            </span>
          )}
        </div>

        {annulation && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 text-sm bg-slate-900 border border-indigo-400/60 rounded-lg px-3 py-2">
            <span>{annulation.libelle}.</span>
            <button type="button" onClick={annuler} className="font-bold text-amber-300 underline hover:text-amber-200">Annuler</button>
          </div>
        )}

        {visibles.length === 0 ? (
          <p className="text-sm text-slate-300 italic py-6 text-center">
            Aucun Aniimo ne correspond à ces filtres.{' '}
            <button type="button" onClick={reinitialiser} className="text-sky-300 underline not-italic">Réinitialiser</button>
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {visibles.map((a) => {
              const choisi = equipe.includes(a.nom);
              const els = elementsDe(a);
              return (
                <li key={a.nom}>
                  <button
                    type="button"
                    onClick={() => basculer(a.nom)}
                    aria-pressed={choisi}
                    aria-label={`${description(a)}${choisi ? ' — dans votre équipe' : ''}`}
                    title={description(a)}
                    className={`relative w-full min-h-[120px] flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      choisi ? 'bg-indigo-700/60 border-indigo-300 text-white' : 'bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <span aria-hidden="true" className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${choisi ? 'bg-emerald-400 text-slate-900' : 'bg-slate-800 border border-slate-600 text-transparent'}`}>✓</span>
                    <span className={choisi ? '' : 'opacity-80'}><AniimoMiniature aniimo={a} taille="lg" /></span>
                    <span className="block font-bold text-sm leading-tight break-words w-full">{a.nom}</span>
                    <span className="text-sm leading-none" aria-hidden="true">{els.map((e) => EMOJI_ELEMENT[e]).join('')}</span>
                    <span className={`inline-block text-xs border rounded px-1.5 ${STYLE_CAPACITE[a.capacite]}`}>
                      {EMOJI_CAPACITE[a.capacite]} {a.capacite === 'Aucune' ? els.join(' + ') : `${a.capacite} niv. ${a.nivMax}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---- Couverture de la grille ---- */}
      <details open={besoins.length > 0 && nbCouverts < cov.length} className="group p-4 bg-slate-900/60 rounded-xl border border-slate-700">
        <summary className="cursor-pointer select-none font-bold text-slate-200">
          ⚡ Votre équipe couvre-t-elle votre grille ?
          {besoins.length > 0 && <span className="ml-2 text-sm font-normal text-slate-300">{nbCouverts}/{cov.length} besoins couverts</span>}
        </summary>
        <div className="mt-3">
          {besoins.length === 0 ? (
            <p className="text-sm text-slate-300">
              Votre grille est vide : posez quelques installations pour voir quels Aniimo il vous faut.{' '}
              <button type="button" onClick={() => onAller('grille')} className="text-amber-300 underline hover:text-amber-200">Ouvrir la grille</button>
            </p>
          ) : (
            <>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {cov.map((b) => (
                  <li key={b.structure} className={`flex items-start gap-2 text-sm rounded-lg px-2.5 py-1.5 border ${b.couvert ? 'border-emerald-700/50 bg-emerald-950/30' : 'border-amber-600/60 bg-amber-950/30'}`}>
                    <span aria-hidden="true">{b.couvert ? '✅' : '⚠️'}</span>
                    <span className="min-w-0">
                      <span className="font-semibold text-white">
                        {b.electrique && <span className="mr-1 text-amber-400">⚡</span>}
                        {b.structure}
                      </span>
                      <span className="text-slate-300"> ×{b.nombre} · {b.roles.map((r) => `${EMOJI_ELEMENT[r] || EMOJI_CAPACITE[r] || ''} ${r}`).join(' / ')}</span>
                      <span className="block text-xs text-slate-300 mt-0.5">
                        {b.couvert ? <Pastilles noms={b.membres} /> : 'Aucun Aniimo de votre équipe'}
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
                      <li key={s.aniimo.nom} className="flex items-center gap-1.5 text-xs bg-slate-800 border border-slate-600 rounded-full pl-1 pr-2.5 py-1 text-slate-100" title={`Couvre : ${s.couvre.join(', ')}`}>
                        <AniimoMiniature aniimo={s.aniimo} taille="xs" />
                        {s.aniimo.nom}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => modifierGroupe(`${suggestion.length} Aniimo ajoutés`, [...new Set([...equipe, ...suggestion.map((s) => s.aniimo.nom)])])}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Ajouter ces {suggestion.length} Aniimo à mon équipe
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </details>

      {/* ---- Affectation optimale ---- */}
      <details className="group p-4 bg-slate-900/60 rounded-xl border border-slate-700">
        <summary className="cursor-pointer select-none font-bold text-slate-200">
          🎯 Qui placer où ? (affectation optimale)
          {installations.length > 0 && equipe.length > 0 && <span className="ml-2 text-sm font-normal text-emerald-300">≈ {Math.round(plan.total)} pièces/h</span>}
        </summary>
        <div className="mt-3">
          {installations.length === 0 ? (
            <p className="text-sm text-slate-300">Posez des installations sur la grille pour obtenir une répartition.</p>
          ) : equipe.length === 0 ? (
            <p className="text-sm text-slate-300">Ajoutez à votre équipe les Aniimo que vous possédez pour obtenir la répartition recommandée.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-200">
                Production estimée : <strong className="text-emerald-300">≈ {Math.round(plan.total)} pièces/h</strong>
                {plan.naif > 0 && plan.total > plan.naif && (
                  <> — soit <strong className="text-emerald-300">+{Math.round(plan.total - plan.naif)}</strong> par rapport à une affectation au premier venu ({Math.round(plan.naif)}).</>
                )}
              </p>
              {plan.electriques && plan.electriques.length > 0 && (
                <div className="p-2.5 bg-amber-950/40 border border-amber-500/50 rounded-lg text-xs flex items-center justify-between text-amber-200">
                  <span className="flex items-center gap-1.5">
                    <span>⚡</span>
                    <span><strong>{plan.electriques.length} atelier{plan.electriques.length > 1 ? 's' : ''} en mode électrique (EZ) :</strong> production autonome sans Aniimo (vitesse ×1,2).</span>
                  </span>
                  <span className="font-mono text-emerald-300 font-bold whitespace-nowrap ml-2">+{Math.round(plan.profitElectrique)} pièces/h</span>
                </div>
              )}
              <ul className="space-y-1 text-sm">
                {(voirTout ? plan.affectations : plan.affectations.slice(0, 8)).map((x) => (
                  <li key={x.installation.cle} className="flex items-center gap-2 bg-slate-800/70 rounded px-2 py-1">
                    <AniimoMiniature aniimo={x.aniimo} taille="sm" />
                    <span className="flex-1 min-w-0">
                      <strong>{x.aniimo.nom}</strong> → {x.installation.structure} <span className="text-slate-300">({x.installation.recette})</span>
                    </span>
                    <span className="text-slate-300 text-right whitespace-nowrap">niv. {x.niveau} · ≈ {Math.round(x.piecesH)}/h</span>
                  </li>
                ))}
              </ul>
              {plan.affectations.length > 8 && (
                <button type="button" onClick={() => setVoirTout((v) => !v)} className="text-sm text-sky-300 underline">
                  {voirTout ? 'Réduire' : `Voir les ${plan.affectations.length} affectations`}
                </button>
              )}
              {plan.sansAniimo.length > 0 && (
                <p className="text-sm text-amber-300">
                  ⚠️ {plan.sansAniimo.length} installation{plan.sansAniimo.length > 1 ? 's' : ''} sans Aniimo adapté dans votre équipe : {[...new Set(plan.sansAniimo.map((i) => i.structure))].join(', ')}.
                </p>
              )}
              {plan.acquerir.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-200">Aniimo à acquérir en priorité</p>
                  <ul className="text-sm text-slate-200 space-y-1 mt-1">
                    {plan.acquerir.slice(0, 5).map((x) => (
                      <li key={x.installation.cle} className="flex items-center gap-2">
                        <AniimoMiniature aniimo={x.aniimo} taille="sm" />
                        <span>
                          <strong>{x.aniimo.nom}</strong> sur {x.installation.structure} (niv. {x.niveau}) :{' '}
                          <span className="text-emerald-300">+{Math.round(x.gain)} pièces/h</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-400">
                Estimation : vitesse selon le niveau de compétence (×1, ×3, ×4, ×5), niveau de recette non pris en compte, bonus de personnalité ignoré.
                Niveaux relevés pour 74 Aniimo ; sinon niveau max supposé.
              </p>
            </div>
          )}
        </div>
      </details>

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
