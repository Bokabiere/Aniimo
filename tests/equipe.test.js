import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { competences, structuresPosees, besoinsGrille, couverture, suggererEquipe } from '../src/lib/equipe.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'));
const DB = load('aniimo_db.json');
const ROLES = load('aniimo_roles.json');
const RECETTES = load('recettes.json');

const cellule = (rId, r, c) => ({ rId, originR: r, originC: c });
const grilleVide = () => Array.from({ length: 10 }, () => Array(10).fill(null));

function grilleAvec(...recettesIds) {
  const g = grilleVide();
  recettesIds.forEach((id, i) => { g[0][i] = cellule(id, 0, i); });
  return g;
}
const idDe = (nom) => RECETTES.find((r) => r.nom === nom).id;

test('compétences : éléments multiples + capacité', () => {
  const g = DB.find((a) => a.nom === 'Givrotus');
  assert.deepEqual([...competences(g)].sort(), ['Eau', 'Glace', 'Porter']);
  const f = DB.find((a) => a.nom === 'Fabulle');
  assert.deepEqual([...competences(f)], ['Eau']);
});

test('structuresPosees : compte une case d\'origine par structure', () => {
  const g = grilleAvec(idDe('Tofu'), idDe('Farine complète'));
  g[1][0] = { rId: idDe('Tofu'), originR: 0, originC: 5 }; // case secondaire ignorée
  assert.deepEqual(structuresPosees(g, RECETTES), { 'Moulin-carrousel': 2 });
});

test('besoinsGrille : rôles de l\'installation + transport', () => {
  const b = besoinsGrille({ 'Moulin-carrousel': 2 }, ROLES);
  assert.deepEqual(b.map((x) => x.structure), ['Moulin-carrousel', 'Transport des récoltes']);
  assert.deepEqual(b[0].roles, ['Vent']);
  assert.deepEqual(besoinsGrille({}, ROLES), []);
});

test('couverture : un Aniimo Vent couvre le moulin ; un Aniimo Porter le transport', () => {
  const besoins = besoinsGrille({ 'Moulin-carrousel': 1 }, ROLES);
  const vent = DB.find((a) => a.element === 'Vent' && a.capacite === 'Porter').nom;
  const c = couverture([vent], besoins, DB);
  assert.ok(c.every((x) => x.couvert));
  const seul = couverture([DB.find((a) => a.element === 'Feu' && a.capacite === 'Aucune').nom], besoins, DB);
  assert.ok(seul.every((x) => !x.couvert));
});

test('suggererEquipe : couvre tout ce qui est faisable, sans doublon', () => {
  const posees = { 'Moulin-carrousel': 1, 'Cuisinière flamboyante': 1, 'Établi artisanal': 1, 'Ferme': 3 };
  const besoins = besoinsGrille(posees, ROLES);
  const sugg = suggererEquipe([], besoins, DB);
  const noms = sugg.map((s) => s.aniimo.nom);
  assert.equal(new Set(noms).size, noms.length);
  const apres = couverture(noms, besoins, DB);
  assert.ok(apres.every((x) => x.couvert), JSON.stringify(apres.filter((x) => !x.couvert)));
  assert.ok(sugg.length <= besoins.length);
});

test('suggererEquipe : rien à ajouter si l\'équipe couvre déjà tout', () => {
  const besoins = besoinsGrille({ 'Moulin-carrousel': 1 }, ROLES);
  const sugg = suggererEquipe([], besoins, DB);
  const complet = sugg.map((s) => s.aniimo.nom);
  assert.deepEqual(suggererEquipe(complet, besoins, DB), []);
});

test('besoinsGrille en ezMode : ateliers électriques tournent sans Aniimo et demandent 1 Foudre pour le Générateur', () => {
  const posees = { 'Moulin-carrousel': 1, 'Cuisinière flamboyante': 1, 'Ferme': 2 };
  const sansEz = besoinsGrille(posees, ROLES);
  assert.equal(sansEz.some((b) => b.structure === 'Moulin-carrousel'), true);
  assert.equal(sansEz.some((b) => b.structure === 'Cuisinière flamboyante'), true);

  const avecEz = besoinsGrille(posees, ROLES, { ezMode: true });
  assert.equal(avecEz.some((b) => b.structure === 'Moulin-carrousel'), false);
  assert.equal(avecEz.some((b) => b.structure === 'Cuisinière flamboyante'), false);
  assert.equal(avecEz.some((b) => b.structure === 'Ferme'), true);
  const gen = avecEz.find((b) => b.structure.includes('Générateur'));
  assert.ok(gen);
  assert.deepEqual(gen.roles, ['Foudre']);
  assert.equal(avecEz.some((b) => b.structure === 'Transport des récoltes'), true);
});
