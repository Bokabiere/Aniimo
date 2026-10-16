import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PLANS from '../data/sanctuaire_plans.json';
import { classer, empreinteDepuisSource, planStable, signatureDepuisSource, analyseMinimapVideo,
  observationCarteDepuisSource, observationCarteDepuisVideo } from '../lib/reconnaissance-plan.js';
import { classerParSalle, classerParCarte, scoreCarte, vecteurPlan, libelleSorties } from '../lib/salle-depart.js';
import { preparerRef, positionDepuisCarte, recalageRepere, RAYON_DISQUE } from '../lib/localisation.js';
import { creerFiltre, mettreAJourFiltre, extrapoler, qualiteCorrelation } from '../lib/lissage.js';
import { creerSuiviAsync } from '../lib/suivi-async.js';
import { plusProche, estOeuf, estCle } from '../lib/objectifs.js';
import { calibrerEchelle, creerHypotheses, classerHypotheses, decision, elaguer, CORR_MIN } from '../lib/suivi.js';

// Cadence de l'analyse : au plus une image toutes les 60 ms (≈ 15 images/s demandées au partage d'écran), sans attendre un délai fixe
// après le calcul : l'analyse suit les images de la vidéo. Le point, lui, est animé à chaque image de l'écran (PointJoueur).
const INTERVALLE_AUTO_MS = 60;
// Si le partage d'écran n'envoie plus d'image (écran fixe), on analyse quand même au bout de ce délai.
const CHIEN_DE_GARDE_MS = 700;
// Rafraîchissement des aperçus et du diagnostic (coûteux : JPEG + rendu), indépendant de la cadence de l'analyse.
const INTERVALLE_UI_S = 0.5;
// Rafraîchissement maximal de la position affichée (l'animation comble entre deux mises à jour).
const INTERVALLE_POSITION_S = 0.08;
// Sans mesure depuis ce délai, le point est retiré plutôt que de montrer une position fausse.
const SANS_MESURE_MAX_S = 2.5;
const CLE_ZONE = 'aniimo_zone_minimap_v1';
// Minimap du jeu : en haut à gauche de l'écran (fractions de l'image partagée), sauf zone dessinée par l'utilisateur.
const ZONE_PAR_DEFAUT = { x: 0, y: 0, w: 0.25, h: 0.35 };
const CLE_FAITS = 'aniimo_pins_faits_v1';
const PARTAGE_ECRAN_DISPONIBLE = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

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

function Marqueur({ pin, taille = 18, fait = false, cible = false, onClick = null }) {
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
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      className={`${porte ? 'z-20' : 'z-10 drop-shadow'} ${onClick && !porte ? 'cursor-pointer' : ''} ${fait ? 'opacity-30 grayscale' : ''} ${cible ? 'animate-pulse ring-2 ring-emerald-300 rounded-full bg-emerald-300/30' : ''}`}
    />
  );
}

/**
 * Point du joueur animé. À chaque image de l'écran il est placé sur la position lissée prolongée par la vitesse (extrapolation
 * amortie, qui compense aussi le temps de calcul), puis rapproché en douceur de cette cible : plus de saut à chaque mesure.
 * Le déplacement passe directement par le DOM (aucun rendu React entre deux mesures).
 */
function PointJoueur({ joueur, grande }) {
  const point = useRef(null);
  const halo = useRef(null);
  const cible = useRef(joueur);
  cible.current = joueur;
  useEffect(() => {
    let raf = 0;
    let dernier = performance.now();
    let a = null; // position affichée { id, x, y } (% du plan)
    const boucle = (now) => {
      const j = cible.current;
      if (j && point.current && halo.current) {
        const c = extrapoler({ x: j.x, y: j.y, vx: j.vx || 0, vy: j.vy || 0 }, (now - (j.t ?? now)) / 1000);
        if (!a || a.id !== j.id) a = { id: j.id, x: c.x, y: c.y };
        else {
          const k = 1 - Math.exp(-Math.max(0, now - dernier) / 1000 / 0.06);
          a.x += (c.x - a.x) * k; a.y += (c.y - a.y) * k;
        }
        point.current.style.left = `${a.x}%`; point.current.style.top = `${a.y}%`; point.current.style.visibility = 'visible';
        halo.current.style.left = `${a.x}%`; halo.current.style.top = `${a.y}%`;
        halo.current.style.width = `${Math.min(60, (j.rayon || 0) * 2)}%`;
        halo.current.style.visibility = j.rayon > 0 ? 'visible' : 'hidden';
      }
      dernier = now;
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      <span
        ref={halo}
        aria-hidden="true"
        style={{ position: 'absolute', visibility: 'hidden', aspectRatio: '1', transform: 'translate(-50%, -50%)' }}
        className="z-20 rounded-full border border-yellow-300/70 bg-yellow-300/15 pointer-events-none"
      />
      <span
        ref={point}
        title="Ma position"
        style={{ position: 'absolute', visibility: 'hidden', transform: 'translate(-50%, -50%)' }}
        className={`z-30 block ${grande ? 'w-6 h-6' : 'w-4 h-4'} rounded-full bg-yellow-300 border-2 border-white shadow-[0_0_8px_3px_rgba(250,204,21,0.8)] animate-pulse pointer-events-none`}
      />
    </>
  );
}

function Carte({ plan, grande = false, onClick, joueur = null, faits = null, onBasculer = null, cible = null, onPlacer = null }) {
  const pins = plan.pins;
  const contenu = (
    <div
      className={`relative w-full bg-slate-950 rounded-lg overflow-hidden ${onPlacer ? 'cursor-crosshair ring-2 ring-sky-400' : ''}`}
      style={{ aspectRatio: plan.ratio || 1.5 }}
      onClick={onPlacer ? (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onPlacer(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)));
      } : undefined}
    >
      <img src={img(plan.image)} alt={`Plan ${plan.numero}`} className="absolute inset-0 w-full h-full object-contain" loading="lazy" />
      {joueur && cible != null && plan.pins[cible] && (
        <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1={joueur.x} y1={joueur.y} x2={plan.pins[cible].x} y2={plan.pins[cible].y} stroke="#6ee7b7" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {pins.map((p, i) => (
        <Marqueur key={i} pin={p} taille={grande ? 26 : 16} fait={!!faits && faits.has(i)} cible={cible === i}
          onClick={onBasculer && !p.type.startsWith('door') ? () => onBasculer(i) : null} />
      ))}
      {joueur && <PointJoueur joueur={joueur} grande={grande} />}
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

/** Image de diagnostic : la zone de minimap telle qu'analysée, avec la salle trouvée (jaune), le joueur (rouge) et le disque comparé (cyan). */
function dessinerDiagnostic(video, zone, mm, tailleMM) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const c = document.createElement('canvas');
  c.width = mm.w; c.height = mm.h;
  const ctx = c.getContext('2d');
  ctx.drawImage(video, zone.x * vw, zone.y * vh, zone.w * vw, zone.h * vh, 0, 0, mm.w, mm.h);
  const b = mm.signature.boite;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#facc15';
  ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
  if (mm.centre) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(mm.centre.x, mm.centre.y, 4, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = '#22d3ee';
    ctx.beginPath(); ctx.arc(mm.centre.x, mm.centre.y, RAYON_DISQUE * (tailleMM || 2 * mm.signature.demi + 1), 0, 2 * Math.PI); ctx.stroke();
  }
  return c.toDataURL('image/jpeg', 0.7);
}

/** Aperçu de l'écran partagé sur lequel on dessine à la souris la zone de la minimap (fractions 0..1). */
function ZoneMinimap({ apercu, zone, personnalisee, onChange }) {
  const [debut, setDebut] = useState(null);
  const [courante, setCourante] = useState(null);
  const point = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const rect = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  const affichee = courante || zone;
  return (
    <div className="mt-2">
      <p className="text-xs text-slate-300 mb-1">
        Zone de la minimap : <b>dessinez un rectangle</b> autour d'elle sur l'aperçu si elle n'est pas en haut à gauche
        {personnalisee
          ? <button type="button" onClick={() => onChange(null)} className="ml-2 underline text-slate-400 hover:text-white">Revenir à la zone par défaut (haut gauche)</button>
          : <span className="ml-2 text-slate-500">(par défaut : haut gauche de l'écran)</span>}
      </p>
      <div
        className="relative inline-block max-w-full touch-none cursor-crosshair select-none rounded-lg overflow-hidden border border-slate-600"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const p = point(e); setDebut(p); setCourante({ ...p, w: 0, h: 0 }); }}
        onPointerMove={(e) => { if (debut) setCourante(rect(debut, point(e))); }}
        onPointerUp={(e) => {
          if (!debut) return;
          const r = rect(debut, point(e));
          setDebut(null); setCourante(null);
          if (r.w > 0.02 && r.h > 0.02) onChange(r);
        }}
      >
        <img src={apercu} alt="Aperçu de l'écran partagé" draggable={false} className="block max-h-56" />
        {affichee && (
          <div className="absolute border-2 border-amber-400 bg-amber-400/10 pointer-events-none"
            style={{ left: `${affichee.x * 100}%`, top: `${affichee.y * 100}%`, width: `${affichee.w * 100}%`, height: `${affichee.h * 100}%` }} />
        )}
      </div>
    </div>
  );
}

/** Onglet « Cartes » : plans du Sanctuaire perdu (Chasse aux œufs), filtrables par direction de la porte bleue. */
export default function CartesSanctuaire() {
  const [difficulte, setDifficulte] = useState('cauchemar-chaos');
  const [direction, setDirection] = useState(null);
  const [ouvert, setOuvert] = useState(null);
  // Éléments déjà récupérés (œufs, clés) cochés par le joueur : { [idPlan]: [indices de pins] }, conservés d'une visite à l'autre.
  const [faitsParPlan, setFaitsParPlan] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CLE_FAITS)) || {}; } catch { return {}; }
  });
  const faitsDe = (id) => new Set(faitsParPlan[id] || []);
  const basculerFait = (id, i) => setFaitsParPlan((prec) => {
    const cur = new Set(prec[id] || []);
    if (cur.has(i)) cur.delete(i); else cur.add(i);
    const suiv = { ...prec, [id]: [...cur] };
    try { localStorage.setItem(CLE_FAITS, JSON.stringify(suiv)); } catch { /* stockage indisponible */ }
    return suiv;
  });
  const viderFaits = (id) => setFaitsParPlan((prec) => {
    const suiv = { ...prec, [id]: [] };
    try { localStorage.setItem(CLE_FAITS, JSON.stringify(suiv)); } catch { /* stockage indisponible */ }
    return suiv;
  });

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

  // Difficulté de la partie en cours (null = toutes) : restreint les plans candidats à la reconnaissance.
  const [diffReco, setDiffReco] = useState(null);
  const diffRecoRef = useRef(null);
  // Source : 'minimap' = salle d'arrivée de la minimap en jeu (début de partie) ; 'carte' = carte entière (silhouette).
  const [modeSource, setModeSource] = useState('minimap');
  const modeRef = useRef('minimap');
  // La minimap pivote-t-elle avec la caméra ? (sinon le nord est fixe en haut)
  const [pivote, setPivote] = useState(false);
  const pivoteRef = useRef(false);
  // Zone de la minimap dans l'écran partagé (fractions 0..1), mémorisée dans le navigateur.
  const [zone, setZone] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CLE_ZONE)) || null; } catch { return null; }
  });
  const zoneRef = useRef(zone);
  const [apercu, setApercu] = useState(null); // image réduite de l'écran partagé, pour dessiner la zone
  const [salle, setSalle] = useState(null);   // { sorties, possibles: [ids] } : dernière salle d'arrivée lue

  // Plans écartés par le joueur (« ce n'est pas celui-ci ») : ils ne sont plus proposés tant qu'on ne relance pas l'analyse.
  const exclusRef = useRef(new Set());
  const [exclus, setExclus] = useState([]);
  const [verrouille, setVerrouille] = useState(null); // plan validé par le joueur : il ne change plus tant qu'on ne le déverrouille pas

  const candidats = useCallback((refs) => {
    const d = diffRecoRef.current;
    return refs.filter((r) => !exclusRef.current.has(r.id) && (!d || PLANS.find((p) => p.id === r.id)?.difficulte === d));
  }, []);

  /** Classement d'une observation { signature, empreinte } ; renvoie { liste: [{ id, score }], exacts: [ids] | null }. */
  const classerObservation = useCallback((refs, { signature, empreinte, carte }) => {
    const c = candidats(refs);
    if (carte) {
      return { liste: classerParCarte(carte, c), exacts: null };
    }
    if (modeRef.current === 'minimap' && signature) {
      const empreintes = empreinte ? new Map(classer(empreinte, c).map((r) => [r.id, r.score])) : null;
      const liste = classerParSalle(signature, c, { pivote: pivoteRef.current })
        .sort((a, b) => b.score - a.score || (empreintes ? (empreintes.get(b.id) || 0) - (empreintes.get(a.id) || 0) : 0));
      const exacts = liste.filter((r) => r.score >= 0.999).map((r) => r.id);
      return { liste, exacts };
    }
    return { liste: empreinte ? classer(empreinte, c) : [], exacts: null };
  }, [candidats]);

  /**
   * Capture automatique : combine la salle d'arrivée (minimap, verrouillée en phase 1) et la carte entière (vecteur entre les portes).
   * Score = 30 % salle + 70 % carte quand les deux sont connues ; `exacts` = plans compatibles avec la seule salle.
   */
  const classerAuto = useCallback((refs, { sorties, carte }) => {
    const c = candidats(refs);
    const parSalle = sorties !== null ? new Map(classerParSalle({ sorties }, c, { pivote: pivoteRef.current }).map((r) => [r.id, r.score])) : null;
    const parCarte = carte ? new Map(classerParCarte(carte, c).map((r) => [r.id, r.score])) : null;
    const liste = c.map((r) => {
      const ps = parSalle ? parSalle.get(r.id) || 0 : 0;
      const pc = parCarte ? parCarte.get(r.id) || 0 : 0;
      return { id: r.id, score: parSalle && parCarte ? 0.3 * ps + 0.7 * pc : parCarte ? pc : ps };
    }).sort((a, b) => b.score - a.score);
    const exacts = !parCarte && parSalle ? liste.filter((r) => r.score >= 0.999).map((r) => r.id) : null;
    return { liste, exacts };
  }, [candidats]);

  const references = useCallback(async () => {
    if (!referencesRef.current) {
      referencesRef.current = Promise.all(
        PLANS.map(async (p) => {
          const signature = await signatureDepuisSource(img(p.image), { ancre: p.depart });
          // Vecteur porte principale → porte secondaire, en tailles de salle de départ (indépendant du zoom).
          const pin = (type) => p.pins.find((x) => x.type === type);
          const [pm, ps] = [pin('door-main'), pin('door-side')];
          const px = (q) => (q && signature ? { x: (q.x / 100) * signature.largeur, y: (q.y / 100) * signature.hauteur } : null);
          const taille = signature ? 2 * signature.demi + 1 : 0;
          return {
            id: p.id,
            empreinte: await empreinteDepuisSource(img(p.image)),
            signature,
            vecteur: signature ? vecteurPlan(px(pm), px(ps), taille) : null,
            // Pour situer le joueur : taille de la salle de départ, porte orange, départ et masque préparé (en pixels de la miniature).
            taille,
            largeur: signature ? signature.largeur : 0,
            hauteur: signature ? signature.hauteur : 0,
            porteOrange: px(pm),
            depart: px(p.depart),
            refPad: signature && signature.masque ? preparerRef(signature.masque, signature.largeur, signature.hauteur, Math.ceil(RAYON_DISQUE * taille) + 2) : null,
          };
        }),
      );
    }
    return referencesRef.current;
  }, []);

  const afficher = useCallback(({ liste, exacts }, signature) => {
    setResultats(liste.slice(0, exacts && exacts.length > 3 ? 6 : 3));
    setSalle(signature && exacts ? { sorties: signature.sorties, possibles: exacts } : null);
  }, []);

  const analyserFichier = useCallback(async (fichier) => {
    if (!fichier || !fichier.type?.startsWith('image/')) { setErreur('Ce fichier n\'est pas une image.'); return; }
    setErreur(null); setAnalyse(true); setResultats(null); setSalle(null);
    const url = URL.createObjectURL(fichier);
    try {
      setCapture(url);
      const [refs, empreinte, signature, carte] = await Promise.all([
        references(), empreinteDepuisSource(url), signatureDepuisSource(url), observationCarteDepuisSource(url),
      ]);
      // Une image où les deux portes (orange et bleue) sont visibles est une carte entière, quel que soit le mode choisi.
      const parCarte = !!carte && (modeRef.current === 'carte' || !!carte.vecteur);
      const minimap = !parCarte && modeRef.current === 'minimap';
      const resultat = classerObservation(refs, { signature: minimap ? signature : null, empreinte, carte: parCarte ? carte : null });
      if (!resultat.liste.length) throw new Error(minimap ? 'Aucune salle d\'arrivée détectée : recadrez la capture sur la minimap.' : 'Aucune carte détectée dans cette image.');
      afficher(resultat, minimap ? signature : null);
    } catch (e) {
      setErreur(e.message || 'Analyse impossible.');
    } finally {
      setAnalyse(false);
    }
  }, [references, classerObservation, afficher]);

  useEffect(() => {
    const surColler = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
      if (f) { e.preventDefault(); analyserFichier(f); }
    };
    document.addEventListener('paste', surColler);
    return () => document.removeEventListener('paste', surColler);
  }, [analyserFichier]);

  const voirPlan = (p) => { setDifficulte(p.difficulte); setDirection(null); setOuvert(p.id); };

  // ----- Capture automatique (partage d'écran) -----
  const [auto, setAuto] = useState(false);
  const [planDetecte, setPlanDetecte] = useState(null);
  const [diag, setDiag] = useState(null);           // dernier état interne de l'analyse (panneau de diagnostic)
  const [apercuDiag, setApercuDiag] = useState(null); // minimap telle que l'outil la voit (salle, joueur, disque comparé)
  const [position, setPosition] = useState(null); // { id, x, y (en % du plan), source: 'minimap' | 'carte' }
  const [enPause, setEnPause] = useState(false); // minimap non visible (inventaire, menu...) : analyse suspendue
  const [phaseAuto, setPhaseAuto] = useState(1); // 1 = lecture de la minimap ; 2 = suivi continu minimap + carte
  const sessionRef = useRef(null); // { flux, video, minuteur, histo1, histo2, verrou, occupe, dernierStable }

  const reinitialiserAuto = () => {
    setResultats(null); setPlanDetecte(null); setSalle(null);
    setPhaseAuto(1); setPosition(null);
    const s = sessionRef.current;
    if (s) { s.histo1 = []; s.histo2 = []; s.verrou = null; s.dernierStable = null; s.centre = null; s.tailleMM = null; s.hyps = null; s.courant = null; s.force = null; s.manuel = false; s.filtre = null; s.tHisto1 = null; s.tMesure = null; s.tDerniereMesure = null; s.tPos = null; }
    exclusRef.current = new Set(); setExclus([]); setVerrouille(null);
  };
  /** Le joueur valide le plan : il est verrouillé (plus de changement automatique), le suivi de position continue dessus. */
  const confirmerPlan = (id) => {
    noterEvt({ evt: 'valide', plan: PLANS.find((x) => x.id === id)?.numero });
    const s = sessionRef.current;
    if (s) s.force = id;
    setVerrouille(id); setPlanDetecte(id);
    const p = PLANS.find((x) => x.id === id);
    if (p) voirPlan(p);
  };
  const deverrouiller = () => {
    const s = sessionRef.current;
    if (s) { s.force = null; s.manuel = false; }
    setVerrouille(null);
  };
  /** Le joueur écarte ce plan : il n'est plus proposé, l'analyse continue sur les autres. */
  const rejeterPlan = (id) => {
    noterEvt({ evt: 'rejet', plan: PLANS.find((x) => x.id === id)?.numero });
    exclusRef.current.add(id);
    setExclus([...exclusRef.current]);
    const s = sessionRef.current;
    if (s) {
      if (s.hyps) s.hyps = s.hyps.filter((h) => h.id !== id);
      if (s.courant === id) s.courant = null;
      if (s.force === id) s.force = null;
      s.dernierStable = null;
    }
    setVerrouille((v) => (v === id ? null : v));
    setPlanDetecte(null); setPosition(null);
  };
  const reintegrerPlans = () => {
    exclusRef.current = new Set(); setExclus([]);
    const s = sessionRef.current;
    if (s) s.hyps = null;
  };
  // Placement manuel de la position : le joueur clique sur le plan, le suivi repart de ce point (minimap et carte).
  const [placement, setPlacement] = useState(true); // un clic sur le plan place ma position (désactivable)
  const placerPosition = async (planId, xPct, yPct) => {
    const s = sessionRef.current;
    if (!s) return;
    const refs = await references();
    const ref = refs.find((r) => r.id === planId);
    if (!ref || !ref.refPad) return;
    noterEvt({ evt: 'placement', plan: ref ? PLANS.find((x) => x.id === planId)?.numero : null, x: Math.round(xPct * 100) / 100, y: Math.round(yPct * 100) / 100 });
    const pos = { x: (xPct / 100) * ref.largeur, y: (yPct / 100) * ref.hauteur };
    exclusRef.current.delete(planId); setExclus([...exclusRef.current]);
    s.filtre = null; s.force = planId; s.manuel = true; s.tailleMM = null; s.tDerniereMesure = performance.now() / 1000; s.tMesure = null; s.courant = planId; s.dernierStable = planId;
    s.hyps = [{ id: planId, pos, score: 0.7, corr: 0, ticks: 10, perdus: 0 }];
    setVerrouille(planId); setPlanDetecte(planId);
    setPosition({ id: planId, x: xPct, y: yPct, source: 'manuel', dim: { largeur: ref.largeur, hauteur: ref.hauteur, taille: ref.taille } });
  };
  /** Bouton « placer ma position » (bascule le mode : le prochain clic sur le plan donne ma position). */
  const boutonPlacer = () => (
    <button type="button" onClick={() => setPlacement((v) => !v)}
      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${placement ? 'bg-sky-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
      🎯 {placement ? 'Clic sur le plan = placer ma position' : 'Placement au clic désactivé'}
    </button>
  );

  /** Boutons de validation d'un plan (verrouiller / écarter), réutilisés sur la carte, en fenêtre et en plein écran. */
  const barreValidation = (id) => {
    if (!id || !auto) return null;
    const num = PLANS.find((x) => x.id === id)?.numero;
    return verrouille === id ? (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded-lg bg-emerald-600/30 border border-emerald-400 text-emerald-200 font-bold">🔒 Plan {num} validé</span>
        <button type="button" onClick={deverrouiller} className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600">Déverrouiller</button>
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-300">Plan {num} :</span>
        <button type="button" onClick={() => confirmerPlan(id)} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold">✓ C'est le bon</button>
        <button type="button" onClick={() => rejeterPlan(id)} className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-red-700 text-white font-bold">✗ Ce n'est pas celui-ci</button>
      </div>
    );
  };

  // Mode plein écran : le plan (avec ma position, les objectifs et la validation) occupe tout l'écran.
  const [plein, setPlein] = useState(false);
  const pleinRef = useRef(null);
  const [pleinId, setPleinId] = useState(null); // plan affiché en plein écran (sinon : plan suivi)
  const ouvrirPlein = (id = null) => {
    setPleinId(id); setPlein(true);
    // La demande doit partir du geste de l'utilisateur (le clic) : on passe la page entière en plein écran, la surcouche la remplit.
    try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch { /* plein écran navigateur indisponible : l'affichage reste en surimpression */ }
  };
  const fermerPlein = () => {
    setPlein(false); setPleinId(null);
    try { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); } catch { /* ignoré */ }
  };
  useEffect(() => {
    const surChangement = () => { if (!document.fullscreenElement) { setPlein(false); setPleinId(null); } };
    const surTouche = (e) => { if (e.key === 'Escape') setPlein(false); };
    document.addEventListener('fullscreenchange', surChangement);
    document.addEventListener('keydown', surTouche);
    return () => { document.removeEventListener('fullscreenchange', surChangement); document.removeEventListener('keydown', surTouche); };
  }, []);

  const choisirDiffReco = (id) => { diffRecoRef.current = id; setDiffReco(id); reinitialiserAuto(); };
  const choisirSource = (mode) => { modeRef.current = mode; setModeSource(mode); reinitialiserAuto(); };
  const changerPivote = (v) => { pivoteRef.current = v; setPivote(v); reinitialiserAuto(); };
  const definirZone = (z) => {
    zoneRef.current = z; setZone(z); reinitialiserAuto();
    try { if (z) localStorage.setItem(CLE_ZONE, JSON.stringify(z)); else localStorage.removeItem(CLE_ZONE); } catch { /* stockage indisponible */ }
  };

  // Enregistrement d'un trajet : une image de la minimap par seconde + les positions calculées + vos validations/placements.
  // Le fichier téléchargé permet de comprendre pourquoi le suivi a décroché et de régler l'analyse sur de vraies parties.
  const enregRef = useRef(null);
  const [enregistre, setEnregistre] = useState(false);
  const [nbImages, setNbImages] = useState(0);
  const noterEvt = (e) => { const r = enregRef.current; if (r) r.evts.push({ t: Math.round(performance.now() - r.debut), ...e }); };
  const exporterEnreg = useCallback(() => {
    const r = enregRef.current;
    enregRef.current = null;
    setEnregistre(false); setNbImages(0);
    if (!r || (!r.images.length && !r.evts.length)) return;
    const contenu = JSON.stringify({
      version: 1, date: new Date().toISOString(), video: r.video, zone: r.zone, difficulte: r.difficulte,
      images: r.images, evenements: r.evts,
    });
    const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `trajet-sanctuaire-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, []);
  const basculerEnreg = () => {
    if (enregRef.current) { exporterEnreg(); return; }
    enregRef.current = { debut: performance.now(), dernier: -1e9, images: [], evts: [], video: null, zone: null, difficulte: null };
    setEnregistre(true); setNbImages(0);
  };

  const arreterAuto = useCallback(() => {
    const s = sessionRef.current;
    sessionRef.current = null;
    if (s) {
      clearTimeout(s.minuteur);
      if (s.rvfc != null && s.video.cancelVideoFrameCallback) s.video.cancelVideoFrameCallback(s.rvfc);
      if (s.suiviAsync) s.suiviAsync.fermer();
      if (enregRef.current) exporterEnreg();
      s.flux.getTracks().forEach((t) => t.stop());
      s.video.srcObject = null;
    }
    setAuto(false); setEnPause(false); setApercu(null); setDiag(null); setApercuDiag(null);
  }, [exporterEnreg]);

  const lancerAuto = useCallback(async () => {
    if (sessionRef.current) return;
    setErreur(null);
    let flux;
    try {
      flux = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false });
    } catch {
      setErreur('Partage d\'écran refusé ou annulé.');
      return;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = flux;
    try { await video.play(); } catch { /* lecture auto bloquée : l'analyse attendra les images */ }
    const suiviAsync = creerSuiviAsync();
    const session = { flux, video, suiviAsync, minuteur: null, rvfc: null, dernierDebut: -1e9, tMesure: null, tUI: null, tPos: null, tHisto1: null, tDerniereMesure: null, histo1: [], histo2: [], verrou: null, occupe: false, dernierStable: null, centre: null, tailleMM: null, hyps: null, courant: null, force: null };
    sessionRef.current = session;
    flux.getVideoTracks()[0]?.addEventListener('ended', arreterAuto);
    setAuto(true); setPhaseAuto(1); setPlanDetecte(null); setResultats(null); setSalle(null); setPosition(null);

    const dessiner = (largeur, z) => {
      const vw = video.videoWidth, vh = video.videoHeight;
      const sx = z ? z.x * vw : 0, sy = z ? z.y * vh : 0, sw = z ? z.w * vw : vw, sh = z ? z.h * vh : vh;
      const c = document.createElement('canvas');
      c.width = largeur; c.height = Math.max(1, Math.round((largeur * sh) / sw));
      c.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.6);
    };

    const tick = async (tSec) => {
      if (session.occupe || sessionRef.current !== session || !video.videoWidth) return;
      session.occupe = true;
      const debut = performance.now();
      // Aperçus et diagnostic : rafraîchis à ~2 Hz seulement (l'analyse tourne bien plus vite).
      const majUI = session.tUI === null || tSec - session.tUI >= INTERVALLE_UI_S;
      if (majUI) session.tUI = tSec;
      try {
        const refs = await references();
        if (sessionRef.current !== session) return;
        const zoneMinimap = zoneRef.current || ZONE_PAR_DEFAUT;
        if (majUI) setApercu(dessiner(480, null));
        const mmBrut = analyseMinimapVideo(video, { zone: zoneMinimap });
        // Minimap réellement visible ? Une fois la flèche du joueur repérée, elle reste au même endroit de la minimap.
        // Si elle n'y est plus (inventaire, menu, cinématique...), l'analyse est mise en pause pour ne pas fausser le suivi.
        const flecheAttendue = !!session.centre;
        const flecheOk = !!mmBrut && !!mmBrut.centre && (!flecheAttendue
          || Math.hypot(mmBrut.centre.x / mmBrut.w - session.centre.x, mmBrut.centre.y / mmBrut.h - session.centre.y) <= 0.08);
        const mmOk = !!mmBrut && (flecheAttendue ? flecheOk : true);
        const mm = mmOk ? mmBrut : null;
        const signature = mm ? mm.signature : null;
        const observee = observationCarteDepuisVideo(video);
        // Carte ouverte : les deux portes visibles ET un vecteur compatible avec au moins un plan candidat (sinon fausse détection :
        // décor du jeu, minimap...).
        const carte = observee && observee.vecteur && candidats(refs).some((r) => scoreCarte(observee, r) >= 0.6) ? observee : null;

        if (!mm && flecheAttendue && !carte) {
          setEnPause(true);
          setDiag((d) => (d ? { ...d, pause: true } : d));
          return;
        }
        setEnPause(false);
        // La flèche du joueur reste au même endroit de la minimap : on retient sa position dès qu'elle est vue (même après le verrouillage).
        if (mm && mm.centre) session.centre = { x: mm.centre.x / mm.w, y: mm.centre.y / mm.h };
        // Phase 1 : lecture de la minimap (en haut à gauche) jusqu'à une salle d'arrivée stable, qui est alors verrouillée.
        if (session.verrou === null) {
          // Le joueur est dans la salle d'arrivée : on retient sa flèche (centre fixe de la minimap) et la taille de la salle (échelle).
          if (mm && !session.manuel) session.tailleMM = 2 * mm.signature.demi + 1;
          // Vote de stabilité : un échantillon toutes les ~0,35 s (le réglage fenêtre 4 / 2 votes date d'une analyse à 2,5 images/s).
          if (session.tHisto1 === null || tSec - session.tHisto1 >= 0.35) {
            session.tHisto1 = tSec;
            session.histo1.push(signature ? { id: signature.sorties || '-', score: 1 } : null);
            if (session.histo1.length > 20) session.histo1.shift();
            const stable1 = planStable(session.histo1, { fenetre: 4, minVotes: 2 });
            if (stable1) { session.verrou = stable1 === '-' ? '' : stable1; setPhaseAuto(2); }
          }
        }
        // Phase 2 : suivi continu. La salle verrouillée reste le repère de départ ; la minimap et la carte sont lues à chaque image.
        const sorties = session.verrou !== null ? session.verrou : (signature ? signature.sorties : null);
        let resultat = classerAuto(refs, { sorties, carte });

        // Suivi multi-hypothèses : le joueur est suivi sur chaque plan candidat, seul le vrai plan continue à correspondre.
        // Position donnée à la main sans échelle connue (analyse lancée en cours de partie) : on la déduit de la minimap autour du point.
        if (session.manuel && !session.tailleMM && mm && mm.centre && session.hyps) {
          const hm = session.hyps.find((x) => x.id === session.force);
          const rm = refs.find((x) => x.id === session.force);
          if (hm && rm && rm.refPad) {
            const c = calibrerEchelle(hm, rm, mm, { x: mm.centre.x, y: mm.centre.y });
            if (c) session.tailleMM = c.taille;
          }
        }
        const suiviPossible = !pivoteRef.current && mm && session.centre && session.tailleMM && (session.verrou !== null || !!session.force);
        if (suiviPossible) {
          if (!session.hyps) session.hyps = creerHypotheses(candidats(refs));
          const centrePx = { x: session.centre.x * mm.w, y: session.centre.y * mm.h };
          // Le recalage (partie la plus coûteuse) tourne dans un Web Worker. `dt` : temps écoulé depuis le recalage précédent, pour
          // prédire la position (fenêtre de recherche centrée sur l'endroit attendu) et garder des compteurs indépendants de la cadence.
          const dtMes = session.tMesure === null ? 0 : Math.max(0.001, Math.min(1, tSec - session.tMesure));
          session.tMesure = tSec;
          const envoyees = session.hyps;
          const maj = await suiviAsync.actualiser(envoyees, refs, mm, centrePx, session.tailleMM, { globalPour: session.force, dt: dtMes });
          if (sessionRef.current !== session) return;
          // Si le joueur a replacé sa position (ou changé de plan) pendant le calcul, ce résultat est périmé : on le jette.
          if (session.hyps === envoyees) session.hyps = maj;
          const avant = session.hyps;
          session.hyps = elaguer(session.hyps, { ecart: 0.15, minTicks: 4, garder: 2 });
          // Le plan validé par le joueur n'est jamais écarté : on continue à le suivre pour afficher la position.
          const valide = session.force && avant.find((h) => h.id === session.force);
          if (valide && !session.hyps.includes(valide)) session.hyps.push(valide);
          session.courant = decision(session.hyps, { courant: session.courant, marge: 0.04, minTicks: 3 });
          if (!carte) {
            const classees = classerHypotheses(session.hyps);
            resultat = { liste: classees.map((h) => ({ id: h.id, score: h.score })), exacts: resultat.exacts };
          }
        }
        if ((signature || carte) && majUI) {
          setCapture(carte ? dessiner(320, null) : dessiner(240, zoneMinimap));
          afficher(resultat, sorties !== null ? { sorties } : null);
        }

        // Plan décidé : carte ouverte (vecteur entre les portes) > suivi multi-hypothèses > salle d'arrivée si un seul plan convient.
        const tete = resultat.liste[0];
        const parCarte = carte && tete && tete.score >= 0.6 ? tete.id : null;
        const parSalle = !suiviPossible && !carte && resultat.exacts && resultat.exacts.length === 1 ? resultat.exacts[0] : null;
        const decide = session.force || parCarte || session.courant || parSalle || null;
        setPlanDetecte(decide);
        if (decide && decide !== session.dernierStable) {
          session.dernierStable = decide;
          const p = PLANS.find((x) => x.id === decide);
          if (p) voirPlan(p);
        }

        // Position en direct sur le plan décidé. Mesures, de la plus précise à la moins précise :
        // flèche de la carte ouverte > icône de porte vue sur la minimap (repère) > recalage de la minimap sur le plan.
        // Elles sont fondues dans un filtre (vitesse, incertitude) qui lisse le point et le fait avancer entre deux mesures.
        const ref = decide ? refs.find((r) => r.id === decide) : null;
        let sourcePos = null;
        let posEnreg = null;
        if (ref && ref.refPad) {
          let mesure = null; // { x, y (px miniature), c (qualité 0..1), source }
          const h = session.hyps && session.hyps.find((x) => x.id === decide);
          const norme = ref.vecteur ? Math.max(1, Math.hypot(ref.vecteur.x, ref.vecteur.y)) : 0;
          const carteCoherente = carte && carte.vecteur && ref.vecteur && Math.hypot(carte.vecteur.x - ref.vecteur.x, carte.vecteur.y - ref.vecteur.y) / norme <= 0.25;
          if (carteCoherente && carte.joueur) {
            const p = positionDepuisCarte(carte, ref);
            if (p) { mesure = { x: p.x, y: p.y, c: 1, source: 'carte' }; if (h) h.pos = { x: p.x, y: p.y }; } // la carte recale aussi le suivi
          }
          if (!mesure && h && h.perdus === 0) mesure = { x: h.pos.x, y: h.pos.y, c: 0.3 + 0.7 * qualiteCorrelation(h.corr, CORR_MIN), source: 'minimap' };
          // Repère : une porte (orange / bleue) visible sur la minimap, compatible avec la position suivie.
          if (!(mesure && mesure.source === 'carte') && h && mm && mm.centre && mm.portes && session.tailleMM) {
            const pinPx = (type) => { const q = PLANS.find((x) => x.id === decide)?.pins.find((y) => y.type === type); return q ? { x: (q.x / 100) * ref.largeur, y: (q.y / 100) * ref.hauteur } : null; };
            const rr = recalageRepere({
              portes: mm.portes, centre: mm.centre, echelle: ((h.facteur || 1) * ref.taille) / session.tailleMM,
              pins: { main: pinPx('door-main'), side: pinPx('door-side') }, pos: h.pos, rayonMax: 1.5 * ref.taille,
            });
            if (rr) { h.pos = { x: rr.x, y: rr.y }; mesure = { x: rr.x, y: rr.y, c: 1, source: 'repere' }; }
          }
          if (!session.filtre || session.filtre.planId !== ref.id) { session.filtre = creerFiltre(ref.taille); session.filtre.planId = ref.id; }
          const lisse = mettreAJourFiltre(session.filtre, mesure, tSec);
          sourcePos = mesure ? mesure.source : (lisse.init ? 'estimee' : null);
          if (mesure) session.tDerniereMesure = tSec;
          const sansMesureS = session.tDerniereMesure === null ? Infinity : tSec - session.tDerniereMesure;
          if (lisse.init && sansMesureS <= SANS_MESURE_MAX_S) {
            posEnreg = { x: +lisse.x.toFixed(1), y: +lisse.y.toFixed(1), rayon: +lisse.rayon.toFixed(1), source: sourcePos, mesure: mesure ? { x: +mesure.x.toFixed(1), y: +mesure.y.toFixed(1), c: +mesure.c.toFixed(2) } : null };
            // vx, vy (% du plan par seconde) et t (ms) : l'affichage prolonge le point entre deux mises à jour (PointJoueur).
            if (session.tPos === null || tSec - session.tPos >= INTERVALLE_POSITION_S) {
              session.tPos = tSec;
              setPosition({
                id: ref.id, x: (lisse.x / ref.largeur) * 100, y: (lisse.y / ref.hauteur) * 100, source: sourcePos,
                vx: (lisse.vx / ref.largeur) * 100, vy: (lisse.vy / ref.hauteur) * 100, t: tSec * 1000,
                rayon: (lisse.rayon / ref.largeur) * 100, dim: { largeur: ref.largeur, hauteur: ref.hauteur, taille: ref.taille },
              });
            }
          }
        }

        // Pas de position fiable depuis un moment : on efface l'ancien point plutôt que d'afficher un point faux.
        const sansMesure = session.tDerniereMesure === null ? Infinity : tSec - session.tDerniereMesure;
        if (!ref || !ref.refPad || sansMesure > SANS_MESURE_MAX_S) setPosition(null);

        // Diagnostic : ce que l'outil lit réellement (pour comprendre une erreur).
        if (majUI) setDiag({
          ms: Math.round(performance.now() - debut),
          video: `${video.videoWidth}×${video.videoHeight}`,
          zone: zoneMinimap,
          zonePersonnalisee: !!zoneRef.current,
          minimap: mm ? { sorties: mm.signature.sorties, tailleSalle: 2 * mm.signature.demi + 1, joueurTrouve: !!mm.centre, centre: mm.centre } : null,
          verrou: session.verrou,
          calibrage: { tailleDepart: session.tailleMM, centreFleche: session.centre },
          suiviPossible: !!suiviPossible,
          carte: observee ? { sorties: observee.sorties, vecteur: observee.vecteur, joueur: observee.joueur, acceptee: !!carte } : null,
          hypotheses: session.hyps ? classerHypotheses(session.hyps).slice(0, 5).map((h) => ({ plan: PLANS.find((x) => x.id === h.id)?.numero, score: +h.score.toFixed(2), corr: +h.corr.toFixed(2), perdus: h.perdus, ticks: h.ticks })) : null,
          restantes: session.hyps ? session.hyps.length : null,
          decide: decide ? PLANS.find((x) => x.id === decide)?.numero : null,
          position: sourcePos,
        });
        if (mm && majUI) setApercuDiag(dessinerDiagnostic(video, zoneMinimap, mm, session.tailleMM));

        // Enregistrement du trajet (1 image / s, 300 images au plus).
        const enr = enregRef.current;
        if (enr && enr.images.length < 300 && performance.now() - enr.dernier >= 1000) {
          enr.dernier = performance.now();
          enr.video = enr.video || `${video.videoWidth}x${video.videoHeight}`;
          enr.zone = zoneMinimap; enr.difficulte = diffRecoRef.current;
          enr.images.push({
            t: Math.round(performance.now() - enr.debut),
            minimap: dessiner(240, zoneMinimap),
            carte: carte ? dessiner(320, null) : null,
            plan: decide ? PLANS.find((x) => x.id === decide)?.numero : null,
            verrouille: !!session.force,
            position: posEnreg,
            suivi: session.hyps ? classerHypotheses(session.hyps).slice(0, 3).map((h) => ({ plan: PLANS.find((x) => x.id === h.id)?.numero, score: +h.score.toFixed(2), corr: +h.corr.toFixed(2), perdus: h.perdus })) : null,
            echelle: session.tailleMM, flecheTrouvee: !!(mm && mm.centre), repere: mm && mm.portes ? { orange: !!mm.portes.orange, bleu: !!mm.portes.bleu } : null,
            pause: !mm,
          });
          setNbImages(enr.images.length);
        }
      } catch (e) {
        setErreur(e.message || 'Analyse impossible.');
      } finally {
        session.occupe = false;
      }
    };
    // Planification : on suit les images de la vidéo (requestVideoFrameCallback) au lieu d'un délai fixe après chaque calcul ;
    // une image qui arrive trop tôt, ou pendant un calcul, est ignorée. Sans cette API, ou si l'écran est fixe (plus d'images
    // envoyées), un minuteur prend le relais.
    const planifier = () => {
      if (sessionRef.current !== session) return;
      let lance = false;
      const declencher = (tMs) => {
        if (lance || sessionRef.current !== session) return;
        lance = true;
        clearTimeout(session.minuteur);
        if (session.rvfc !== null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(session.rvfc);
        session.rvfc = null;
        const maintenant = performance.now();
        if (maintenant - session.dernierDebut < INTERVALLE_AUTO_MS) { planifier(); return; }
        session.dernierDebut = maintenant;
        tick(tMs / 1000).finally(planifier);
      };
      if (typeof video.requestVideoFrameCallback === 'function') {
        session.rvfc = video.requestVideoFrameCallback((now) => declencher(now));
        session.minuteur = setTimeout(() => declencher(performance.now()), CHIEN_DE_GARDE_MS);
      } else {
        session.minuteur = setTimeout(() => declencher(performance.now()), Math.max(0, INTERVALLE_AUTO_MS - (performance.now() - session.dernierDebut)));
      }
    };
    planifier();
  }, [arreterAuto, references, classerAuto, afficher]);

  useEffect(() => arreterAuto, [arreterAuto]);

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
          {PARTAGE_ECRAN_DISPONIBLE && (
            <button type="button" onClick={auto ? arreterAuto : lancerAuto}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${auto ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
              title="Partagez la fenêtre du jeu : le plan est identifié automatiquement, en local (rien n'est envoyé).">
              {auto ? '⏹ Arrêter la capture auto' : '🎥 Capture automatique'}
            </button>
          )}
          {capture && <button type="button" onClick={() => { setCapture(null); setResultats(null); setErreur(null); setPlanDetecte(null); }} className="ml-auto text-xs text-slate-400 hover:text-white underline">Effacer</button>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Ce que je capture">
          <span className="text-xs text-slate-400">Je capture :</span>
          {[{ id: 'minimap', label: '🧭 La minimap (début de partie)' }, { id: 'carte', label: '🗺️ La carte entière' }].map((m) => (
            <button key={m.id} type="button" aria-pressed={modeSource === m.id} onClick={() => choisirSource(m.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${modeSource === m.id ? 'bg-amber-500 text-slate-900 border-amber-300' : 'bg-slate-900 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
              {m.label}
            </button>
          ))}
          {modeSource === 'minimap' && (
            <label className="ml-2 flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer" title="À cocher si la minimap tourne quand vous tournez la caméra (le N de la boussole bouge).">
              <input type="checkbox" checked={pivote} onChange={(e) => changerPivote(e.target.checked)} />
              La minimap pivote avec la caméra
            </label>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Difficulté de ma partie">
          <span className="text-xs text-slate-400">Difficulté de ma partie :</span>
          {[{ id: null, label: 'Toutes' }, ...DIFFICULTES].map((d) => (
            <button key={d.id ?? 'toutes'} type="button" aria-pressed={diffReco === d.id} onClick={() => choisirDiffReco(d.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${diffReco === d.id ? 'bg-amber-500 text-slate-900 border-amber-300' : 'bg-slate-900 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
              {d.label}
            </button>
          ))}
          <span className="text-[11px] text-slate-500">Choisir la difficulté écarte les plans des autres modes et fiabilise la détection.</span>
        </div>
        {auto && apercu && <ZoneMinimap apercu={apercu} zone={zone || ZONE_PAR_DEFAUT} personnalisee={!!zone} onChange={definirZone} />}
        {salle && (
          <p className="mt-2 text-xs text-sky-300" role="status">
            Salle d'arrivée lue : <b>{libelleSorties(salle.sorties)}</b> — {salle.possibles.length === 0
              ? 'aucun plan ne correspond exactement (vérifiez la difficulté, la case « pivote » ou la zone).'
              : salle.possibles.length === 1
                ? `plan ${PLANS.find((x) => x.id === salle.possibles[0])?.numero}.`
                : `${salle.possibles.length} plans possibles : ${salle.possibles.map((id) => PLANS.find((x) => x.id === id)?.numero).join(', ')}. Choisissez votre difficulté pour réduire la liste.`}
          </p>
        )}
        {auto && (
          <p className="mt-2 text-xs text-emerald-300" role="status">
            🔴 Capture en cours, <b>phase {phaseAuto}/2</b> — {phaseAuto === 1
              ? 'lecture de la minimap (en haut à gauche) : placez-vous dans la salle d\'arrivée.'
              : 'suivi continu de la minimap et de la carte (ouvrez la carte pour affiner).'}{' '}
            {enPause && <b className="text-amber-300"> ⏸ Analyse en pause : minimap non visible (inventaire, menu…). Elle reprend toute seule au retour en jeu.</b>}{' '}
            {planDetecte
              ? `Plan ${PLANS.find((x) => x.id === planDetecte)?.numero} détecté.`
              : 'Aucun plan unique pour l\'instant.'}
            <button type="button" onClick={reinitialiserAuto} className="ml-2 underline text-slate-400 hover:text-white">Relancer l'analyse</button>
            <button type="button" onClick={basculerEnreg} className={`ml-3 px-2 py-0.5 rounded-lg font-bold ${enregistre ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
              title="Enregistre une image de la minimap par seconde et les positions calculées dans un fichier à me transmettre">
              {enregistre ? `⏹ Arrêter et télécharger (${nbImages} images)` : '⏺ Enregistrer un trajet'}
            </button>
          </p>
        )}
        {auto && (planDetecte || exclus.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" role="group" aria-label="Validation du plan">
            {barreValidation(planDetecte)}
            {exclus.length > 0 && (
              <span className="text-slate-400">
                Écartés : {exclus.map((id) => PLANS.find((x) => x.id === id)?.numero).join(', ')}
                <button type="button" onClick={reintegrerPlans} className="ml-2 underline hover:text-white">Les réintégrer</button>
              </span>
            )}
          </div>
        )}
        {auto && (position || planDetecte) && (() => {
          const planPos = PLANS.find((x) => x.id === (position ? position.id : planDetecte));
          return planPos ? (
            <div className="mt-3 max-w-2xl">
              <p className="text-xs text-yellow-200 mb-1" role="status">
                📍 Ma position — plan {planPos.numero} ({position && position.source === 'carte' ? 'lue sur la carte ouverte' : position && position.source === 'repere' ? 'recalée sur une porte vue sur la minimap' : position && position.source === 'manuel' ? 'placée par vous, puis recalée par la minimap' : position && position.source === 'estimee' ? 'estimée : minimap peu lisible' : 'recalée par la minimap'})
              </p>
              {(() => {
                const faits = faitsDe(planPos.id);
                const ici = position && position.id === planPos.id ? position : null;
                const oeuf = ici ? plusProche(planPos, ici, faits, ici.dim, estOeuf) : null;
                const cle = ici ? plusProche(planPos, ici, faits, ici.dim, estCle) : null;
                const txt = (o) => `${o.fleche} ${o.salles !== null ? `à environ ${o.salles} salle${o.salles >= 2 ? 's' : ''}` : ''}`;
                return (
                  <>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {barreValidation(planPos.id)}
                      {boutonPlacer()}
                      <button type="button" onClick={() => ouvrirPlein()} className="ml-auto px-2.5 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold">⛶ Plein écran</button>
                    </div>
                    <Carte plan={planPos} joueur={ici} faits={faits} cible={oeuf ? oeuf.i : null} onBasculer={(i) => basculerFait(planPos.id, i)}
                      onPlacer={placement ? (x, y) => placerPosition(planPos.id, x, y) : null} />
                    <div className="mt-2 text-xs text-slate-200 space-y-1">
                      <p>
                        {oeuf ? <>🥚 Nid d'œufs le plus proche : <b>{txt(oeuf)}</b></> : '🥚 Tous les nids sont cochés.'}
                        {cle && <> — 🔑 {LIBELLE_MARQUE[cle.pin.type]} : <b>{txt(cle)}</b></>}
                      </p>
                      <Comptes comptes={planPos.comptes} />
                      <p className="text-slate-400">
                        Cliquez sur un nid ou une clé du plan pour le cocher une fois récupéré.
                        {(faitsParPlan[planPos.id] || []).length > 0 && <button type="button" onClick={() => viderFaits(planPos.id)} className="ml-2 underline hover:text-white">Tout décocher</button>}
                      </p>
                      <p className="text-slate-500">Boss et élites : pas d'emplacement fixe. Coffres et salles de défi : seuls les nombres sont publiés, pas leurs positions.</p>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null;
        })()}
        {auto && diag && (
          <details className="mt-3 text-xs text-slate-300">
            <summary className="cursor-pointer text-slate-400 hover:text-white">🔧 Diagnostic (ce que l'outil lit)</summary>
            <div className="mt-2 flex flex-col sm:flex-row gap-3">
              {apercuDiag && <img src={apercuDiag} alt="Minimap analysée" className="max-h-44 rounded border border-slate-600 self-start" />}
              <div className="flex-1 space-y-0.5">
                <p>Écran partagé : {diag.video} — zone minimap {diag.zonePersonnalisee ? 'dessinée' : 'par défaut'} ({Math.round(diag.zone.x * 100)} %, {Math.round(diag.zone.y * 100)} %, {Math.round(diag.zone.w * 100)} × {Math.round(diag.zone.h * 100)} %)</p>
                <p>Minimap : {diag.minimap ? `salle trouvée, ${diag.minimap.sorties ? libelleSorties(diag.minimap.sorties) : 'aucune sortie'}, taille ${diag.minimap.tailleSalle} px, flèche du joueur ${diag.minimap.joueurTrouve ? 'trouvée' : 'NON trouvée'}` : 'aucune salle détectée (zone mal placée ?)'}</p>
                <p>Salle verrouillée : {diag.verrou === null ? 'pas encore' : libelleSorties(diag.verrou)}</p>
                <p>Carte entière : {diag.carte ? `porte orange trouvée, porte bleue ${diag.carte.vecteur ? 'trouvée' : 'non'}, joueur ${diag.carte.joueur ? 'trouvé' : 'non'}` : 'non détectée (carte fermée)'}{diag.carte && !diag.carte.acceptee ? ' — ignorée (incohérente avec les plans)' : ''}</p>
                <p>Suivi : {diag.hypotheses ? `${diag.restantes} plan(s) en lice` : 'pas encore lancé'}{diag.decide ? ` — décidé : plan ${diag.decide}` : ''} — analyse en {diag.ms} ms</p>
                {diag.hypotheses && <p className="text-slate-400">Meilleurs : {diag.hypotheses.map((h) => `plan ${h.plan} (${Math.round(h.score * 100)} %)`).join(', ')}</p>}
                <button type="button" onClick={() => navigator.clipboard?.writeText(JSON.stringify(diag, null, 2))} className="mt-1 underline text-slate-400 hover:text-white">Copier le diagnostic</button>
              </div>
            </div>
          </details>
        )}
        {analyse && <p className="mt-2 text-xs text-slate-400">Analyse en cours…</p>}
        {erreur && <p className="mt-2 text-xs text-red-400">{erreur}</p>}
        {capture && resultats && (
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <img src={capture} alt="Capture analysée" className="max-h-40 rounded-lg border border-slate-700 object-contain bg-slate-950 self-start" />
            <div className="flex-1 grid gap-2 grid-cols-1 sm:grid-cols-3">
              {auto && <p className="sm:col-span-3 text-xs text-slate-400">Cliquez sur votre plan dès que vous le reconnaissez : il est alors verrouillé et votre position est suivie dessus.</p>}
              {resultats.map((r, i) => {
                const p = PLANS.find((x) => x.id === r.id);
                const pct = Math.round(r.score * 100);
                const diff = DIFFICULTES.find((d) => d.id === p.difficulte);
                return (
                  <button key={r.id} type="button" onClick={() => (auto ? confirmerPlan(r.id) : voirPlan(p))}
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
        {resultats && resultats[0] && resultats[0].score < 0.5 && (
          <p className="mt-2 text-xs text-amber-300">
            {modeSource === 'minimap'
              ? 'Correspondance faible : cadrez la minimap seule, faites la capture dans la salle d\'arrivée, ou cochez « La minimap pivote ».'
              : 'Correspondance faible : recadrez la capture sur la carte seule (sans interface) ou utilisez les filtres ci-dessous.'}
          </p>
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
            {auto && (
              <div className="flex flex-wrap items-center gap-2">
                {barreValidation(plan.id)}
                {boutonPlacer()}
                <button type="button" onClick={() => ouvrirPlein(plan.id)} className="ml-auto px-2.5 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold">⛶ Plein écran</button>
              </div>
            )}
            <Carte plan={plan} grande joueur={position && position.id === plan.id ? position : null} faits={faitsDe(plan.id)} onBasculer={(i) => basculerFait(plan.id, i)}
              onPlacer={auto && placement ? (x, y) => placerPosition(plan.id, x, y) : null} />
            <Comptes comptes={plan.comptes} />
          </div>
        </div>
      )}
      {plein && (() => {
        const idPlein = pleinId || (position && position.id) || planDetecte;
        const planPlein = PLANS.find((x) => x.id === idPlein);
        if (!planPlein) return null;
        const faits = faitsDe(planPlein.id);
        const joueur = position && position.id === planPlein.id ? position : null;
        const oeuf = joueur ? plusProche(planPlein, joueur, faits, position.dim, estOeuf) : null;
        const cle = joueur ? plusProche(planPlein, joueur, faits, position.dim, estCle) : null;
        const txt = (o) => `${o.fleche} ${o.salles !== null ? `~${o.salles} salle${o.salles >= 2 ? 's' : ''}` : ''}`;
        return (
          <div ref={pleinRef} className="fixed inset-0 z-[60] bg-slate-950 flex flex-col p-3 gap-2" role="dialog" aria-modal="true" aria-label={`Plan ${planPlein.numero} en plein écran`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h3 className="text-lg font-bold">Plan {planPlein.numero} <span className="text-xs font-normal text-slate-400">— porte bleue au {NOM_DIR[planPlein.direction]}</span></h3>
              {barreValidation(planPlein.id)}
              {boutonPlacer()}
              {joueur && (
                <span className="text-sm text-slate-200">
                  {oeuf ? <>🥚 <b>{txt(oeuf)}</b></> : '🥚 tous cochés'}{cle && <> · 🔑 <b>{txt(cle)}</b></>}
                </span>
              )}
              <button type="button" onClick={fermerPlein} className="ml-auto px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-sm" aria-label="Quitter le plein écran">✕ Quitter (Échap)</button>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div style={{ width: `min(100%, calc((100vh - 5rem) * ${planPlein.ratio || 1.5}))` }}>
                <Carte plan={planPlein} grande joueur={joueur} faits={faits} cible={oeuf ? oeuf.i : null} onBasculer={(i) => basculerFait(planPlein.id, i)}
                  onPlacer={placement ? (x, y) => placerPosition(planPlein.id, x, y) : null} />
              </div>
            </div>
          </div>
        );
      })()}
      <p className="mt-5 text-[11px] text-slate-500">Données des plans : AniimoTools (aniimotools.dev), utilisées avec l'accord de l'auteur, usage personnel.</p>
    </section>
  );
}
