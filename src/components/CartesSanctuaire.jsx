import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PLANS from '../data/sanctuaire_plans.json';
import { classer, empreinteDepuisSource, planStable, signatureDepuisSource, analyseMinimapVideo,
  observationCarteDepuisSource, observationCarteDepuisVideo } from '../lib/reconnaissance-plan.js';
import { classerParSalle, classerParCarte, vecteurPlan, libelleSorties } from '../lib/salle-depart.js';
import { preparerRef, positionDepuisCarte, RAYON_DISQUE } from '../lib/localisation.js';
import { creerHypotheses, actualiserHypotheses, classerHypotheses, decision, elaguer } from '../lib/suivi.js';

const INTERVALLE_AUTO_MS = 350;
const CLE_ZONE = 'aniimo_zone_minimap_v1';
// Minimap du jeu : en haut à gauche de l'écran (fractions de l'image partagée), sauf zone dessinée par l'utilisateur.
const ZONE_PAR_DEFAUT = { x: 0, y: 0, w: 0.25, h: 0.35 };
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

function Carte({ plan, grande = false, onClick, joueur = null }) {
  const pins = plan.pins;
  const contenu = (
    <div
      className="relative w-full bg-slate-950 rounded-lg overflow-hidden"
      style={{ aspectRatio: plan.ratio || 1.5 }}
    >
      <img src={img(plan.image)} alt={`Plan ${plan.numero}`} className="absolute inset-0 w-full h-full object-contain" loading="lazy" />
      {pins.map((p, i) => <Marqueur key={i} pin={p} taille={grande ? 26 : 16} />)}
      {joueur && (
        <span
          title="Ma position"
          style={{ position: 'absolute', left: `${joueur.x}%`, top: `${joueur.y}%`, transform: 'translate(-50%, -50%)' }}
          className="z-30 block w-4 h-4 rounded-full bg-yellow-300 border-2 border-white shadow-[0_0_8px_3px_rgba(250,204,21,0.8)] animate-pulse pointer-events-none"
        />
      )}
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

  const candidats = useCallback((refs) => {
    const d = diffRecoRef.current;
    return refs.filter((r) => !d || PLANS.find((p) => p.id === r.id)?.difficulte === d);
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
  const [phaseAuto, setPhaseAuto] = useState(1); // 1 = lecture de la minimap ; 2 = suivi continu minimap + carte
  const sessionRef = useRef(null); // { flux, video, minuteur, histo1, histo2, verrou, occupe, dernierStable }

  const reinitialiserAuto = () => {
    setResultats(null); setPlanDetecte(null); setSalle(null);
    setPhaseAuto(1); setPosition(null);
    const s = sessionRef.current;
    if (s) { s.histo1 = []; s.histo2 = []; s.verrou = null; s.dernierStable = null; s.centre = null; s.tailleMM = null; s.hyps = null; s.courant = null; s.force = null; }
  };
  const confirmerPlan = (id) => {
    const s = sessionRef.current;
    if (s) { s.force = id; const gardees = s.hyps ? s.hyps.filter((h) => h.id === id) : []; s.hyps = gardees.length ? gardees : null; }
    setPlanDetecte(id);
    const p = PLANS.find((x) => x.id === id);
    if (p) voirPlan(p);
  };
  const choisirDiffReco = (id) => { diffRecoRef.current = id; setDiffReco(id); reinitialiserAuto(); };
  const choisirSource = (mode) => { modeRef.current = mode; setModeSource(mode); reinitialiserAuto(); };
  const changerPivote = (v) => { pivoteRef.current = v; setPivote(v); reinitialiserAuto(); };
  const definirZone = (z) => {
    zoneRef.current = z; setZone(z); reinitialiserAuto();
    try { if (z) localStorage.setItem(CLE_ZONE, JSON.stringify(z)); else localStorage.removeItem(CLE_ZONE); } catch { /* stockage indisponible */ }
  };

  const arreterAuto = useCallback(() => {
    const s = sessionRef.current;
    sessionRef.current = null;
    if (s) {
      clearTimeout(s.minuteur);
      s.flux.getTracks().forEach((t) => t.stop());
      s.video.srcObject = null;
    }
    setAuto(false); setApercu(null); setDiag(null); setApercuDiag(null);
  }, []);

  const lancerAuto = useCallback(async () => {
    if (sessionRef.current) return;
    setErreur(null);
    let flux;
    try {
      flux = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
    } catch {
      setErreur('Partage d\'écran refusé ou annulé.');
      return;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = flux;
    try { await video.play(); } catch { /* lecture auto bloquée : l'analyse attendra les images */ }
    const session = { flux, video, minuteur: null, histo1: [], histo2: [], verrou: null, occupe: false, dernierStable: null, centre: null, tailleMM: null, hyps: null, courant: null, force: null };
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

    const tick = async () => {
      if (session.occupe || sessionRef.current !== session || !video.videoWidth) return;
      session.occupe = true;
      const debut = performance.now();
      try {
        const refs = await references();
        if (sessionRef.current !== session) return;
        const zoneMinimap = zoneRef.current || ZONE_PAR_DEFAUT;
        setApercu(dessiner(480, null));
        const mm = analyseMinimapVideo(video, { zone: zoneMinimap });
        const signature = mm ? mm.signature : null;
        const observee = observationCarteDepuisVideo(video);
        const carte = observee && observee.vecteur ? observee : null; // carte ouverte, les deux portes visibles

        // Phase 1 : lecture de la minimap (en haut à gauche) jusqu'à une salle d'arrivée stable, qui est alors verrouillée.
        if (session.verrou === null) {
          // Le joueur est dans la salle d'arrivée : on retient sa flèche (centre fixe de la minimap) et la taille de la salle (échelle).
          if (mm && mm.centre) { session.centre = { x: mm.centre.x / mm.w, y: mm.centre.y / mm.h }; session.tailleMM = 2 * mm.signature.demi + 1; }
          session.histo1.push(signature ? { id: signature.sorties || '-', score: 1 } : null);
          if (session.histo1.length > 20) session.histo1.shift();
          const stable1 = planStable(session.histo1, { fenetre: 4, minVotes: 2 });
          if (stable1) { session.verrou = stable1 === '-' ? '' : stable1; setPhaseAuto(2); }
        }
        // Phase 2 : suivi continu. La salle verrouillée reste le repère de départ ; la minimap et la carte sont lues à chaque image.
        const sorties = session.verrou !== null ? session.verrou : (signature ? signature.sorties : null);
        let resultat = classerAuto(refs, { sorties, carte });

        // Suivi multi-hypothèses : le joueur est suivi sur chaque plan candidat, seul le vrai plan continue à correspondre.
        const suiviPossible = !pivoteRef.current && mm && session.centre && session.tailleMM && session.verrou !== null;
        if (suiviPossible) {
          if (!session.hyps) session.hyps = creerHypotheses(candidats(refs));
          const centrePx = { x: session.centre.x * mm.w, y: session.centre.y * mm.h };
          actualiserHypotheses(session.hyps, refs, mm, centrePx, session.tailleMM);
          session.hyps = elaguer(session.hyps, { ecart: 0.15, minTicks: 4, garder: 2 });
          session.courant = decision(session.hyps, { courant: session.courant, marge: 0.04, minTicks: 3 });
          if (!carte) {
            const classees = classerHypotheses(session.hyps);
            resultat = { liste: classees.map((h) => ({ id: h.id, score: h.score })), exacts: resultat.exacts };
          }
        }
        if (signature || carte) {
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

        // Position en direct sur le plan décidé : flèche de la carte si elle est ouverte, sinon position suivie par la minimap.
        const ref = decide ? refs.find((r) => r.id === decide) : null;
        if (ref && ref.refPad) {
          let pos = null;
          if (carte && carte.joueur) {
            const p = positionDepuisCarte(carte, ref);
            if (p) pos = { ...p, source: 'carte' };
            const h = session.hyps && session.hyps.find((x) => x.id === decide);
            if (h && p) h.pos = { x: p.x, y: p.y }; // la carte recale le suivi
          }
          if (!pos && session.hyps) {
            const h = session.hyps.find((x) => x.id === decide);
            if (h && h.perdus === 0) pos = { x: h.pos.x, y: h.pos.y, source: 'minimap' };
          }
          if (pos) setPosition({ id: ref.id, x: (pos.x / ref.largeur) * 100, y: (pos.y / ref.hauteur) * 100, source: pos.source });
        }

        // Diagnostic : ce que l'outil lit réellement (pour comprendre une erreur).
        setDiag({
          ms: Math.round(performance.now() - debut),
          video: `${video.videoWidth}×${video.videoHeight}`,
          zone: zoneMinimap,
          zonePersonnalisee: !!zoneRef.current,
          minimap: mm ? { sorties: mm.signature.sorties, tailleSalle: 2 * mm.signature.demi + 1, joueurTrouve: !!mm.centre, centre: mm.centre } : null,
          verrou: session.verrou,
          carte: observee ? { sorties: observee.sorties, vecteur: observee.vecteur, joueur: observee.joueur } : null,
          hypotheses: session.hyps ? classerHypotheses(session.hyps).slice(0, 5).map((h) => ({ plan: PLANS.find((x) => x.id === h.id)?.numero, score: +h.score.toFixed(2), corr: +h.corr.toFixed(2), perdus: h.perdus, ticks: h.ticks })) : null,
          restantes: session.hyps ? session.hyps.length : null,
          decide: decide ? PLANS.find((x) => x.id === decide)?.numero : null,
        });
        if (mm) setApercuDiag(dessinerDiagnostic(video, zoneMinimap, mm, session.tailleMM));
      } catch (e) {
        setErreur(e.message || 'Analyse impossible.');
      } finally {
        session.occupe = false;
      }
    };
    const boucle = async () => {
      await tick();
      if (sessionRef.current === session) session.minuteur = setTimeout(boucle, INTERVALLE_AUTO_MS);
    };
    boucle();
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
            {planDetecte
              ? `Plan ${PLANS.find((x) => x.id === planDetecte)?.numero} détecté.`
              : 'Aucun plan unique pour l\'instant.'}
            <button type="button" onClick={reinitialiserAuto} className="ml-2 underline text-slate-400 hover:text-white">Relancer l'analyse</button>
          </p>
        )}
        {auto && position && (() => {
          const planPos = PLANS.find((x) => x.id === position.id);
          return planPos ? (
            <div className="mt-3 max-w-md">
              <p className="text-xs text-yellow-200 mb-1" role="status">
                📍 Ma position — plan {planPos.numero} ({position.source === 'carte' ? 'lue sur la carte ouverte' : 'recalée par la minimap'})
              </p>
              <Carte plan={planPos} joueur={position} />
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
                <p>Carte entière : {diag.carte ? `porte orange trouvée, porte bleue ${diag.carte.vecteur ? 'trouvée' : 'non'}, joueur ${diag.carte.joueur ? 'trouvé' : 'non'}` : 'non détectée (carte fermée)'}</p>
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
            <Carte plan={plan} grande joueur={position && position.id === plan.id ? position : null} />
            <Comptes comptes={plan.comptes} />
          </div>
        </div>
      )}
      <p className="mt-5 text-[11px] text-slate-500">Données des plans : AniimoTools (aniimotools.dev), utilisées avec l'accord de l'auteur, usage personnel.</p>
    </section>
  );
}
