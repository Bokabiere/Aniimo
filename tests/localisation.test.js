import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparerRef, echantillonnerMinimap, localiser, positionDepuisCarte, RAYON_DISQUE } from '../src/lib/localisation.js';

/** Plan synthétique 200×140 : trois salles reliées par des couloirs, dessin asymétrique. */
function plan() {
  const w = 200, h = 140;
  const m = new Uint8Array(w * h);
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + x] = 1; };
  rect(10, 10, 40, 40);    // salle A
  rect(40, 20, 100, 28);   // couloir A→B
  rect(100, 10, 140, 60);  // salle B
  rect(115, 60, 123, 120); // couloir vers le sud
  rect(90, 110, 160, 135); // salle C
  rect(160, 118, 195, 124);
  return { m, w, h };
}

/** Minimap synthétique : le plan agrandi d'un facteur `k`, vu depuis (cx, cy) du plan, dans une image de 240×240 (joueur au centre). */
function minimap({ m, w, h }, cx, cy, k) {
  const S = 240;
  const out = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const px = Math.floor(cx + (x - S / 2) / k), py = Math.floor(cy + (y - S / 2) / k);
    out[y * S + x] = px >= 0 && py >= 0 && px < w && py < h ? m[py * w + px] : 0;
  }
  return { plein: out, w: S, h: S, centre: { x: S / 2, y: S / 2 } };
}

const TAILLE_SALLE = 30; // « taille de salle de départ » de ce plan synthétique

test('localiser : retrouve la position (recherche globale), minimap à une autre échelle', () => {
  const p = plan();
  const ref = preparerRef(p.m, p.w, p.h, Math.ceil(RAYON_DISQUE * TAILLE_SALLE) + 2);
  for (const [cx, cy] of [[118, 90], [60, 24], [125, 40], [130, 125]]) {
    const mm = minimap(p, cx, cy, 3);
    const ech = echantillonnerMinimap(mm.plein, mm.w, mm.h, mm.centre, 1 / 3, RAYON_DISQUE * TAILLE_SALLE);
    const r = localiser(ech, ref);
    assert.ok(Math.abs(r.x - cx) <= 2 && Math.abs(r.y - cy) <= 2, `attendu ${cx},${cy} obtenu ${r.x},${r.y}`);
    assert.ok(r.corr > 0.9);
  }
});

test('localiser : le suivi ne cherche que dans la fenêtre demandée', () => {
  const p = plan();
  const ref = preparerRef(p.m, p.w, p.h, Math.ceil(RAYON_DISQUE * TAILLE_SALLE) + 2);
  const mm = minimap(p, 118, 90, 3);
  const ech = echantillonnerMinimap(mm.plein, mm.w, mm.h, mm.centre, 1 / 3, RAYON_DISQUE * TAILLE_SALLE);
  const proche = localiser(ech, ref, { autour: { x: 112, y: 84 }, rayon: 15 });
  assert.ok(Math.abs(proche.x - 118) <= 2 && Math.abs(proche.y - 90) <= 2);
  const loin = localiser(ech, ref, { autour: { x: 30, y: 25 }, rayon: 8 });
  assert.ok(loin.x <= 38 && loin.y <= 33); // reste dans la fenêtre, ne « téléporte » pas
});

test('localiser : disque uniforme (rien d\'utile à voir) → null', () => {
  const p = plan();
  const ref = preparerRef(p.m, p.w, p.h, 25);
  const vide = echantillonnerMinimap(new Uint8Array(100 * 100), 100, 100, { x: 50, y: 50 }, 1, 20);
  assert.equal(localiser(vide, ref), null);
});

test('positionDepuisCarte : porte orange + vecteur × taille de salle', () => {
  const ref = { porteOrange: { x: 100, y: 200 }, taille: 40 };
  assert.deepEqual(positionDepuisCarte({ joueur: { x: 0.5, y: -2 } }, ref), { x: 120, y: 120 });
  assert.equal(positionDepuisCarte({ joueur: null }, ref), null);
  assert.equal(positionDepuisCarte(null, ref), null);
});
