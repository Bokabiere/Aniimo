import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerFiltre, mettreAJourFiltre, rayonMesure } from '../src/lib/lissage.js';

const bruit = (k) => ((k * 7919) % 13) / 13 - 0.5; // bruit déterministe dans [-0,5 ; 0,5[

test('lissage : le bruit de mesure est réduit', () => {
  const f = creerFiltre(30);
  let sErr = 0, sMes = 0, n = 0;
  for (let k = 0; k < 60; k++) {
    const vrai = { x: 100 + 12 * k * 0.2, y: 50 }; // 12 px/s, mesure toutes les 0,2 s
    const mes = { x: vrai.x + 8 * bruit(k), y: vrai.y + 8 * bruit(k + 5), c: 0.8 };
    const r = mettreAJourFiltre(f, mes, k * 0.2);
    if (k > 10) { sErr += Math.hypot(r.x - vrai.x, r.y - vrai.y); sMes += Math.hypot(mes.x - vrai.x, mes.y - vrai.y); n++; }
  }
  assert.ok(sErr / n < sMes / n, `lissé ${sErr / n} vs brut ${sMes / n}`);
});

test('lissage : sans mesure, la position avance (vitesse) et l\'incertitude grossit', () => {
  const f = creerFiltre(30);
  for (let k = 0; k < 20; k++) mettreAJourFiltre(f, { x: 100 + 20 * k * 0.2, y: 50, c: 0.95 }, k * 0.2);
  const avant = mettreAJourFiltre(f, { x: 100 + 20 * 19 * 0.2 + 4, y: 50, c: 0.95 }, 20 * 0.2);
  const apres = mettreAJourFiltre(f, null, 21 * 0.2);
  const plus = mettreAJourFiltre(f, null, 22 * 0.2);
  assert.ok(apres.x > avant.x - 1);
  assert.ok(plus.rayon > avant.rayon);
});

test('lissage : un saut (re-localisation) repart de la mesure', () => {
  const f = creerFiltre(30);
  for (let k = 0; k < 5; k++) mettreAJourFiltre(f, { x: 50, y: 50, c: 0.9 }, k * 0.2);
  const r = mettreAJourFiltre(f, { x: 300, y: 200, c: 0.9 }, 1.2);
  assert.equal(Math.round(r.x), 300);
  assert.equal(Math.round(r.y), 200);
});

test('rayonMesure : plus la corrélation est forte, plus le rayon est petit', () => {
  assert.ok(rayonMesure(1, 30) < rayonMesure(0.5, 30));
  assert.ok(rayonMesure(0.5, 30) < rayonMesure(0, 30));
});
