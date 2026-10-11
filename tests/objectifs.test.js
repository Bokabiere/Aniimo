import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fleche, plusProche, estOeuf, estCle } from '../src/lib/objectifs.js';

const plan = { pins: [
  { type: 'nest', x: 80, y: 50 }, { type: 'nest', x: 30, y: 50 }, { type: 'key-gold', x: 50, y: 90 }, { type: 'door-main', x: 50, y: 50 },
] };
const dim = { largeur: 200, hauteur: 100, taille: 20 };

test('fleche : 8 directions', () => {
  assert.equal(fleche(1, 0), '→'); assert.equal(fleche(0, 1), '↓'); assert.equal(fleche(-1, 0), '←');
  assert.equal(fleche(0, -1), '↑'); assert.equal(fleche(1, 1), '↘'); assert.equal(fleche(-1, -1), '↖');
});

test('plusProche : œuf le plus proche, distance en salles, éléments faits ignorés', () => {
  const j = { x: 40, y: 50 };
  const o = plusProche(plan, j, new Set(), dim, estOeuf);
  assert.equal(o.i, 1); assert.equal(o.fleche, '←'); assert.equal(o.salles, 1); // 10 % de 200 px = 20 px = 1 salle
  const o2 = plusProche(plan, j, new Set([1]), dim, estOeuf);
  assert.equal(o2.i, 0);
  assert.equal(plusProche(plan, j, new Set([0, 1]), dim, estOeuf), null);
  assert.equal(plusProche(plan, j, new Set(), dim, estCle).i, 2);
  assert.equal(plusProche(plan, null, new Set(), dim, estOeuf), null);
});
