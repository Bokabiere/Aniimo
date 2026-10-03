import test from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURE_UNLOCK_LEVELS, getLimitForStructure, getFirstUnlockLevel } from '../src/lib/structures.js';

// Paliers vérifiés le 2026-10-03 sur aniimotools.dev (pages stations).
const VERIFIED = {
  'Ferme': [1, 2, 5, 7, 9, 12, 16],
  'Pépinière': [2, 4, 7, 11, 14, 18],
  'Mine': [3, 6, 9, 12, 15, 18],
  'Établi de menuiserie': [6, 10, 14, 18],
  'Four de cheminée': [6, 10, 14, 18],
};

for (const [name, levels] of Object.entries(VERIFIED)) {
  test(`paliers de déblocage conformes à la source : ${name}`, () => {
    assert.deepEqual(STRUCTURE_UNLOCK_LEVELS[name], levels);
  });
}

test('tous les paliers sont croissants et dans 1..20', () => {
  for (const [name, levels] of Object.entries(STRUCTURE_UNLOCK_LEVELS)) {
    for (let i = 0; i < levels.length; i++) {
      assert.ok(levels[i] >= 1 && levels[i] <= 20, `${name}: ${levels[i]} hors plage`);
      if (i > 0) assert.ok(levels[i] > levels[i - 1], `${name}: palier non croissant`);
    }
  }
});

test('getLimitForStructure : nombre d\'exemplaires selon le niveau', () => {
  assert.equal(getLimitForStructure('Ferme', 1), 1);
  assert.equal(getLimitForStructure('Ferme', 2), 2);
  assert.equal(getLimitForStructure('Ferme', 4), 2);
  assert.equal(getLimitForStructure('Ferme', 5), 3);
  assert.equal(getLimitForStructure('Ferme', 20), 7);
  assert.equal(getLimitForStructure('Four de cheminée', 5), 0);
  assert.equal(getLimitForStructure('Four de cheminée', 6), 1);
  assert.equal(getLimitForStructure('Four de cheminée', 18), 4);
});

test('getLimitForStructure : insensible à la casse et aux espaces', () => {
  assert.equal(getLimitForStructure('  ferme ', 9), 5);
});

test('getLimitForStructure : alias reconnus', () => {
  assert.equal(getLimitForStructure('Bocal à pickles (variante)', 8), 1);
  assert.equal(getLimitForStructure('Four à cheminée', 6), 1);
  assert.equal(getLimitForStructure('Établi de menuiserie avancé', 10), 2);
});

test('getLimitForStructure : structure inconnue → repli ≥ 1', () => {
  assert.equal(getLimitForStructure('Structure fantôme', 1), 1);
  assert.equal(getLimitForStructure('Structure fantôme', 10), 5);
  assert.equal(getLimitForStructure('', 10), 1);
  assert.equal(getLimitForStructure(null, 10), 1);
});

test('getFirstUnlockLevel', () => {
  assert.equal(getFirstUnlockLevel('Mine'), 3);
  assert.equal(getFirstUnlockLevel('Climatisation'), 7);
  assert.equal(getFirstUnlockLevel('Structure fantôme'), 1);
  assert.equal(getFirstUnlockLevel(undefined), 1);
});
