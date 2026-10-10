import test from 'node:test';
import assert from 'node:assert/strict';
import RECETTES from '../src/data/recettes.json' with { type: 'json' };
import { sigle, categorie, blocsPlan, cadrePlan, legendePlan } from '../src/lib/plan-domaine.js';

const rec = [
  { id: 'a', nom: 'Champ Blé', structure: 'Ferme', w: 2, h: 2, tempsMin: 20, profit: 42 },
  { id: 'b', nom: 'Planches', structure: 'Établi de menuiserie', w: 3, h: 2, tempsMin: 30, profit: 0 },
];
const vide = () => Array.from({ length: 10 }, () => Array(10).fill(null));
function poser(g, r, c, id, w, h) {
  for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) g[r + i][c + j] = { id: `${id}${r}${c}`, rId: id, originR: r, originC: c };
}

test('sigle : connus, alias et repli par initiales', () => {
  assert.equal(sigle('Ferme'), 'F');
  assert.equal(sigle('Établi de menuiserie'), 'EM');
  assert.equal(sigle('Fournaise thermique'), 'Fo');
  assert.equal(sigle('Nouveau bâtiment rare'), 'NBR');
  assert.equal(sigle(''), '?');
});

test('chaque installation du jeu a une catégorie et un sigle non vide', () => {
  for (const s of new Set(RECETTES.map((r) => r.structure))) {
    assert.ok(categorie(s), s);
    assert.ok(sigle(s).length >= 1 && sigle(s).length <= 3, s);
  }
});

test('blocsPlan : une entrée par installation, dimensions et profit horaire', () => {
  const g = vide();
  poser(g, 2, 3, 'a', 2, 2);
  poser(g, 5, 0, 'b', 3, 2);
  const blocs = blocsPlan(g, rec);
  assert.equal(blocs.length, 2);
  const ferme = blocs.find((b) => b.structure === 'Ferme');
  assert.deepEqual([ferme.r, ferme.c, ferme.w, ferme.h], [2, 3, 2, 2]);
  assert.equal(ferme.profitH, 126);
  assert.equal(ferme.categorie, 'culture');
  assert.equal(blocs.find((b) => b.structure.startsWith('Établi')).profitH, 0);
});

test('blocsPlan : ignore les recettes inconnues et les grilles vides', () => {
  assert.deepEqual(blocsPlan(vide(), rec), []);
  const g = vide();
  poser(g, 0, 0, 'zzz', 1, 1);
  assert.deepEqual(blocsPlan(g, rec), []);
});

test('cadrePlan : zone occupée + marge, bornée à la grille', () => {
  const g = vide();
  poser(g, 2, 3, 'a', 2, 2);
  const blocs = blocsPlan(g, rec);
  assert.deepEqual(cadrePlan(blocs, 10), { r0: 1, c0: 2, lignes: 4, colonnes: 4 });
  assert.deepEqual(cadrePlan(blocs, 10, { tout: true }), { r0: 0, c0: 0, lignes: 10, colonnes: 10 });
  const coin = vide();
  poser(coin, 0, 0, 'a', 2, 2);
  assert.deepEqual(cadrePlan(blocsPlan(coin, rec), 10), { r0: 0, c0: 0, lignes: 3, colonnes: 3 });
  assert.deepEqual(cadrePlan([], 10), { r0: 0, c0: 0, lignes: 10, colonnes: 10 });
});

test('legendePlan : catégories présentes seulement, avec effectifs', () => {
  const g = vide();
  poser(g, 0, 0, 'a', 2, 2);
  poser(g, 0, 4, 'a', 2, 2);
  poser(g, 5, 0, 'b', 3, 2);
  const l = legendePlan(blocsPlan(g, rec));
  assert.deepEqual(l.map((x) => [x.id, x.nombre]), [['culture', 2], ['transformation', 1]]);
});
