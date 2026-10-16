/**
 * Lissage de la position en temps réel : filtre alpha-bêta (position + vitesse) avec estimation de l'incertitude.
 * Les mesures (minimap, carte, repères) sont bruitées : on les fond dans une trajectoire régulière, on prédit entre deux mesures
 * et on exprime la fiabilité par un rayon (px de la miniature) qui grossit sans mesure et se resserre quand la corrélation est forte.
 * Logique pure (sans React), testée par `npm test`.
 */

/** État vide. `taille` = taille de la salle de départ du plan (px de la miniature). */
export function creerFiltre(taille) {
  return { x: 0, y: 0, vx: 0, vy: 0, rayon: 0, t: null, init: false, taille };
}

/** Rayon d'incertitude d'une mesure selon sa qualité `c` (corrélation 0..1) : de ~0,15 à ~1 taille de salle. */
export function rayonMesure(c, taille) {
  const q = Math.max(0, Math.min(1, c));
  return taille * (0.15 + 0.85 * (1 - q));
}

/**
 * Intègre une mesure `{ x, y, c }` (c = qualité 0..1) à l'instant `t` (secondes), ou `null` si aucune mesure n'est disponible.
 * Renvoie { x, y, vx, vy, rayon, init } (position lissée ; vitesse en px/s, pour extrapoler l'affichage entre deux mesures). Une mesure à plus de 3 tailles de salle de la position prédite est un saut
 * (téléportation, re-localisation, repositionnement manuel) : le filtre repart de la mesure.
 */
export function mettreAJourFiltre(f, mesure, t) {
  const dt = f.t === null ? 0 : Math.max(0.001, Math.min(1, t - f.t));
  f.t = t;
  if (!f.init) {
    if (!mesure) return { x: f.x, y: f.y, vx: 0, vy: 0, rayon: f.rayon, init: false };
    Object.assign(f, { x: mesure.x, y: mesure.y, vx: 0, vy: 0, rayon: rayonMesure(mesure.c, f.taille), init: true });
    return { x: f.x, y: f.y, vx: f.vx, vy: f.vy, rayon: f.rayon, init: true };
  }
  // prédiction
  const px = f.x + f.vx * dt, py = f.y + f.vy * dt;
  if (!mesure) {
    f.x = px; f.y = py;
    // Amortissement de la vitesse selon le temps écoulé (et non par appel : la cadence des mesures varie). exp(-0,4 / 1,1) ≈ 0,7.
    const amorti = Math.exp(-dt / 1.1);
    f.vx *= amorti; f.vy *= amorti;
    f.rayon = Math.min(3 * f.taille, f.rayon + 0.25 * f.taille * Math.max(dt, 0.1));
    return { x: f.x, y: f.y, vx: f.vx, vy: f.vy, rayon: f.rayon, init: true };
  }
  const ex = mesure.x - px, ey = mesure.y - py;
  if (Math.hypot(ex, ey) > 3 * f.taille) {
    Object.assign(f, { x: mesure.x, y: mesure.y, vx: 0, vy: 0, rayon: rayonMesure(mesure.c, f.taille) });
    return { x: f.x, y: f.y, vx: f.vx, vy: f.vy, rayon: f.rayon, init: true };
  }
  const q = Math.max(0, Math.min(1, mesure.c));
  const alpha = 0.25 + 0.6 * q; // mesure fiable : on la suit presque telle quelle ; douteuse : on lisse davantage
  const beta = dt > 0 ? 0.08 + 0.12 * q : 0;
  f.x = px + alpha * ex; f.y = py + alpha * ey;
  if (dt > 0) { f.vx += (beta * ex) / dt; f.vy += (beta * ey) / dt; }
  const vmax = 6 * f.taille; // px/s : plafond de vitesse plausible (évite l'emballement)
  const v = Math.hypot(f.vx, f.vy);
  if (v > vmax) { f.vx *= vmax / v; f.vy *= vmax / v; }
  f.rayon = 0.7 * f.rayon + 0.3 * rayonMesure(mesure.c, f.taille);
  return { x: f.x, y: f.y, vx: f.vx, vy: f.vy, rayon: f.rayon, init: true };
}

/** Constante de temps (s) de l'amortissement de la vitesse quand on extrapole sans mesure. */
export const TAU_EXTRAPOLATION = 0.5;

/**
 * Position affichée `dt` secondes après l'état lissé `e` ({ x, y, vx, vy }) : le point continue sur sa lancée, la vitesse
 * s'amortissant (constante `tau`) pour ne pas partir loin si les mesures tardent. Déplacement borné à vitesse × tau.
 * Logique pure : sert à l'animation à chaque image de l'écran, entre deux mesures.
 */
export function extrapoler(e, dt, tau = TAU_EXTRAPOLATION) {
  if (!e) return null;
  const d = Math.max(0, Number.isFinite(dt) ? dt : 0);
  const k = tau * (1 - Math.exp(-d / tau));
  return { x: e.x + (e.vx || 0) * k, y: e.y + (e.vy || 0) * k };
}

/**
 * Qualité 0..1 d'une corrélation de recalage de la minimap. La corrélation n'est acceptée qu'à partir de `corrMin` : on étale
 * donc [corrMin ; 1] sur [0,1] pour qu'un recalage tout juste accepté pèse peu dans le filtre et qu'un recalage net le domine.
 */
export function qualiteCorrelation(corr, corrMin = 0.5) {
  if (!(corr > corrMin)) return 0;
  return Math.min(1, (corr - corrMin) / (1 - corrMin));
}
