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
 * la minimap autour du joueur. `echelle` = pixels miniature par pixel minimap ; `rayon` en pixels miniature.
 */
export function echantillonnerMinimap(plein, w, h, centre, echelle, rayon) {
  const r = Math.max(2, Math.round(rayon));
  const dx = [], dy = [], m = [];
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
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
 * `autour` {x, y} + `rayon` : fenêtre de recherche (suivi) ; sans eux, tout le plan (pas de 2 puis affinage).
 * Renvoie { x, y, corr } ou null (disque vide / uniforme). `ref.marge` doit être ≥ au rayon du disque + 1.
 */
export function localiser(ech, ref, { autour = null, rayon = 0 } = {}) {
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
  const essayer = (cx, cy) => {
    const c = score(cx, cy);
    if (c > meilleur.corr) { meilleur.x = cx; meilleur.y = cy; meilleur.corr = c; }
  };
  const bornes = autour
    ? [Math.max(0, Math.round(autour.x - rayon)), Math.min(w - 1, Math.round(autour.x + rayon)),
       Math.max(0, Math.round(autour.y - rayon)), Math.min(h - 1, Math.round(autour.y + rayon))]
    : [0, w - 1, 0, h - 1];
  const pas = autour ? 1 : 2;
  for (let cy = bornes[2]; cy <= bornes[3]; cy += pas) for (let cx = bornes[0]; cx <= bornes[1]; cx += pas) essayer(cx, cy);
  if (pas > 1) {
    const { x, y } = meilleur;
    for (let cy = Math.max(0, y - pas); cy <= Math.min(h - 1, y + pas); cy++) for (let cx = Math.max(0, x - pas); cx <= Math.min(w - 1, x + pas); cx++) essayer(cx, cy);
  }
  return meilleur.corr > -2 ? meilleur : null;
}

/**
 * Position sur le plan d'après la carte entière ouverte : porte orange du plan + vecteur observé (flèche du joueur)
 * × taille de la salle de départ du plan. `ref` : { porteOrange: {x, y} (px), taille }. null si le joueur n'est pas visible.
 */
export function positionDepuisCarte(obs, ref) {
  if (!obs || !obs.joueur || !ref || !ref.porteOrange || !ref.taille) return null;
  return { x: ref.porteOrange.x + obs.joueur.x * ref.taille, y: ref.porteOrange.y + obs.joueur.y * ref.taille };
}
