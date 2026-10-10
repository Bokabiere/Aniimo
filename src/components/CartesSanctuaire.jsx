import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PLANS from '../data/sanctuaire_plans.json';
import { classer, empreinteDepuisSource } from '../lib/reconnaissance-plan.js';

const BASE = (import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/');
const img = (chemin) => `${BASE}${chemin}`;

const DIRECTIONS = [
  { id: 'NW', label: 'Nord-ouest', fleche: '↖', col: 1, row: 1 },
  { id: 'N', label: 'Nord', fleche: '↑', col: 2, row: 1 },
  { id: 'NE', label: 'Nord-est', fleche: '↗', col: 3, row: 1 },
  { id: 'W', label: 'Ouest', fleche: '←', col: 1, row: 2 },
  { id: 'E', label: 'Est', fleche: '→', col: 3, row: 2 },
  { id: 'SW', label: 'Sud-ouest', fleche: '↙', col: 1, row: 3 },
  { id: 'S', label: 'Sud', fleche: '↓', col: 2, row: 3 },
  { id: 'SE', label: 'Sud-est', fleche: '↘', col: 3, row: 3 },
];
const NOM_DIR = Object.fromEntries(DIRECTIONS.map((d) => [d.id, d.label.toLowerCase()]));

const DIFFICULTES = [
  { id: 'cauchemar-chaos', label: '💀 Cauchemar / Chaos', note: 'Cauchemar et Chaos tirent les mêmes plans ; seuls changent les chances, l\'obscurité, les monstres et le butin.' },
  { id: 'difficile', label: 'Difficile', note: '6 plans possibles.' },
  { id: 'debutant', label: 'Débutant', note: '8 plans possibles.' },
];

const LIBELLE_MARQUE = {
  nest: 'Nid d\'œufs',
  'key-gold': 'Clé dorée',
  'key-purple': 'Clé violette',
  'key-blue': 'Clé bleue',
  challenge: 'Salle du défi',
  'door-main': 'Entrée principale (porte orange)',
  'door-side': 'Entrée secondaire (porte bleue)',
};
const LIBELLE_COMPTE = {
  'key-gold': 'Salles à clé dorée',
  'key-purple': 'Salles à clé violette',
  'key-blue': 'Salles à clé bleue',
  nest: 'Nids d\'œufs',
  challenge: 'Salles du défi',
  'chest-gold': 'Salles à coffres dorés',
};
const ICONE_COMPTE = (type) =>
  type === 'chest-gold' ? img('aniimo/sanctuaire/chest-gold.webp') : img(`aniimo/sanctuaire/marks/${type}.webp`);

function Marqueur({ pin, taille = 18 }) {
  const porte = pin.type.startsWith('door');
  const t = porte ? taille + 6 : taille;
  return (
    <img
      src={img(`aniimo/sanctuaire/marks/${pin.type}.webp`)}
      alt={LIBELLE_MARQUE[pin.type] || pin.type}
      title={LIBELLE_MARQUE[pin.type] || pin.type}
      width={t}
      height={t}
      style={{ position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`, width: t, height: t, transform: 'translate(-50%, -50%)' }}
      className={porte ? 'z-20' : 'z-10 drop-shadow'}
    />
  );
}

function Carte({ plan, grande = false, onClick }) {
  const pins = plan.pins;
  const contenu = (
    <div
      className="relative w-full bg-slate-950 rounded-lg overflow-hidden"
      style={{ aspectRatio: plan.ratio || 1.5 }}
    >
      <img src={img(plan.image)} alt={`Plan ${plan.numero}`} className="absolute inset-0 w-full h-full object-contain" loading="lazy" />
      {pins.map((p, i) => <Marqueur key={i} pin={p} taille={grande ? 26 : 16} />)}
    </div>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="block w-full text-left">{contenu}</button>
  ) : contenu;
}

function Comptes({ comptes }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300">
      {Object.entries(comptes).map(([type, n]) => (
        <span key={type} className="inline-flex items-center gap-1" title={LIBELLE_COMPTE[type] || type}>
          <img src={ICONE_COMPTE(type)} alt={LIBELLE_COMPTE[type] || type} width={18} height={18} className="w-[18px] h-[18px]" />
          <b>{n}</b>
        </span>
      ))}
    </div>
  );
}

/** Onglet « Cartes » : plans du Sanctuaire perdu (Chasse aux œufs), filtrables par direction de la porte bleue. */
export default function CartesSanctuaire() {
  const [difficulte, setDifficulte] = useState('cauchemar-chaos');
  const [direction, setDirection] = useState(null);
  const [ouvert, setOuvert] = useState(null);

  const duGroupe = useMemo(() => PLANS.filter((p) => p.difficulte === difficulte), [difficulte]);
  const presentes = useMemo(() => new Set(duGroupe.map((p) => p.direction)), [duGroupe]);
  const compte = useMemo(() => {
    const c = {};
    duGroupe.forEach((p) => { c[p.direction] = (c[p.direction] || 0) + 1; });
    return c;
  }, [duGroupe]);
  const plans = direction ? duGroupe.filter((p) => p.direction === direction) : duGroupe;
  const plan = ouvert ? PLANS.find((p) => p.id === ouvert) : null;
  const choisirDifficulte = (id) => { setDifficulte(id); setDirection(null); };

  // ----- Identification par capture d'écran -----
  const [capture, setCapture] = useState(null);
  const [resultats, setResultats] = useState(null);
  const [analyse, setAnalyse] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [survol, setSurvol] = useState(false);
  const fichierRef = useRef(null);
  const referencesRef = useRef(null);

  const references = useCallback(async () => {
    if (!referencesRef.current) {
      referencesRef.current = Promise.all(
        PLANS.map(async (p) => ({ id: p.id, empreinte: await empreinteDepuisSource(img(p.image)) })),
      );
    }
    return referencesRef.current;
  }, []);

  const analyserFichier = useCallback(async (fichier) => {
    if (!fichier || !fichier.type?.startsWith('image/')) { setErreur('Ce fichier n\'est pas une image.'); return; }
    setErreur(null); setAnalyse(true); setResultats(null);
    const url = URL.createObjectURL(fichier);
    try {
      setCapture(url);
      const [refs, empreinte] = await Promise.all([references(), empreinteDepuisSource(url)]);
      if (!empreinte) throw new Error('Aucune carte détectée dans cette image.');
      setResultats(classer(empreinte, refs.filter((r) => r.empreinte)).slice(0, 3));
    } catch (e) {
      setErreur(e.message || 'Analyse impossible.');
    } finally {
      setAnalyse(false);
    }
  }, [references]);

  useEffect(() => {
    const surColler = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
      if (f) { e.preventDefault(); analyserFichier(f); }
    };
    document.addEventListener('paste', surColler);
    return () => document.removeEventListener('paste', surColler);
  }, [analyserFichier]);

  const voirPlan = (p) => { setDifficulte(p.difficulte); setDirection(null); setOuvert(p.id); };

  return (
    <section className="bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-700">
      <h2 className="text-2xl font-bold mb-1">🧭 Cartes du Sanctuaire perdu</h2>
      <p className="text-slate-400 text-sm mb-4">
        Chasse aux œufs (mode équipe). Ouvrez la carte en jeu : la porte <b className="text-orange-400">orange</b> est l'entrée principale,
        la <b className="text-sky-400">bleue</b> l'entrée secondaire. Choisissez la direction de la porte bleue vue depuis l'orange.
      </p>

      <div
        className={`mb-5 rounded-xl border-2 border-dashed p-3 transition ${survol ? 'border-amber-400 bg-amber-500/10' : 'border-slate-600 bg-slate-900/60'}`}
        onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => { e.preventDefault(); setSurvol(false); analyserFichier(e.dataTransfer.files?.[0]); }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <b className="text-sm">📸 Identifier mon plan</b>
          <span className="text-xs text-slate-400">Collez (Ctrl+V) ou glissez une capture de la carte en jeu, ou</span>
          <button type="button" onClick={() => fichierRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold">Choisir une image</button>
          <input ref={fichierRef} type="file" accept="image/*" className="hidden" onChange={(e) => { analyserFichier(e.target.files?.[0]); e.target.value = ''; }} />
          {capture && <button type="button" onClick={() => { setCapture(null); setResultats(null); setErreur(null); }} className="ml-auto text-xs text-slate-400 hover:text-white underline">Effacer</button>}
        </div>
        {analyse && <p className="mt-2 text-xs text-slate-400">Analyse en cours…</p>}
        {erreur && <p className="mt-2 text-xs text-red-400">{erreur}</p>}
        {capture && resultats && (
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <img src={capture} alt="Capture analysée" className="max-h-40 rounded-lg border border-slate-700 object-contain bg-slate-950 self-start" />
            <div className="flex-1 grid gap-2 grid-cols-1 sm:grid-cols-3">
              {resultats.map((r, i) => {
                const p = PLANS.find((x) => x.id === r.id);
                const pct = Math.round(r.score * 100);
                const diff = DIFFICULTES.find((d) => d.id === p.difficulte);
                return (
                  <button key={r.id} type="button" onClick={() => voirPlan(p)}
                    className={`text-left rounded-lg border p-2 hover:bg-slate-800 ${i === 0 ? 'border-amber-400 bg-slate-800' : 'border-slate-700 bg-slate-900'}`}>
                    <Carte plan={p} />
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <b>{i === 0 ? '🏆 ' : ''}Plan {p.numero}</b>
                      <span className={pct >= 70 ? 'text-emerald-400 font-bold' : pct >= 50 ? 'text-amber-300' : 'text-slate-400'}>{pct} %</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{diff?.label.replace('💀 ', '')} — porte bleue au {NOM_DIR[p.direction]}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {resultats && resultats[0].score < 0.5 && (
          <p className="mt-2 text-xs text-amber-300">Correspondance faible : recadrez la capture sur la carte seule (sans interface) ou utilisez les filtres ci-dessous.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-2" role="group" aria-label="Difficulté">
        {DIFFICULTES.map((d) => (
          <button key={d.id} type="button" aria-pressed={difficulte === d.id} onClick={() => choisirDifficulte(d.id)}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition ${
              difficulte === d.id ? 'bg-amber-500 text-slate-900 border-amber-300 shadow-lg' : 'bg-slate-900 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
            {d.label} <span className="opacity-70">({PLANS.filter((p) => p.difficulte === d.id).length})</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 mb-4">{DIFFICULTES.find((d) => d.id === difficulte)?.note}</p>

      <div className="flex flex-col sm:flex-row gap-4 mb-5 items-start">
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Direction de la porte bleue">
          {[1, 2, 3].flatMap((row) => [1, 2, 3].map((col) => {
            if (col === 2 && row === 2) {
              return (
                <button key="tous" type="button" onClick={() => setDirection(null)}
                  className={`w-14 h-14 rounded-xl text-xs font-bold border ${direction === null ? 'bg-amber-500 text-slate-900 border-amber-300' : 'bg-slate-900 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                  Tous
                </button>
              );
            }
            const d = DIRECTIONS.find((x) => x.col === col && x.row === row);
            const dispo = presentes.has(d.id);
            const actif = direction === d.id;
            return (
              <button key={d.id} type="button" disabled={!dispo} onClick={() => setDirection(actif ? null : d.id)}
                title={`Porte bleue au ${d.label.toLowerCase()}`} aria-pressed={actif}
                className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center transition ${
                  actif ? 'bg-amber-500 text-slate-900 border-amber-300 shadow-lg'
                    : dispo ? 'bg-slate-900 border-slate-600 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed'}`}>
                <span className="text-xl leading-none">{d.fleche}</span>
                <span className="text-[10px] font-bold">{dispo ? compte[d.id] : '–'}</span>
              </button>
            );
          }))}
        </div>
        <ul className="text-xs text-slate-400 space-y-1">
          <li className="font-bold text-slate-300">Légende</li>
          {Object.entries(LIBELLE_MARQUE).map(([type, label]) => (
            <li key={type} className="flex items-center gap-2">
              <img src={img(`aniimo/sanctuaire/marks/${type}.webp`)} alt="" width={18} height={18} className="w-[18px] h-[18px]" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-slate-400 mb-3">{plans.length} plan{plans.length > 1 ? 's' : ''}{direction ? ` — porte bleue au ${NOM_DIR[direction]}` : ''}</p>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {plans.map((p) => (
          <article key={p.id} className="bg-slate-900 border border-slate-700 rounded-xl p-2 space-y-2">
            <Carte plan={p} onClick={() => setOuvert(p.id)} />
            <div className="flex items-center justify-between px-1">
              <b>Plan {p.numero}</b>
              {p.rare && <span className="text-[10px] font-bold bg-amber-400 text-slate-900 rounded-full px-2 py-0.5">plus rare</span>}
            </div>
            <div className="px-1 text-xs text-slate-400">porte bleue au {NOM_DIR[p.direction]}</div>
            <div className="px-1 pb-1"><Comptes comptes={p.comptes} /></div>
          </article>
        ))}
      </div>

      {plan && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3" onClick={() => setOuvert(null)} role="dialog" aria-modal="true" aria-label={`Plan ${plan.numero}`}>
          <div className="bg-slate-900 border border-slate-600 rounded-2xl p-4 w-full max-w-4xl max-h-full overflow-auto space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Plan {plan.numero} <span className="text-sm font-normal text-slate-400">— porte bleue au {NOM_DIR[plan.direction]}</span></h3>
              <button type="button" onClick={() => setOuvert(null)} className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold" aria-label="Fermer">✕</button>
            </div>
            <Carte plan={plan} grande />
            <Comptes comptes={plan.comptes} />
          </div>
        </div>
      )}
      <p className="mt-5 text-[11px] text-slate-500">Données des plans : AniimoTools (aniimotools.dev), utilisées avec l'accord de l'auteur, usage personnel.</p>
    </section>
  );
}
