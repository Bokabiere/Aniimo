import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PIECES, MAX_HISTORY, levelRequirements, cumulativeRequirements, computeProgress,
  rateFor, estimateHours, estimateTotal, formatDuration, formatBuildTime,
  recordLevel, spendStock,
} from '../src/lib/progression.js';

const NIVEAUX = JSON.parse(readFileSync(new URL('../src/data/niveaux.json', import.meta.url), 'utf8'));

test('levelRequirements : niveau 12 (pièces, matériaux, durée)', () => {
  const r = levelRequirements(NIVEAUX, 12);
  assert.equal(r.pieces, 1060000);
  assert.equal(r.aniimo, 32);
  assert.equal(r.dureeMin, 270);
  assert.deepEqual(r.items, { 'Planches standard': 910, 'Brique de minerai frittée': 480 });
});

test('levelRequirements : niveau 4 reprend bois et sable des anciens champs', () => {
  const r = levelRequirements(NIVEAUX, 4);
  assert.deepEqual(r.items, { 'Bloc de bois': 100, 'Sable minéral': 120 });
});

test('levelRequirements : niveau inexistant → null', () => {
  assert.equal(levelRequirements(NIVEAUX, 1), null);
  assert.equal(levelRequirements(NIVEAUX, 21), null);
});

test('cumulativeRequirements : additionne les niveaux de from+1 à to', () => {
  const c = cumulativeRequirements(NIVEAUX, 10, 12);
  assert.equal(c.pieces, 680000 + 1060000);
  assert.deepEqual(c.levels, [11, 12]);
  assert.equal(c.items['Planches standard'], 320 + 910);
  assert.equal(c.dureeMin, 240 + 270);
  assert.equal(c.aniimo, 32);
});

test('cumulativeRequirements : plage vide si to <= from', () => {
  const c = cumulativeRequirements(NIVEAUX, 12, 12);
  assert.equal(c.pieces, 0);
  assert.deepEqual(c.levels, []);
});

test('computeProgress : calcule manquant, pourcentage et goulot', () => {
  const req = levelRequirements(NIVEAUX, 12);
  const p = computeProgress(req, { [PIECES]: 530000, 'Planches standard': 910, 'Brique de minerai frittée': 120 });
  const byName = Object.fromEntries(p.rows.map((r) => [r.name, r]));
  assert.equal(byName[PIECES].pct, 50);
  assert.equal(byName[PIECES].missing, 530000);
  assert.equal(byName['Planches standard'].missing, 0);
  assert.equal(byName['Brique de minerai frittée'].pct, 25);
  assert.equal(p.overallPct, 25);
  assert.equal(p.bottleneck, 'Brique de minerai frittée');
  assert.equal(p.done, false);
});

test('computeProgress : le stock au-delà du besoin est plafonné à 100 %', () => {
  const p = computeProgress({ pieces: 100, items: {} }, { [PIECES]: 500 });
  assert.equal(p.rows[0].pct, 100);
  assert.equal(p.rows[0].missing, 0);
  assert.equal(p.done, true);
  assert.equal(p.bottleneck, null);
});

test('computeProgress : valeurs négatives ou invalides comptent pour 0', () => {
  const p = computeProgress({ pieces: 100, items: { Bois: 10 } }, { [PIECES]: -5, Bois: 'abc' });
  assert.equal(p.rows.every((r) => r.have === 0), true);
  assert.equal(p.overallPct, 0);
});

test('computeProgress : sans besoin → terminé', () => {
  const p = computeProgress({ pieces: 0, items: {} }, {});
  assert.equal(p.done, true);
  assert.equal(p.overallPct, 100);
});

test('rateFor : insensible à la casse et aux accents', () => {
  assert.equal(rateFor('Bloc de bois', { 'bloc de bois': 280 }), 280);
  assert.equal(rateFor('Minerai raffiné', { 'MINERAI RAFFINÉ': 3 }), 3);
  assert.equal(rateFor('Inconnu', { Bois: 1 }), null);
});

test('estimateHours : cas limites', () => {
  assert.equal(estimateHours(0, 0), 0);
  assert.equal(estimateHours(100, 50), 2);
  assert.equal(estimateHours(100, 0), null);
  assert.equal(estimateHours(100, -3), null);
  assert.equal(estimateHours(100, null), null);
});

test('estimateTotal : prend la ressource la plus lente et liste les inconnues', () => {
  const rows = [
    { name: PIECES, missing: 24000, needed: 24000, have: 0, pct: 0 },
    { name: 'Bloc de bois', missing: 280, needed: 280, have: 0, pct: 0 },
    { name: 'Rareté', missing: 5, needed: 5, have: 0, pct: 0 },
  ];
  const t = estimateTotal(rows, { [PIECES]: 1000, 'Bloc de bois': 280 });
  assert.equal(t.hours, 24);
  assert.equal(t.slowest, PIECES);
  assert.deepEqual(t.unknown, ['Rareté']);
});

test('formatDuration', () => {
  assert.equal(formatDuration(null), '—');
  assert.equal(formatDuration(Infinity), '—');
  assert.equal(formatDuration(0), '0 min');
  assert.equal(formatDuration(0.5), '30min');
  assert.equal(formatDuration(2.25), '2h 15min');
  assert.equal(formatDuration(44), '1j 20h');
});

test('formatBuildTime : durées de construction du jeu', () => {
  assert.equal(formatBuildTime(0.5), '30 s');
  assert.equal(formatBuildTime(5), '5 min');
  assert.equal(formatBuildTime(90), '1 h 30');
  assert.equal(formatBuildTime(720), '12 h');
  assert.equal(formatBuildTime(0), '—');
});

test('recordLevel : ignore un doublon, plafonne la taille', () => {
  let h = recordLevel([], 11, 1);
  h = recordLevel(h, 11, 2);
  assert.deepEqual(h, [{ level: 11, at: 1 }]);
  h = recordLevel(h, 12, 3);
  assert.equal(h.length, 2);
  let big = [];
  for (let i = 1; i <= MAX_HISTORY + 5; i++) big = recordLevel(big, i, i);
  assert.equal(big.length, MAX_HISTORY);
  assert.equal(big[big.length - 1].level, MAX_HISTORY + 5);
});

test('spendStock : déduit le coût sans passer sous zéro et sans muter', () => {
  const stock = { 'Planches standard': 1000, 'Brique de minerai frittée': 100 };
  const req = levelRequirements(NIVEAUX, 12);
  const next = spendStock(stock, req);
  assert.equal(next['Planches standard'], 90);
  assert.equal(next['Brique de minerai frittée'], 0);
  assert.equal(stock['Planches standard'], 1000);
});
