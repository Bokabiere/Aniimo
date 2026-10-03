import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filtrerRecettes, normaliser, profitParHeure, installations } from '../src/lib/recettes-liste.js';
import { formatCycle } from '../src/lib/format.js';

const RECETTES = JSON.parse(readFileSync(new URL('../src/data/recettes.json', import.meta.url), 'utf8'));

test('recherche : insensible aux accents et à la casse', () => {
  assert.equal(normaliser('Blé'), 'ble');
  const { liste } = filtrerRecettes(RECETTES, { recherche: 'ble' });
  assert.ok(liste.some((r) => r.nom.includes('Blé')));
});

test('recherche : trouve aussi par ingrédient', () => {
  const { liste } = filtrerRecettes(RECETTES, { recherche: 'bille de sucre' });
  assert.ok(liste.some((r) => r.nom === 'Tanghulu'));
});

test('filtre par installation', () => {
  const { liste } = filtrerRecettes(RECETTES, { structure: 'Moulin-carrousel' });
  assert.equal(liste.length, RECETTES.filter((r) => r.structure === 'Moulin-carrousel').length);
  assert.ok(liste.every((r) => r.structure === 'Moulin-carrousel'));
});

test('masquage des recettes verrouillées', () => {
  const limite = (s) => (s === 'Moulin-carrousel' ? 0 : 5);
  const { liste, masquees } = filtrerRecettes(RECETTES, { masquerVerrouillees: true, limite });
  assert.equal(masquees, RECETTES.filter((r) => r.structure === 'Moulin-carrousel').length);
  assert.ok(!liste.some((r) => r.structure === 'Moulin-carrousel'));
});

test('tri par profit horaire décroissant', () => {
  const { liste } = filtrerRecettes(RECETTES, { tri: 'profit' });
  for (let i = 1; i < liste.length; i++) assert.ok(profitParHeure(liste[i - 1]) >= profitParHeure(liste[i]));
});

test('tri par durée croissante', () => {
  const { liste } = filtrerRecettes(RECETTES, { tri: 'duree' });
  for (let i = 1; i < liste.length; i++) assert.ok(liste[i - 1].tempsMin <= liste[i].tempsMin);
});

test('installations : comptage', () => {
  const inst = installations(RECETTES);
  assert.equal(inst.reduce((t, i) => t + i.n, 0), RECETTES.length);
});

test('formatCycle', () => {
  assert.equal(formatCycle(0.57), '34 s');
  assert.equal(formatCycle(2.25), '2 min 15 s');
  assert.equal(formatCycle(40), '40 min');
  assert.equal(formatCycle(90), '1 h 30');
  assert.equal(formatCycle(0), '—');
});
