import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparerRef, RAYON_DISQUE } from '../src/lib/localisation.js';
import { creerFiltre, mettreAJourFiltre, extrapoler, qualiteCorrelation, TAU_EXTRAPOLATION } from '../src/lib/lissage.js';
import { creerHypotheses, actualiserHypotheses, classerHypotheses, decision, elaguer, CORR_MIN } from '../src/lib/suivi.js';
import { creerSuiviAsync } from '../src/lib/suivi-async.js';

// ---------- lissage : vitesse exposée, extrapolation, qualité ----------

test('extrapoler : dt nul = position inchangée, déplacement croissant mais borné à vitesse × tau', () => {
  const e = { x: 10, y: 20, vx: 40, vy: -20 };
  assert.deepEqual(extrapoler(e, 0), { x: 10, y: 20 });
  const a = extrapoler(e, 0.1), b = extrapoler(e, 0.5), c = extrapoler(e, 60);
  assert.ok(a.x > 10 && b.x > a.x && c.x > b.x);
  assert.ok(c.x <= 10 + 40 * TAU_EXTRAPOLATION + 1e-9 && c.y >= 20 - 20 * TAU_EXTRAPOLATION - 1e-9);
  assert.deepEqual(extrapoler({ x: 1, y: 2 }, 3), { x: 1, y: 2 }); // sans vitesse
  assert.equal(extrapoler(null, 1), null);
  assert.deepEqual(extrapoler(e, -1), { x: 10, y: 20 }); // dt négatif ignoré
});

test('qualiteCorrelation : 0 sous le seuil, 1 pour une corrélation parfaite, croissante', () => {
  assert.equal(qualiteCorrelation(0.3), 0);
  assert.equal(qualiteCorrelation(0.5), 0);
  assert.equal(qualiteCorrelation(1), 1);
  assert.ok(qualiteCorrelation(0.6) < qualiteCorrelation(0.8) && qualiteCorrelation(0.8) < qualiteCorrelation(0.95));
});

test('lissage : la vitesse est exposée et suit le mouvement', () => {
  const f = creerFiltre(30);
  let r;
  for (let k = 0; k < 30; k++) r = mettreAJourFiltre(f, { x: 100 + 30 * k * 0.1, y: 50, c: 0.9 }, k * 0.1);
  assert.ok(r.vx > 20 && r.vx < 40, `vx = ${r.vx}`);
  assert.ok(Math.abs(r.vy) < 3);
});

test('lissage : l\'amortissement de la vitesse sans mesure dépend du temps écoulé, pas du nombre d\'appels', () => {
  const prepare = () => {
    const f = creerFiltre(30);
    for (let k = 0; k < 30; k++) mettreAJourFiltre(f, { x: 100 + 30 * k * 0.1, y: 50, c: 0.9 }, k * 0.1);
    return f;
  };
  const t0 = 2.9;
  const lent = prepare(); // 1 appel de 0,4 s
  const rLent = mettreAJourFiltre(lent, null, t0 + 0.4);
  const rapide = prepare(); // 4 appels de 0,1 s
  let rRapide;
  for (let i = 1; i <= 4; i++) rRapide = mettreAJourFiltre(rapide, null, t0 + 0.1 * i);
  assert.ok(Math.abs(rLent.vx - rRapide.vx) < 0.5, `${rLent.vx} vs ${rRapide.vx}`);
  assert.ok(Math.abs(rLent.x - rRapide.x) < 1.5, `${rLent.x} vs ${rRapide.x}`);
});

// ---------- suivi : prédiction, mesures équivalentes, affinage allégé ----------

const TAILLE = 30;
function plan() {
  const w = 220, h = 160;
  const m = new Uint8Array(w * h);
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + x] = 1; };
  rect(10, 100, 40, 130); rect(40, 112, 100, 120); rect(92, 40, 100, 120); rect(70, 20, 130, 60);
  rect(130, 36, 200, 44); rect(190, 36, 200, 110); rect(170, 100, 215, 145);
  return { m, w, h, depart: { x: 25, y: 115 } };
}
const reference = (id, p) => ({ id, taille: TAILLE, depart: p.depart, refPad: preparerRef(p.m, p.w, p.h, Math.ceil(RAYON_DISQUE * TAILLE) + 2) });
function minimap(p, cx, cy) {
  const S = 240, k = 3;
  const out = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const px = Math.floor(cx + (x - S / 2) / k), py = Math.floor(cy + (y - S / 2) / k);
    out[y * S + x] = px >= 0 && py >= 0 && px < p.w && py < p.h ? p.m[py * p.w + px] : 0;
  }
  return { plein: out, w: S, h: S };
}

test('suivi à haute cadence : position juste, vitesse estimée, compteurs en mesures équivalentes', () => {
  const p = plan();
  const refs = [reference('vrai', p)];
  const hyps = creerHypotheses(refs);
  const dt = 0.1, v = 30; // joueur dans le couloir est : 30 px/s
  const n = 18;
  for (let k = 0; k < n; k++) {
    actualiserHypotheses(hyps, refs, minimap(p, 25 + v * dt * k, 115.5), { x: 120, y: 120 }, TAILLE * 3, { dt });
  }
  const h = hyps[0];
  assert.ok(Math.abs(h.pos.x - (25 + v * dt * (n - 1))) <= 3, JSON.stringify(h.pos));
  assert.ok(h.vx > 15 && h.vx < 45, `vx = ${h.vx}`);
  assert.equal(h.perdus, 0);
  // 18 mesures de 0,1 s = 1,8 s = 4,5 mesures de référence (0,4 s)
  assert.ok(Math.abs(h.ticks - n * dt / 0.4) < 0.01, `ticks = ${h.ticks}`);
});

test('suivi sans dt : comportement d\'origine (une mesure = un tick)', () => {
  const p = plan();
  const refs = [reference('vrai', p)];
  const hyps = creerHypotheses(refs);
  for (let k = 0; k < 5; k++) actualiserHypotheses(hyps, refs, minimap(p, 25, 115.5), { x: 120, y: 120 }, TAILLE * 3);
  assert.equal(hyps[0].ticks, 5);
  assert.equal(hyps[0].vx, 0);
});

test('suivi : joueur immobile, l\'échelle se stabilise puis n\'est plus affinée à chaque mesure, sans perdre en précision', () => {
  const p = plan();
  const refs = [reference('vrai', p)];
  const hyps = creerHypotheses(refs);
  const complet = creerHypotheses(refs);
  for (let k = 0; k < 12; k++) {
    actualiserHypotheses(hyps, refs, minimap(p, 25, 115.5), { x: 120, y: 120 }, TAILLE * 3, { dt: 0.1 });
    actualiserHypotheses(complet, refs, minimap(p, 25, 115.5), { x: 120, y: 120 }, TAILLE * 3, { dt: 0.1, affinerTous: true });
  }
  assert.ok(hyps[0].stables >= 4, `stables = ${hyps[0].stables}`);
  assert.ok(Math.hypot(hyps[0].pos.x - complet[0].pos.x, hyps[0].pos.y - complet[0].pos.y) < 1.5);
});

test('suivi à haute cadence : le vrai plan reste décidé, le plan voisin décroche', () => {
  const vrai = plan();
  const m2 = new Uint8Array(vrai.w * vrai.h);
  for (let y = 0; y < vrai.h; y++) for (let x = 0; x < vrai.w; x++) m2[y * vrai.w + x] = vrai.m[y * vrai.w + (vrai.w - 1 - x)];
  const voisin = { m: m2, w: vrai.w, h: vrai.h, depart: { x: vrai.w - 1 - 25, y: 115 } };
  const refs = [reference('vrai', vrai), reference('voisin', voisin)];
  let hyps = creerHypotheses(refs);
  let courant = null;
  const dt = 0.1;
  // couloir est, puis couloir nord : 30 px/s
  const trajet = [];
  for (let x = 25; x <= 96; x += 30 * dt) trajet.push([x, 116]);
  for (let y = 116; y >= 45; y -= 30 * dt) trajet.push([96, y]);
  for (const [x, y] of trajet) {
    actualiserHypotheses(hyps, refs, minimap(vrai, x, y), { x: 120, y: 120 }, TAILLE * 3, { dt });
    hyps = elaguer(hyps);
    courant = decision(hyps, { courant });
  }
  assert.equal(courant, 'vrai');
  assert.equal(classerHypotheses(hyps)[0].id, 'vrai');
});

// ---------- suivi asynchrone (worker) ----------

test('suivi-async : sans Worker, le résultat est celui du calcul sur place', async () => {
  const p = plan();
  const refs = [reference('vrai', p)];
  const a = creerHypotheses(refs), b = creerHypotheses(refs);
  const mm = minimap(p, 40, 115.5);
  const suivi = creerSuiviAsync();
  const maj = await suivi.actualiser(a, refs, mm, { x: 120, y: 120 }, TAILLE * 3, { dt: 0.1 });
  const attendu = actualiserHypotheses(b, refs, mm, { x: 120, y: 120 }, TAILLE * 3, { dt: 0.1 });
  assert.deepEqual(maj, attendu);
  suivi.fermer();
});

test('suivi.worker : répond à un message « actualiser » avec les hypothèses à jour', async () => {
  const sorties = [];
  globalThis.self = { postMessage: (m) => sorties.push(m) };
  await import('../src/lib/suivi.worker.js');
  const p = plan();
  const refs = [reference('vrai', p)];
  const mm = minimap(p, 40, 115.5);
  self.onmessage({ data: { type: 'refs', refs: refs.map((r) => ({ id: r.id, taille: r.taille, refPad: r.refPad })) } });
  self.onmessage({ data: { type: 'actualiser', id: 7, hyps: creerHypotheses(refs), mm, centre: { x: 120, y: 120 }, tailleMM: TAILLE * 3, options: { dt: 0.1 } } });
  assert.equal(sorties.length, 1);
  assert.equal(sorties[0].id, 7);
  assert.ok(sorties[0].hyps[0].corr >= CORR_MIN, `corr = ${sorties[0].hyps[0].corr}`);
  // erreur : renvoyée au lieu de planter le worker
  self.onmessage({ data: { type: 'actualiser', id: 8, hyps: null, mm, centre: { x: 0, y: 0 }, tailleMM: 1, options: {} } });
  assert.equal(sorties[1].id, 8);
  assert.ok(sorties[1].erreur);
  delete globalThis.self;
});
