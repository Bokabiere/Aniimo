import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vitesse, niveauxAniimo, installationsGrille, affecter, affecterNaif, planOptimal } from '../src/lib/optimisation.js';

const lire = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'));
const DB = lire('aniimo_db.json');
const NIV = lire('aniimo_niveaux.json');

test('vitesse selon le niveau', () => {
  assert.equal(vitesse(0), 0);
  assert.equal(vitesse(1), 1);
  assert.equal(vitesse(3), 4);
  assert.equal(vitesse(9), 5);
});

test('niveaux relevés cohérents avec la base', () => {
  const noms = new Set(DB.map((a) => a.nom));
  for (const [nom, d] of Object.entries(NIV)) {
    assert.ok(noms.has(nom), nom);
    for (const n of Object.values(d)) assert.ok(n >= 1 && n <= 4, nom);
  }
});

test('sans relevé, les compétences sont à nivMax', () => {
  assert.deepEqual(niveauxAniimo({ nom: 'X', capacite: 'Porter', nivMax: 2, element: 'Feu', elements: ['Feu'] }, {}), { Feu: 2, Porter: 2 });
});

const A = (nom, el, cap) => ({ nom, capacite: cap, nivMax: 1, element: el, elements: [el], score: 1 });
const inst = (cle, piecesH, roles) => ({ cle, structure: cle, recette: cle, piecesH, roles });

test("l'optimum bat l'affectation naïve", () => {
  const db = [A('Fort', 'Feu', 'Aucune'), A('Faible', 'Feu', 'Aucune')];
  const niv = { Faible: { Feu: 1 }, Fort: { Feu: 3 } };
  const is = [inst('petit', 10, ['Feu']), inst('gros', 100, ['Feu'])];
  const opt = affecter(is, db, niv);
  assert.equal(opt.total, 100 * 4 + 10);
  assert.equal(opt.affectations.find((x) => x.installation.cle === 'gros').aniimo.nom, 'Fort');
  assert.equal(affecterNaif(is, db, niv), 10 * 4 + 100 * 1);
});

test('un Aniimo une seule fois, incompatible ignoré', () => {
  const db = [A('Feu1', 'Feu', 'Aucune')];
  const is = [inst('a', 10, ['Feu']), inst('b', 10, ['Feu']), inst('c', 50, ['Eau'])];
  const r = affecter(is, db, { Feu1: { Feu: 1 } });
  assert.equal(r.affectations.length, 1);
  assert.equal(r.total, 10);
});

test('plan : Aniimo à acquérir et gain', () => {
  const db = [A('Moi', 'Feu', 'Aucune'), A('Pro', 'Feu', 'Aucune')];
  const niv = { Moi: { Feu: 1 }, Pro: { Feu: 4 } };
  const p = planOptimal([inst('a', 10, ['Feu'])], db, ['Moi'], niv);
  assert.equal(p.total, 10);
  assert.equal(p.ideal, 50);
  assert.equal(p.acquerir.length, 1);
  assert.equal(p.acquerir[0].aniimo.nom, 'Pro');
  assert.equal(p.acquerir[0].gain, 40);
});

test('installationsGrille lit la grille', () => {
  const recettes = [{ id: 'r1', nom: 'Blé', structure: 'Ferme', profit: 30, tempsMin: 30 }];
  const roles = { Ferme: { elements: ['Plante'] } };
  const grid = [[{ rId: 'r1', originR: 0, originC: 0 }, { rId: 'r1', originR: 0, originC: 0 }]];
  const l = installationsGrille(grid, recettes, roles);
  assert.equal(l.length, 1);
  assert.equal(l[0].piecesH, 60);
});
