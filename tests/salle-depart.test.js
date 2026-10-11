import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signatureSalle, remplirTrous, pivoterSorties, scoreSorties, scoreSalle, classerParSalle, libelleSorties,
} from '../src/lib/salle-depart.js';

/** Masque synthétique : salle carrée avec 4 piliers + couloirs (rectangles [x0, y0, x1, y1] exclusifs). */
function carte(w, h, salle, couloirs = [], piliers = true) {
  const m = new Uint8Array(w * h);
  const rect = ([x0, y0, x1, y1]) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + x] = 1; };
  rect(salle);
  couloirs.forEach(rect);
  if (piliers) {
    const [x0, y0, x1, y1] = salle;
    const p = Math.max(2, Math.round((x1 - x0) / 10));
    for (const [px, py] of [[x0 + p * 2, y0 + p * 2], [x1 - p * 3, y0 + p * 2], [x0 + p * 2, y1 - p * 3], [x1 - p * 3, y1 - p * 3]]) {
      for (let y = py; y < py + p; y++) for (let x = px; x < px + p; x++) m[y * w + x] = 0;
    }
  }
  return m;
}

const SALLE = [60, 50, 120, 110]; // 60×60, centre (90, 80)

test('remplirTrous : comble les piliers mais pas une boucle plus grande que maxCote', () => {
  const w = 100, h = 100;
  const m = new Uint8Array(w * h);
  for (let y = 10; y < 90; y++) for (let x = 10; x < 90; x++) m[y * w + x] = 1;
  for (let y = 20; y < 24; y++) for (let x = 20; x < 24; x++) m[y * w + x] = 0; // pilier 4×4
  for (let y = 40; y < 70; y++) for (let x = 40; x < 70; x++) m[y * w + x] = 0; // vide 30×30
  const p = remplirTrous(m, w, h, 8);
  assert.equal(p[21 * w + 21], 1);
  assert.equal(p[50 * w + 50], 0);
  assert.equal(remplirTrous(m, w, h)[50 * w + 50], 1);
});

test('signatureSalle : une seule sortie à l\'ouest (cas minimap en jeu, sans ancre)', () => {
  const w = 200, h = 160;
  const m = carte(w, h, SALLE, [[10, 70, 60, 90]]);
  const s = signatureSalle(m, w, h);
  assert.equal(s.sorties, 'O');
  assert.ok(s.demi >= 25 && s.demi <= 31);
});

test('signatureSalle : sorties multiples, ordre N,E,S,O', () => {
  const w = 200, h = 160;
  const m = carte(w, h, SALLE, [[80, 5, 100, 50], [120, 70, 190, 90], [40, 110, 60, 150].map((v, i) => (i === 0 ? 70 : i === 2 ? 90 : v)), [10, 70, 60, 90]]);
  assert.equal(signatureSalle(m, w, h).sorties, 'NESO');
});

test('signatureSalle : salle fermée, ou trop petite → pas de sortie / null', () => {
  const w = 200, h = 160;
  assert.equal(signatureSalle(carte(w, h, SALLE), w, h).sorties, '');
  assert.equal(signatureSalle(new Uint8Array(w * h), w, h), null);
});

test('signatureSalle : indépendante de la résolution (même salle ×2)', () => {
  const a = signatureSalle(carte(200, 160, SALLE, [[10, 70, 60, 90]]), 200, 160);
  const g = [120, 100, 240, 220];
  const b = signatureSalle(carte(400, 320, g, [[20, 140, 120, 180]]), 400, 320);
  assert.equal(a.sorties, b.sorties);
});

test('signatureSalle avec ancre : choisit la salle proche du départ, pas la plus grande', () => {
  const w = 400, h = 200;
  const m = carte(w, h, [20, 60, 70, 110], [[70, 75, 150, 95]]);          // petite salle, sortie E
  const grande = carte(w, h, [200, 30, 330, 160], [[150, 90, 200, 110]]); // grande salle à droite
  for (let i = 0; i < m.length; i++) m[i] = m[i] | grande[i];
  assert.equal(signatureSalle(m, w, h, { ancre: { x: 45, y: 85 } }).sorties, 'E');
  assert.equal(signatureSalle(m, w, h, { ancre: { x: 265, y: 95 } }).sorties, 'O');
});

test('pivoterSorties et scoreSorties', () => {
  assert.equal(pivoterSorties('O', 1), 'N');
  assert.equal(pivoterSorties('N', 2), 'S');
  assert.equal(pivoterSorties('ES', 1), 'SO');
  assert.equal(scoreSorties('O', 'O'), 1);
  assert.equal(scoreSorties('O', 'NO'), 0.25);
  assert.equal(scoreSorties('O', 'E'), 0);
});

test('scoreSalle : une minimap qui pivote est reconnue si on l\'autorise', () => {
  assert.equal(scoreSalle('E', 'O'), 0);
  assert.ok(scoreSalle('E', 'O', { pivote: true }) > 0.85);
});

test('classerParSalle : égalités conservées, plans sans signature ignorés', () => {
  const refs = [
    { id: '1', signature: { sorties: 'O' } },
    { id: '2', signature: { sorties: 'S' } },
    { id: '3', signature: { sorties: 'O' } },
    { id: '4', signature: null },
  ];
  const r = classerParSalle({ sorties: 'O' }, refs);
  assert.deepEqual(r.slice(0, 2).map((x) => x.id).sort(), ['1', '3']);
  assert.equal(r.length, 3);
  assert.deepEqual(classerParSalle(null, refs), []);
});

test('libelleSorties', () => {
  assert.equal(libelleSorties('O'), "sortie à l'ouest");
  assert.equal(libelleSorties('NE'), "sorties au nord et à l'est");
  assert.equal(libelleSorties('NSO'), "sorties au nord, au sud et à l'ouest");
  assert.equal(libelleSorties(''), 'aucune sortie');
});
