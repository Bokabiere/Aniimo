import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STRUCTURE_UNLOCK_LEVELS } from '../src/lib/structures.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'));
const RECETTES = load('recettes.json');
const ANIIMO = load('aniimo_db.json');
const ROLES = load('aniimo_roles.json');
const NIVEAUX = load('niveaux.json');
const GRAINES = load('graines_db.json');

const ELEMENTS = ['Feu', 'Eau', 'Plante', 'Terre', 'Vent', 'Foudre', 'Glace', 'Obscurité', 'Lumière'];
const CAPACITES = ['Porter', 'Artisanat', 'Loisir', 'Parfumerie'];

// ---------- recettes ----------
test('recettes : identifiants uniques', () => {
  const ids = RECETTES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('recettes : champs obligatoires et dimensions 1..5', () => {
  for (const r of RECETTES) {
    assert.ok(r.id && r.nom && r.structure, `${r.id}: id/nom/structure manquant`);
    assert.ok(Number.isInteger(r.w) && r.w >= 1 && r.w <= 5, `${r.id}: largeur invalide`);
    assert.ok(Number.isInteger(r.h) && r.h >= 1 && r.h <= 5, `${r.id}: hauteur invalide`);
    assert.ok(r.tempsMin > 0, `${r.id}: tempsMin <= 0`);
    assert.ok(r.profit >= 0, `${r.id}: profit négatif`);
    assert.equal(typeof r.input, 'object', `${r.id}: input manquant`);
  }
});

test('recettes : quantités entières positives en entrée et en sortie', () => {
  for (const r of RECETTES) {
    for (const [nom, q] of [...Object.entries(r.input), ...Object.entries(r.output || {})]) {
      assert.ok(Number.isFinite(q) && q > 0, `${r.id}: quantité invalide pour « ${nom} »`);
    }
  }
});

test('recettes : une sortie est requise, sauf pour les installations d\'aura ou de repos', () => {
  for (const r of RECETTES) {
    const sansSortie = !r.output || Object.keys(r.output).length === 0;
    if (sansSortie) {
      assert.ok(r.providesAura || ['Repos', 'Chaleur'].includes(r.capacite), `${r.id} « ${r.nom} » n'a aucune sortie`);
    }
  }
});

test('recettes : auras valides', () => {
  for (const r of RECETTES) {
    if (r.needsAura) assert.ok(['Frais', 'Chaud'].includes(r.needsAura), `${r.id}: needsAura « ${r.needsAura} »`);
    if (r.providesAura) {
      assert.ok(['Frais', 'Chaud'].includes(r.providesAura.type), `${r.id}: providesAura invalide`);
      assert.ok(r.providesAura.range > 0);
    }
  }
});

test('recettes : pas de doublon nom + structure', () => {
  const keys = RECETTES.map((r) => `${r.nom}|${r.structure}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('recettes : chaque structure a un palier de déblocage exact', () => {
  const known = new Set(Object.keys(STRUCTURE_UNLOCK_LEVELS).map((k) => k.toLowerCase()));
  const unknown = [...new Set(RECETTES.map((r) => r.structure))].filter((s) => !known.has(s.toLowerCase()));
  assert.deepEqual(unknown, []);
});

test('recettes : valeurs vérifiées en ligne le 2026-10-03', () => {
  const byId = Object.fromEntries(RECETTES.map((r) => [r.id, r]));
  assert.deepEqual(byId.r1.output, { Blé: 42 });
  assert.equal(byId.r1.tempsMin, 20);
  assert.deepEqual(byId.r2.output, { Fraise: 26 });
  assert.equal(byId.r2.tempsMin, 40);
  assert.deepEqual(byId.r4.output, { 'Pomme de terre': 46 });
  assert.equal(byId.r4.tempsMin, 40);
});

test('recettes : pas de gabarits (1×1, 30 min, profit 0) issus de l\'import automatique', () => {
  const gabarits = RECETTES.filter((r) => /^r\d{3}$/.test(r.id) && r.w === 1 && r.h === 1 && r.tempsMin === 30 && r.profit === 0 && r.structure !== 'Machine à Aniipod');
  assert.equal(gabarits.length, 0, `${gabarits.length} gabarits restants`);
});

test('recettes : structures sans rôle d\'Aniimo', { todo: '« Four à cheminée » double « Four de cheminée »' }, () => {
  const sansRole = [...new Set(RECETTES.map((r) => r.structure))].filter((s) => !ROLES[s]);
  assert.deepEqual(sansRole, ['Zone de coupe']);
});

// ---------- aniimo ----------
test('aniimo : noms uniques, capacité et élément valides', () => {
  assert.equal(new Set(ANIIMO.map((a) => a.nom)).size, ANIIMO.length);
  for (const a of ANIIMO) {
    assert.ok(CAPACITES.includes(a.capacite), `${a.nom}: capacité « ${a.capacite} »`);
    assert.ok(ELEMENTS.includes(a.element), `${a.nom}: élément « ${a.element} »`);
    assert.ok([3, 4].includes(a.nivMax), `${a.nom}: nivMax ${a.nivMax}`);
    assert.equal(a.score, a.nivMax, `${a.nom}: score ≠ nivMax`);
  }
});

test('aniimo : répartition des capacités conforme à la source (38 / 20 / 18 / 2)', () => {
  const count = (c) => ANIIMO.filter((a) => a.capacite === c).length;
  assert.deepEqual([count('Porter'), count('Artisanat'), count('Loisir'), count('Parfumerie')], [38, 20, 18, 2]);
});

test('aniimo : éléments corrigés le 2026-10-03', () => {
  const el = Object.fromEntries(ANIIMO.map((a) => [a.nom, a.element]));
  assert.equal(el.Bastiroc, 'Terre');
  assert.equal(el.Loufeuteau, 'Feu');
  assert.equal(el.Lunara, 'Lumière');
  assert.equal(el.Iris, 'Plante');
  assert.equal(el.Eko, 'Vent');
  assert.equal(el.Luminelle, 'Foudre');
});

test('rôles : chaque entrée est un élément ou une capacité connue', () => {
  const valides = [...ELEMENTS, ...CAPACITES.filter((c) => c !== 'Porter')];
  for (const [structure, role] of Object.entries(ROLES)) {
    for (const e of role.elements) assert.ok(valides.includes(e), `${structure}: « ${e} »`);
  }
});

// ---------- niveaux ----------
test('niveaux : de 2 à 20, sans trou, valeurs strictement croissantes', () => {
  assert.deepEqual(NIVEAUX.map((n) => n.niveau), Array.from({ length: 19 }, (_, i) => i + 2));
  for (let i = 1; i < NIVEAUX.length; i++) {
    assert.ok(NIVEAUX[i].aniimo > NIVEAUX[i - 1].aniimo, `niveau ${NIVEAUX[i].niveau}: aniimo`);
    assert.ok(NIVEAUX[i].pieces > NIVEAUX[i - 1].pieces, `niveau ${NIVEAUX[i].niveau}: pièces`);
    assert.ok(NIVEAUX[i].dureeMin > NIVEAUX[i - 1].dureeMin, `niveau ${NIVEAUX[i].niveau}: durée`);
  }
});

test('niveaux : matériaux détaillés de 7 à 20', () => {
  for (const n of NIVEAUX.filter((x) => x.niveau >= 7)) {
    assert.equal(n.materiaux?.length, 2, `niveau ${n.niveau}`);
    for (const m of n.materiaux) assert.ok(m.nom && m.qte > 0);
  }
});

test('niveaux : coût du niveau 20 vérifié en ligne (20 800 000)', () => {
  assert.equal(NIVEAUX.at(-1).pieces, 20800000);
});

// ---------- graines ----------
test('graines : champs complets et niveaux dans 1..20', () => {
  for (const g of GRAINES) {
    assert.ok(g.culture && g.graine && g.structure && g.raw_text);
    assert.ok(['Ferme', 'Pépinière'].includes(g.structure), `${g.culture}: structure`);
    assert.ok(Number.isInteger(g.niveau_requis) && g.niveau_requis >= 1 && g.niveau_requis <= 20);
    assert.ok(g.minutes > 0 && g.pieces > 0 && g.pieces_h > 0);
    assert.ok(g.bois_h >= 0);
  }
});

test('graines : un palier plus rentable ne se débloque pas plus tôt que le palier inférieur', () => {
  const parCulture = {};
  for (const g of GRAINES) (parCulture[`${g.culture}|${g.structure}`] ??= []).push(g);
  for (const [cle, lignes] of Object.entries(parCulture)) {
    const tri = [...lignes].sort((a, b) => a.pieces - b.pieces);
    for (let i = 1; i < tri.length; i++) {
      assert.ok(tri[i].niveau_requis >= tri[i - 1].niveau_requis, `${cle}: niveaux incohérents`);
    }
  }
});

test('graines : niveaux requis vérifiés en ligne le 2026-10-03', () => {
  const niveau = (prefixe) => GRAINES.find((g) => g.raw_text.startsWith(prefixe)).niveau_requis;
  assert.equal(niveau('Fraise×26'), 17);
  assert.equal(niveau('Fraise×8'), 9);
  assert.equal(niveau('Riz×79'), 12);
  assert.equal(niveau('Riz×18'), 5);
  assert.equal(niveau('Pomme de terre×46'), 8);
  assert.equal(niveau('Pomme de terre×2'), 2);
  assert.equal(niveau('Blé×42'), 3);
  assert.equal(niveau('Blé×5'), 1);
});

test('recettes : ingrédients conformes au relevé aniimotools.dev', () => {
  const txt = readFileSync(new URL('../scripts/reference/recettes_ingredients_site.txt', import.meta.url), 'utf8');
  let station = null;
  let verifiees = 0;
  const ecarts = [];
  for (const brut of txt.split(/\r?\n/)) {
    const l = brut.trim();
    if (l.startsWith('## ')) { station = l.slice(3); continue; }
    if (!l || l.startsWith('#')) continue;
    const [nom, ing] = l.split(' | ');
    const attendu = Object.fromEntries(ing.split(', ').map((a) => { const i = a.lastIndexOf('×'); return [a.slice(0, i), Number(a.slice(i + 1))]; }));
    const r = RECETTES.find((x) => x.structure === station && x.nom === nom);
    if (!r) { ecarts.push(`${station} / ${nom} : recette absente`); continue; }
    verifiees++;
    if (JSON.stringify(Object.entries(r.input).sort()) !== JSON.stringify(Object.entries(attendu).sort())) ecarts.push(`${r.id} ${nom}`);
  }
  assert.ok(verifiees >= 149, `${verifiees} recettes vérifiées`);
  assert.deepEqual(ecarts, []);
});
