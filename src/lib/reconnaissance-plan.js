/**
 * Reconnaissance d'un plan du Sanctuaire perdu à partir d'une capture de la carte en jeu.
 *
 * Principe : on isole la carte (pixels qui diffèrent du fond), on la recadre, on la réduit à une
 * grille de densité N×N, puis on compare cette « empreinte » à celle de chaque plan
 * (similarité cosinus × pénalité de proportions). Tout se fait localement, dans le navigateur.
 */

export const TAILLE_EMPREINTE = 48;

const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Couleur de fond estimée : médiane des pixels du pourtour. */
function couleurFond(rgba, w, h) {
  const rs = [], gs = [], bs = [];
  const pousser = (x, y) => { const i = (y * w + x) * 4; rs.push(rgba[i]); gs.push(rgba[i + 1]); bs.push(rgba[i + 2]); };
  for (let x = 0; x < w; x++) { pousser(x, 0); pousser(x, h - 1); }
  for (let y = 0; y < h; y++) { pousser(0, y); pousser(w - 1, y); }
  const med = (t) => t.sort((a, b) => a - b)[Math.floor(t.length / 2)];
  return [med(rs), med(gs), med(bs)];
}

/**
 * Empreinte d'une image RGBA : { grille: Float32Array(N*N) normalisée, ratio } ou null si rien de détecté.
 * `seuil` = écart de luminance minimal avec le fond pour compter comme « carte ».
 */
export function empreinteDepuisRGBA(rgba, w, h, { seuil = 40, taille = TAILLE_EMPREINTE } = {}) {
  if (!w || !h || rgba.length < w * h * 4) return null;
  const [fr, fg, fb] = couleurFond(rgba, w, h);
  const lumFond = luminance(fr, fg, fb);
  const masque = new Uint8Array(w * h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] < 128) continue;
      if (Math.abs(luminance(rgba[i], rgba[i + 1], rgba[i + 2]) - lumFond) > seuil) {
        masque[y * w + x] = 1;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  if (bw < 8 || bh < 8) return null;

  const grille = new Float32Array(taille * taille);
  const nb = new Float32Array(taille * taille);
  for (let y = minY; y <= maxY; y++) {
    const gy = Math.min(taille - 1, Math.floor(((y - minY) / bh) * taille));
    for (let x = minX; x <= maxX; x++) {
      const gx = Math.min(taille - 1, Math.floor(((x - minX) / bw) * taille));
      grille[gy * taille + gx] += masque[y * w + x];
      nb[gy * taille + gx] += 1;
    }
  }
  let norme = 0;
  for (let i = 0; i < grille.length; i++) {
    grille[i] = nb[i] ? grille[i] / nb[i] : 0;
    norme += grille[i] * grille[i];
  }
  norme = Math.sqrt(norme) || 1;
  for (let i = 0; i < grille.length; i++) grille[i] /= norme;
  return { grille, ratio: bw / bh };
}

/** Similarité 0..1 entre deux empreintes. */
export function similarite(a, b) {
  if (!a || !b) return 0;
  let dot = 0;
  for (let i = 0; i < a.grille.length; i++) dot += a.grille[i] * b.grille[i];
  const p = Math.min(a.ratio, b.ratio) / Math.max(a.ratio, b.ratio);
  return Math.max(0, dot) * p * p;
}

/** Classe les plans par similarité décroissante. `references` : [{ id, empreinte }]. */
export function classer(empreinte, references) {
  return references
    .map((r) => ({ id: r.id, score: similarite(empreinte, r.empreinte) }))
    .sort((x, y) => y.score - x.score);
}

// ---------- Partie navigateur (canvas) ----------

function rgbaDepuisImage(image, tailleMax = 640) {
  const echelle = Math.min(1, tailleMax / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const w = Math.max(1, Math.round((image.naturalWidth || image.width) * echelle));
  const h = Math.max(1, Math.round((image.naturalHeight || image.height) * echelle));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  return { rgba: ctx.getImageData(0, 0, w, h).data, w, h };
}

export function chargerImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function empreinteDepuisSource(src, options) {
  const image = await chargerImage(src);
  const { rgba, w, h } = rgbaDepuisImage(image);
  return empreinteDepuisRGBA(rgba, w, h, options);
}
