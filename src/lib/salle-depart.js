/**
 * Identification d'un plan du Sanctuaire perdu par la SALLE D'ARRIVÉE.
 *
 * Au début d'une partie, la minimap ne montre que la salle d'arrivée (carrée, 4 piliers) et ses sorties
 * (couloirs vers N / E / S / O). Cette « signature de sorties » diffère selon les plans : on la mesure sur la
 * minimap en jeu et sur la miniature de chaque plan (autour de son point de départ), puis on compare.
 * Logique pure (sans React ni canvas), testée par `npm test`.
 */

export const DIRECTIONS = ['N', 'E', 'S', 'O'];

/** Masque binaire des pixels « praticables » : clairs et peu colorés (sol gris des salles et couloirs). */
export function masqueClair(rgba, w, h, { lumMin = 140, satMax = 40 } = {}) {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    if (rgba[i * 4 + 3] < 128) continue;
    if ((r + g + b) / 3 >= lumMin && Math.max(r, g, b) - Math.min(r, g, b) <= satMax) m[i] = 1;
  }
  return m;
}

/**
 * Comble les petits trous fermés (piliers, icônes, flèche du joueur) : un fond non relié au bord et dont
 * le côté ne dépasse pas `maxCote` pixels devient sol. Les grandes poches (boucles de couloirs) restent vides.
 */
export function remplirTrous(masque, w, h, maxCote = Infinity) {
  const lien = new Int32Array(w * h); // 0 = non visité, sinon n° de composante de fond
  const out = Uint8Array.from(masque);
  let n = 0;
  const parcourir = (depart) => {
    n++;
    const pile = [depart];
    lien[depart] = n;
    const cases = [];
    let touche = false, x0 = w, x1 = -1, y0 = h, y1 = -1;
    while (pile.length) {
      const i = pile.pop();
      const x = i % w, y = (i / w) | 0;
      cases.push(i);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touche = true;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !masque[j] && !lien[j]) { lien[j] = n; pile.push(j); }
      }
    }
    if (!touche && Math.max(x1 - x0, y1 - y0) + 1 <= maxCote) for (const i of cases) out[i] = 1;
  };
  for (let i = 0; i < w * h; i++) if (!masque[i] && !lien[i]) parcourir(i);
  return out;
}

/** Distance de Chebyshev au fond (le bord de l'image compte comme fond). */
export function distanceFond(masque, w, h) {
  const d = new Int32Array(w * h);
  const val = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      d[i] = masque[i] ? Math.min(val(x - 1, y), val(x, y - 1), val(x - 1, y - 1), val(x + 1, y - 1)) + 1 : 0;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!masque[i]) continue;
      d[i] = Math.min(d[i], Math.min(val(x + 1, y), val(x, y + 1), val(x + 1, y + 1), val(x - 1, y + 1)) + 1);
    }
  }
  return d;
}

/** Érosion (mode 'e') ou dilatation (mode 'd') par un carré de demi-côté `demi`, via image intégrale. */
function boite(masque, w, h, demi, mode) {
  const W = w + 1;
  const S = new Int32Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let ligne = 0;
    for (let x = 0; x < w; x++) {
      ligne += masque[y * w + x];
      S[(y + 1) * W + x + 1] = S[y * W + x + 1] + ligne;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - demi), x1 = Math.min(w - 1, x + demi);
      const y0 = Math.max(0, y - demi), y1 = Math.min(h - 1, y + demi);
      const somme = S[(y1 + 1) * W + x1 + 1] - S[y0 * W + x1 + 1] - S[(y1 + 1) * W + x0] + S[y0 * W + x0];
      if (mode === 'd') out[y * w + x] = somme > 0 ? 1 : 0;
      else out[y * w + x] = x - demi >= 0 && x + demi < w && y - demi >= 0 && y + demi < h && somme === (2 * demi + 1) ** 2 ? 1 : 0;
    }
  }
  return out;
}

/** Ouverture : supprime les structures plus étroites que 2·demi+1 (couloirs) et garde les salles. */
export function ouverture(masque, w, h, demi) {
  return boite(boite(masque, w, h, demi, 'e'), w, h, demi, 'd');
}

/** Composante connexe (4-voisins) choisie : la plus proche de `ancre` {x, y}, sinon la plus grande. */
function composante(masque, w, h, ancre) {
  const etiquette = new Int32Array(w * h);
  let meilleure = null;
  let n = 0;
  for (let depart = 0; depart < w * h; depart++) {
    if (!masque[depart] || etiquette[depart]) continue;
    n++;
    const pile = [depart];
    etiquette[depart] = n;
    let aire = 0, x0 = w, x1 = -1, y0 = h, y1 = -1, dmin = Infinity;
    while (pile.length) {
      const i = pile.pop();
      const x = i % w, y = (i / w) | 0;
      aire++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (ancre) dmin = Math.min(dmin, (x - ancre.x) ** 2 + (y - ancre.y) ** 2);
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && masque[j] && !etiquette[j]) { etiquette[j] = n; pile.push(j); }
      }
    }
    const score = ancre ? -dmin : aire;
    if (!meilleure || score > meilleure.score) meilleure = { score, x0, x1, y0, y1 };
  }
  return meilleure;
}

/**
 * Signature de la salle d'arrivée d'un masque : { sorties: 'NES…' (ordre N,E,S,O), demi, boite } ou null.
 * `ancre` {x, y} (pixels) : salle la plus proche de ce point (miniatures) ; sinon la plus grande salle.
 * La taille de la salle est estimée par le plus grand carré inscrit, sans dépendre de la résolution.
 */
export function signatureSalle(masque, w, h, { ancre = null, minDemi = 4 } = {}) {
  // Taille de la salle (demi-côté du plus grand carré inscrit). Avec une ancre (miniatures) : au voisinage
  // du point de départ ; sans ancre (minimap en jeu) : plus grande salle de l'image.
  const grand = Math.max(w, h);
  // Miniatures : seuls les petits trous (piliers) sont comblés, les boucles de couloirs restent vides.
  // Minimap en jeu : tout trou fermé est comblé (piliers, flèche du joueur, icônes, cône de lumière).
  const maxTrou = ancre ? Math.max(3, Math.round(grand * 0.04)) : Infinity;
  const plein = remplirTrous(masque, w, h, maxTrou);
  const dist = distanceFond(plein, w, h);
  let demi = 0;
  const rayon = grand * 0.1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = dist[y * w + x];
      if (v <= demi) continue;
      if (ancre && (x - ancre.x) ** 2 + (y - ancre.y) ** 2 > rayon * rayon) continue;
      demi = v;
    }
  }
  if (demi < minDemi) return null;
  const noyau = Math.max(1, Math.round(demi * 0.6));
  const salle = composante(ouverture(plein, w, h, noyau), w, h, ancre);
  if (!salle) return null;
  const { x0, x1, y0, y1 } = salle;
  const largeur = x1 - x0 + 1, hauteur = y1 - y0 + 1;
  const ecart = Math.max(1, Math.round(demi * 0.08)); // bords irréguliers de la salle
  const epaisseur = Math.max(2, Math.round(demi * 0.12));

  // Un côté a une sortie si une bande juste à l'extérieur contient un passage continu assez large.
  const passage = (coupe, longueur) => {
    let courant = 0, meilleur = 0;
    for (let k = 0; k < longueur; k++) {
      if (coupe(k)) { courant++; if (courant > meilleur) meilleur = courant; } else courant = 0;
    }
    return meilleur >= Math.max(3, 0.12 * longueur);
  };
  const clair = (x, y) => x >= 0 && y >= 0 && x < w && y < h && plein[y * w + x] === 1;
  const bandeH = (yDebut, sens) => (k) => { for (let e = 0; e < epaisseur; e++) if (clair(x0 + k, yDebut + sens * e)) return true; return false; };
  const bandeV = (xDebut, sens) => (k) => { for (let e = 0; e < epaisseur; e++) if (clair(xDebut + sens * e, y0 + k)) return true; return false; };
  const sorties = [
    passage(bandeH(y0 - 1 - ecart, -1), largeur) ? 'N' : '',
    passage(bandeV(x1 + 1 + ecart, 1), hauteur) ? 'E' : '',
    passage(bandeH(y1 + 1 + ecart, 1), largeur) ? 'S' : '',
    passage(bandeV(x0 - 1 - ecart, -1), hauteur) ? 'O' : '',
  ].join('');
  return { sorties, demi, boite: { x0, x1, y0, y1 } };
}

/** Fait pivoter un ensemble de sorties de `quarts` quarts de tour horaires (N→E→S→O). */
export function pivoterSorties(sorties, quarts) {
  const out = new Set();
  for (const c of sorties) out.add(DIRECTIONS[(DIRECTIONS.indexOf(c) + quarts + 400) % 4]);
  return DIRECTIONS.filter((d) => out.has(d)).join('');
}

/** Similarité 0..1 entre deux ensembles de sorties : 1 si identiques, sinon proportionnelle (Jaccard) et pénalisée. */
export function scoreSorties(observe, reference) {
  if (observe === reference) return 1;
  const a = new Set(observe), b = new Set(reference);
  let commun = 0;
  for (const c of a) if (b.has(c)) commun++;
  const union = a.size + b.size - commun;
  return union ? (commun / union) * 0.5 : 0;
}

/** Meilleur score, en acceptant éventuellement une minimap qui pivote avec la caméra (quarts de tour). */
export function scoreSalle(observe, reference, { pivote = false } = {}) {
  if (!pivote) return scoreSorties(observe, reference);
  let m = 0;
  for (let q = 0; q < 4; q++) m = Math.max(m, scoreSorties(pivoterSorties(observe, q), reference) * (q === 0 ? 1 : 0.9));
  return m;
}

/**
 * Classe les plans selon la salle d'arrivée observée.
 * `references` : [{ id, signature: { sorties } | null }]. Renvoie [{ id, score }] décroissant (égalités gardées).
 */
export function classerParSalle(observee, references, options) {
  if (!observee) return [];
  return references
    .filter((r) => r.signature)
    .map((r) => ({ id: r.id, score: scoreSalle(observee.sorties, r.signature.sorties, options) }))
    .sort((x, y) => y.score - x.score);
}

/** Seuils de couleur du masque : miniatures du site / minimap en jeu (sol gris clair sur fond bleuté sombre). */
export const SEUILS = {
  miniature: { lumMin: 140, satMax: 40 },
  minimap: { lumMin: 140, satMax: 30 },
  carte: { lumMin: 90, satMax: 40 }, // carte plein écran : sol plus sombre que sur la minimap
};

/** Signature depuis des pixels RGBA. `ancre` {x, y} pour une miniature, absente pour une minimap en jeu. */
export function signatureDepuisRGBA(rgba, w, h, { ancre = null } = {}) {
  const masque = masqueClair(rgba, w, h, ancre ? SEUILS.miniature : SEUILS.minimap);
  return signatureSalle(masque, w, h, { ancre });
}

const NOM_SORTIE = { N: 'nord', E: 'est', S: 'sud', O: 'ouest' };

/** « sortie à l'ouest », « sorties au nord et à l'est »… */
export function libelleSorties(sorties) {
  const noms = [...sorties].map((c) => NOM_SORTIE[c]);
  if (!noms.length) return 'aucune sortie';
  const prep = (n) => (n === 'est' || n === 'ouest' ? `à l'${n}` : `au ${n}`);
  if (noms.length === 1) return `sortie ${prep(noms[0])}`;
  return `sorties ${noms.slice(0, -1).map(prep).join(', ')} et ${prep(noms[noms.length - 1])}`;
}

/** Teinte (0..360), saturation et valeur (0..1) d'un pixel RGB. */
function hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let t = 0;
  if (d) {
    if (max === r) t = ((g - b) / d + 6) % 6;
    else if (max === g) t = (b - r) / d + 2;
    else t = (r - g) / d + 4;
  }
  return { t: t * 60, s: max ? d / max : 0, v: max / 255 };
}

/** Taches de pixels vérifiant `test(teinte, saturation, valeur)` : [{ x, y, aire }] (centres en pixels), par aire décroissante. */
function taches(rgba, w, h, test) {
  const masque = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const c = hsv(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    if (rgba[i * 4 + 3] >= 128 && test(c.t, c.s, c.v)) masque[i] = 1;
  }
  const demi = Math.max(1, Math.round(Math.max(w, h) / 400)); // relie les pixels d'une même icône
  const relie = boite(masque, w, h, demi, 'd');
  const vu = new Uint8Array(w * h);
  const out = [];
  for (let depart = 0; depart < w * h; depart++) {
    if (!relie[depart] || vu[depart]) continue;
    const pile = [depart];
    vu[depart] = 1;
    let aire = 0, sx = 0, sy = 0;
    while (pile.length) {
      const i = pile.pop();
      const x = i % w, y = (i / w) | 0;
      if (masque[i]) { aire++; sx += x; sy += y; }
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && relie[j] && !vu[j]) { vu[j] = 1; pile.push(j); }
      }
    }
    if (aire) out.push({ x: sx / aire, y: sy / aire, aire });
  }
  return out.sort((a, b) => b.aire - a.aire);
}

const plusGrandeTache = (rgba, w, h, test) => taches(rgba, w, h, test)[0] || null;

/** Test de couleur de la flèche jaune du joueur (carte et minimap). */
const estJauneJoueur = (t, s, v) => t >= 48 && t <= 62 && s > 0.35 && v > 0.85;

/**
 * Centre du joueur sur une image de minimap : la flèche jaune située dans la salle `boite` {x0,x1,y0,y1}
 * (l'icône de soleil, jaune aussi, est hors de la salle). null si introuvable.
 */
export function centreJoueur(rgba, w, h, boite) {
  const t = taches(rgba, w, h, estJauneJoueur)
    .filter((c) => !boite || (c.x >= boite.x0 && c.x <= boite.x1 && c.y >= boite.y0 && c.y <= boite.y1));
  return t.length ? { x: t[0].x, y: t[0].y } : null;
}

/**
 * Seuil de luminosité adapté à l'image : la minimap est plus ou moins sombre selon la zone et les effets de lumière.
 * On part de 72 % du 90e centile de luminosité des pixels peu saturés (le sol éclairé), borné à [105 ; lumMax] : le seuil ne
 * dépasse jamais celui par défaut, il baisse seulement quand l'image est terne.
 */
export function lumMinAdaptative(rgba, w, h, { lumMax = 140, satMax = 40, plancher = 105 } = {}) {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    if (rgba[i * 4 + 3] < 128 || Math.max(r, g, b) - Math.min(r, g, b) > satMax) continue;
    hist[Math.round((r + g + b) / 3)]++; n++;
  }
  if (n < 50) return lumMax;
  let cumul = 0, p90 = 255;
  for (let v = 0; v < 256; v++) { cumul += hist[v]; if (cumul >= 0.9 * n) { p90 = v; break; } }
  return Math.max(plancher, Math.min(lumMax, Math.round(0.72 * p90)));
}

/**
 * Icônes de portes visibles sur la minimap (orange = entrée principale, bleue = entrée secondaire), chacune indépendamment :
 * { orange: {x, y} | null, bleu: {x, y} | null } en pixels de la minimap. Sert de repère pour recaler la position.
 */
export function reperesMinimap(rgba, w, h) {
  const orange = plusGrandeTache(rgba, w, h, (t, s, v) => t >= 15 && t <= 45 && s > 0.5 && v > 0.6);
  const bleu = plusGrandeTache(rgba, w, h, (t, s, v) => t >= 200 && t <= 235 && s > 0.35 && v > 0.7);
  const minAire = Math.max(20, w * h * 0.0003);
  return {
    orange: orange && orange.aire >= minAire ? { x: orange.x, y: orange.y } : null,
    bleu: bleu && bleu.aire >= minAire ? { x: bleu.x, y: bleu.y } : null,
  };
}

/** Analyse de la minimap : { signature, plein, w, h, centre, portes } (seuil de luminosité adapté à l'image). */
export function analyserMinimap(rgba, w, h) {
  const lumMin = Math.min(SEUILS.minimap.lumMin, lumMinAdaptative(rgba, w, h, { lumMax: SEUILS.minimap.lumMin, satMax: SEUILS.minimap.satMax }));
  const masque = masqueClair(rgba, w, h, { ...SEUILS.minimap, lumMin });
  const signature = signatureSalle(masque, w, h);
  if (!signature) return null;
  return { signature, plein: remplirTrous(masque, w, h), w, h, centre: centreJoueur(rgba, w, h, signature.boite), portes: reperesMinimap(rgba, w, h), lumMin };
}

/**
 * Repères des portes sur une capture de la carte en jeu : icône ORANGE (entrée principale / départ) et icône BLEUE
 * (entrée secondaire, seulement si déjà découverte). Renvoie { orange: {x, y} | null, bleu: {x, y} | null }.
 */
export function reperesPortes(rgba, w, h) {
  const orange = plusGrandeTache(rgba, w, h, (t, s, v) => t >= 15 && t <= 45 && s > 0.5 && v > 0.6);
  const bleu = plusGrandeTache(rgba, w, h, (t, s, v) => t >= 200 && t <= 235 && s > 0.35 && v > 0.7);
  const minAire = Math.max(6, w * h * 0.00004);
  return {
    orange: orange && orange.aire >= minAire ? { x: orange.x, y: orange.y } : null,
    // une icône bleue bien plus petite que l'orange est un parasite (interface, reflet)
    bleu: bleu && orange && bleu.aire >= 0.4 * orange.aire && bleu.aire >= minAire ? { x: bleu.x, y: bleu.y } : null,
  };
}

/**
 * Observation d'une capture de la CARTE : sorties de la salle de départ + vecteurs porte orange → porte bleue et
 * porte orange → joueur, exprimés en « tailles de salle de départ » (indépendants du zoom). null sans porte orange.
 */
export function observerCarte(rgba, w, h) {
  const { orange, bleu } = reperesPortes(rgba, w, h);
  if (!orange) return null;
  const sig = signatureSalle(masqueClair(rgba, w, h, SEUILS.carte), w, h, { ancre: orange });
  if (!sig) return null;
  const taille = 2 * sig.demi + 1;
  const fleche = plusGrandeTache(rgba, w, h, estJauneJoueur);
  const rel = (p) => ({ x: (p.x - orange.x) / taille, y: (p.y - orange.y) / taille });
  return {
    sorties: sig.sorties,
    taille,
    vecteur: bleu ? rel(bleu) : null,
    joueur: fleche && fleche.aire >= Math.max(6, w * h * 0.00004) ? rel(fleche) : null, // flèche jaune du joueur
  };
}

/** Vecteur porte principale → porte secondaire d'un plan, en tailles de salle de départ (pixels de la miniature). */
export function vecteurPlan(principale, secondaire, taille) {
  if (!principale || !secondaire || !taille) return null;
  return { x: (secondaire.x - principale.x) / taille, y: (secondaire.y - principale.y) / taille };
}

/**
 * Score 0..1 d'une observation de carte face à un plan : vecteur entre les portes (75 %) + sorties de la salle
 * de départ (25 %). Sans porte bleue découverte, seules les sorties comptent (score plafonné à 0.6).
 */
export function scoreCarte(obs, ref) {
  if (!obs || !ref || !ref.signature) return 0;
  const ss = scoreSorties(obs.sorties, ref.signature.sorties);
  if (!obs.vecteur || !ref.vecteur) return ss * 0.6;
  const norme = Math.max(1, Math.hypot(ref.vecteur.x, ref.vecteur.y));
  const e = Math.hypot(obs.vecteur.x - ref.vecteur.x, obs.vecteur.y - ref.vecteur.y) / norme;
  return 0.75 * Math.max(0, 1 - e / 0.5) + 0.25 * ss;
}

/** Classe les plans selon une observation de carte. `references` : [{ id, signature, vecteur }]. */
export function classerParCarte(obs, references) {
  if (!obs) return [];
  return references.map((r) => ({ id: r.id, score: scoreCarte(obs, r) })).sort((a, b) => b.score - a.score);
}
