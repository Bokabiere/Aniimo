/**
 * Position du joueur sur le plan, d'après la minimap en jeu.
 *
 * La minimap est centrée sur le joueur (nord en haut). On en prélève un disque de pixels « praticables », remis à l'échelle
 * de la miniature du plan, et on cherche l'endroit du plan où la corrélation est maximale (corrélation normalisée de masques
 * binaires). Le disque reste dans l'anneau de la minimap (rayon ≈ 0,75 salle de départ).
 * Logique pure (sans React), testée par `npm test`.
 */

/** Rayon du disque comparé, en tailles de salle de départ. */
export const RAYON_DISQUE = 0.75;

/** Miniature préparée : masque entouré d'une marge de `marge` pixels pour éviter les tests de bords. */
export function preparerRef(masque, w, h, marge) {
  const W = w + 2 * marge;
  const data = new Uint8Array(W * (h + 2 * marge));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[(y + marge) * W + x + marge] = masque[y * w + x];
  return { data, W, w, h, marge };
}

/**
 * Échantillons du disque de la minimap : pour chaque (dx, dy) du disque (en pixels de la miniature), la valeur du masque de
 * la minimap autour du joueur. `echelle` = pixels miniature par pixel minimap ; `rayon` en pixels miniature ;
 * `pas` > 1 sous-échantillonne le disque (calcul plus rapide).
 */
export function echantillonnerMinimap(plein, w, h, centre, echelle, rayon, pas = 1) {
  const r = Math.max(2, Math.round(rayon));
  const dx = [], dy = [], m = [];
  for (let y = -r; y <= r; y += pas) {
    for (let x = -r; x <= r; x += pas) {
      if (x * x + y * y > r * r) continue;
      const sx = Math.round(centre.x + x / echelle), sy = Math.round(centre.y + y / echelle);
      dx.push(x); dy.push(y);
      m.push(sx >= 0 && sy >= 0 && sx < w && sy < h ? plein[sy * w + sx] : 0);
    }
  }
  return { dx: Int16Array.from(dx), dy: Int16Array.from(dy), m: Uint8Array.from(m), rayon: r };
}

/**
 * Cherche la position (x, y en pixels de la miniature) qui maximise la corrélation avec le disque échantillonné.
 * `autour` {x, y} + `rayon` : fenêtre de recherche (suivi) ; sans eux, tout le plan. `pas` : 1 = exhaustif ;
 * par défaut 1 pour un suivi et 2 (puis affinage) pour tout le plan.
 * Renvoie { x, y, corr } ou null (disque vide / uniforme). `ref.marge` doit être ≥ au rayon du disque + 1.
 */
export function localiser(ech, ref, { autour = null, rayon = 0, pas: pasDemande = 0 } = {}) {
  const n = ech.m.length;
  let sm = 0;
  for (let k = 0; k < n; k++) sm += ech.m[k];
  const varM = n * sm - sm * sm;
  if (varM <= 0) return null;
  const decalages = new Int32Array(n);
  for (let k = 0; k < n; k++) decalages[k] = ech.dy[k] * ref.W + ech.dx[k];
  const { data, W, marge, w, h } = ref;

  const score = (cx, cy) => {
    const base = (cy + marge) * W + cx + marge;
    let sr = 0, srm = 0;
    for (let k = 0; k < n; k++) {
      const v = data[base + decalages[k]];
      sr += v;
      srm += v & ech.m[k];
    }
    const den = varM * (n * sr - sr * sr);
    return den > 0 ? (n * srm - sm * sr) / Math.sqrt(den) : -2;
  };

  const meilleur = { x: 0, y: 0, corr: -2 };
  let meilleurAjuste = -Infinity;
  const essayer = (cx, cy) => {
    const c = score(cx, cy);
    // En suivi, à corrélation quasi égale (couloir rectiligne : position ambiguë le long de l'axe) on préfère la position la plus proche
    // de la précédente : pénalité très faible par pixel d'écart.
    const aj = autour ? c - 0.0004 * Math.hypot(cx - autour.x, cy - autour.y) : c;
    if (aj > meilleurAjuste) { meilleurAjuste = aj; meilleur.x = cx; meilleur.y = cy; meilleur.corr = c; }
  };
  const bornes = autour
    ? [Math.max(0, Math.round(autour.x - rayon)), Math.min(w - 1, Math.round(autour.x + rayon)),
       Math.max(0, Math.round(autour.y - rayon)), Math.min(h - 1, Math.round(autour.y + rayon))]
    : [0, w - 1, 0, h - 1];
  const pas = pasDemande || (autour ? 1 : 2); // pas > 1 : recherche grossière puis affinage
  for (let cy = bornes[2]; cy <= bornes[3]; cy += pas) for (let cx = bornes[0]; cx <= bornes[1]; cx += pas) essayer(cx, cy);
  if (pas > 1) {
    const { x, y } = meilleur;
    for (let cy = Math.max(0, y - pas); cy <= Math.min(h - 1, y + pas); cy++) for (let cx = Math.max(0, x - pas); cx <= Math.min(w - 1, x + pas); cx++) essayer(cx, cy);
  }
  if (meilleur.corr <= -2) return null;
  // Affinage sous-pixel : parabole passant par le pic et ses voisins (axe par axe).
  const { x, y, corr } = meilleur;
  const sous = (m, c, p) => { const d = m - 2 * c + p; return d < -1e-9 ? Math.max(-0.5, Math.min(0.5, (0.5 * (m - p)) / d)) : 0; };
  const fx = x > 0 && x < w - 1 ? x + sous(score(x - 1, y), corr, score(x + 1, y)) : x;
  const fy = y > 0 && y < h - 1 ? y + sous(score(x, y - 1), corr, score(x, y + 1)) : y;
  return { x, y, fx, fy, corr };
}

/**
 * Position sur le plan d'après la carte entière ouverte : porte orange du plan + vecteur observé (flèche du joueur)
 * × taille de la salle de départ du plan. `ref` : { porteOrange: {x, y} (px), taille }. null si le joueur n'est pas visible.
 */
export function positionDepuisCarte(obs, ref) {
  if (!obs || !obs.joueur || !ref || !ref.porteOrange || !ref.taille) return null;
  return { x: ref.porteOrange.x + obs.joueur.x * ref.taille, y: ref.porteOrange.y + obs.joueur.y * ref.taille };
}

/**
 * Recalage sur un repère : une icône de porte vue sur la minimap (orange = porte principale, bleue = porte secondaire) donne la
 * position du joueur sans ambiguïté : position = porte du plan − (icône − joueur) × échelle.
 * `portes` { orange, bleu } et `centre` en pixels de la minimap ; `echelle` = pixels miniature par pixel minimap ;
 * `pins` { main, side } en pixels de la miniature ; `pos` = position suivie. Une mesure à plus de `rayonMax` de `pos` est une
 * fausse détection (décor, interface) et est ignorée. Renvoie { x, y, n } (moyenne des repères cohérents) ou null.
 */
export function recalageRepere({ portes, centre, echelle, pins, pos, rayonMax }) {
  if (!portes || !centre || !pins || !pos || !echelle) return null;
  const mesures = [];
  for (const [blob, pin] of [[portes.orange, pins.main], [portes.bleu, pins.side]]) {
    if (!blob || !pin) continue;
    const x = pin.x - (blob.x - centre.x) * echelle;
    const y = pin.y - (blob.y - centre.y) * echelle;
    if (Math.hypot(x - pos.x, y - pos.y) <= rayonMax) mesures.push({ x, y });
  }
  if (!mesures.length) return null;
  return { x: mesures.reduce((a, m) => a + m.x, 0) / mesures.length, y: mesures.reduce((a, m) => a + m.y, 0) / mesures.length, n: mesures.length };
}
