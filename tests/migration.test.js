import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDS_MIGRES, migrerGrille, migrerBase, migrerPresets } from '../src/lib/migration.js';

const RECETTES = JSON.parse(readFileSync(new URL('../src/data/recettes.json', import.meta.url), 'utf8'));
const ids = new Set(RECETTES.map((r) => r.id));

test('les recettes migrées ne sont plus dans la base, leurs remplaçantes y sont', () => {
  for (const [ancien, cible] of Object.entries(IDS_MIGRES)) {
    assert.ok(!ids.has(ancien), ancien);
    if (cible) assert.ok(ids.has(cible), `${ancien} → ${cible}`);
  }
});

test('migrerGrille remplace ou retire les cases', () => {
  const g = [[{ rId: 'r10', originR: 0, originC: 0 }, { rId: 'r14', originR: 0, originC: 1 }, { rId: 'r5', originR: 0, originC: 2 }, null]];
  const m = migrerGrille(g);
  assert.equal(m[0][0].rId, 'r219');
  assert.equal(m[0][1], null);
  assert.equal(m[0][2].rId, 'r5');
});

test('migrerBase : remplacement unique, recettes perso conservées', () => {
  const defauts = [{ id: 'a', v: 2 }, { id: 'b', v: 1 }];
  const sauv = [{ id: 'a', v: 1 }, { id: 'r14' }, { id: 'perso', v: 9 }];
  const m = migrerBase(sauv, defauts, { remplacer: true });
  assert.deepEqual(m.map((r) => `${r.id}${r.v}`), ['a2', 'perso9', 'b1']);
  const m2 = migrerBase(sauv, defauts);
  assert.equal(m2.find((r) => r.id === 'a').v, 1);
});

test('migrerPresets migre chaque grille', () => {
  const p = migrerPresets([{ id: 'x', grid: [[{ rId: 'r10', originR: 0, originC: 0 }]] }]);
  assert.equal(p[0].grid[0][0].rId, 'r219');
});

test('recettes : ids uniques et plus de recette fantôme', () => {
  assert.equal(ids.size, RECETTES.length);
});
