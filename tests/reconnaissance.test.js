import { test } from 'node:test';
import assert from 'node:assert/strict';
import { empreinteDepuisRGBA, similarite, classer } from '../src/lib/reconnaissance-plan.js';

/** Image synthétique : fond sombre + rectangles clairs. */
function image(w, h, rects, fond = 20, clair = 220) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { rgba.set([fond, fond, fond, 255], i * 4); }
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgba.set([clair, clair, clair, 255], (y * w + x) * 4);
  }
  return { rgba, w, h };
}
const emp = (img) => empreinteDepuisRGBA(img.rgba, img.w, img.h);

const L = [[10, 10, 30, 90], [10, 70, 90, 90]];          // forme en L
const T = [[10, 10, 90, 30], [42, 10, 58, 90]];          // forme en T

test('empreinte : image vide → null', () => {
  const v = image(50, 50, []);
  assert.equal(emp(v), null);
});

test('similarité : même forme à une autre échelle ≈ 1', () => {
  const a = emp(image(100, 100, L));
  const grand = L.map((r) => r.map((v) => v * 2));
  const b = emp(image(200, 200, grand));
  assert.ok(similarite(a, b) > 0.95);
});

test('similarité : insensible à la couleur de fond et au décalage', () => {
  const a = emp(image(100, 100, L));
  const decale = L.map(([x0, y0, x1, y1]) => [x0 + 20, y0 + 10, x1 + 20, y1 + 10]);
  const b = emp(image(140, 120, decale, 200, 30)); // fond clair, forme sombre
  assert.ok(similarite(a, b) > 0.9);
});

test('classer : la bonne forme arrive en premier', () => {
  const refs = [
    { id: 'T', empreinte: emp(image(100, 100, T)) },
    { id: 'L', empreinte: emp(image(100, 100, L)) },
  ];
  const requete = emp(image(160, 160, L.map((r) => r.map((v) => v * 1.6))));
  const r = classer(requete, refs);
  assert.equal(r[0].id, 'L');
  assert.ok(r[0].score > r[1].score);
});

test('similarité : proportions très différentes → score pénalisé', () => {
  const a = emp(image(100, 100, [[10, 10, 90, 90]]));
  const b = emp(image(100, 100, [[10, 40, 90, 60]]));
  assert.ok(similarite(a, b) < 0.5);
});
