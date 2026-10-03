import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prochaineAction, meilleureGraine } from '../src/lib/recommandation.js';
import { iconeProduit } from '../src/lib/icones.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'));
const NIVEAUX = load('niveaux.json');
const GRAINES = load('graines_db.json');
const base = { level: 5, pieces: 0, niveaux: NIVEAUX, graines: GRAINES, nbStructures: 3, profitHoraire: 1000 };

test('recommandation : grille vide → démarrer', () => {
  const a = prochaineAction({ ...base, nbStructures: 0 });
  assert.equal(a.id, 'demarrer');
  assert.equal(a.cta.tab, 'grille');
});

test('recommandation : aucune production → graines', () => {
  const a = prochaineAction({ ...base, profitHoraire: 0 });
  assert.equal(a.id, 'sans-production');
  assert.equal(a.cta.tab, 'graines');
});

test('recommandation : pièces suffisantes → prêt', () => {
  const a = prochaineAction({ ...base, pieces: 10_000_000 });
  assert.equal(a.id, 'pret');
});

test('recommandation : estimation du temps restant', () => {
  const a = prochaineAction({ ...base, pieces: 0 });
  assert.equal(a.id, 'epargner');
  assert.match(a.titre, /Niveau 6 dans/);
});

test('recommandation : niveau maximum', () => {
  const max = Math.max(...NIVEAUX.map((n) => n.niveau));
  assert.equal(prochaineAction({ ...base, level: max }).id, 'niveau-max');
});

test('recommandation : la meilleure graine respecte le niveau', () => {
  const g = meilleureGraine(GRAINES, 1);
  assert.ok((g.niveau_requis || 1) <= 1);
});

test('icônes : mots-clés, repli par structure, repli général', () => {
  assert.equal(iconeProduit('Fraise'), '🍓');
  assert.equal(iconeProduit('???', 'Mine'), '⛏️');
  assert.equal(iconeProduit('???'), '📋');
});

test('icônes : chaque recette a une icône', () => {
  const recettes = load('recettes.json');
  for (const r of recettes) assert.ok(iconeProduit(r.nom, r.structure), r.nom);
});
