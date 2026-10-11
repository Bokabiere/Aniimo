import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparerRef, RAYON_DISQUE } from '../src/lib/localisation.js';
import { creerHypotheses, actualiserHypotheses, classerHypotheses, decision, elaguer, calibrerEchelle } from '../src/lib/suivi.js';

const TAILLE = 30;

/** Plan synthétique (réseau de salles et couloirs) ; `miroir` le retourne de gauche à droite pour en faire un plan « voisin ». */
function plan(miroir = false) {
  const w = 220, h = 160;
  const m = new Uint8Array(w * h);
  const rect = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + (miroir ? w - 1 - x : x)] = 1;
  };
  rect(10, 100, 40, 130);   // salle de départ
  rect(40, 112, 100, 120);  // couloir est
  rect(92, 40, 100, 120);   // couloir nord
  rect(70, 20, 130, 60);    // grande salle
  rect(130, 36, 200, 44);   // couloir est
  rect(190, 36, 200, 110);  // couloir sud
  rect(170, 100, 215, 145); // salle finale
  return { m, w, h, depart: miroir ? { x: w - 1 - 25, y: 115 } : { x: 25, y: 115 } };
}

const reference = (id, p) => ({ id, taille: TAILLE, depart: p.depart, refPad: preparerRef(p.m, p.w, p.h, Math.ceil(RAYON_DISQUE * TAILLE) + 2) });

/** Minimap vue depuis (cx, cy) du plan `p`, agrandie ×3 (joueur au centre d'une image 240×240). */
function minimap(p, cx, cy) {
  const S = 240, k = 3;
  const out = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const px = Math.floor(cx + (x - S / 2) / k), py = Math.floor(cy + (y - S / 2) / k);
    out[y * S + x] = px >= 0 && py >= 0 && px < p.w && py < p.h ? p.m[py * p.w + px] : 0;
  }
  return { plein: out, w: S, h: S };
}

const TRAJET = [[25, 115], [40, 115], [55, 116], [70, 116], [85, 116], [96, 105], [96, 85], [96, 65], [100, 45], [115, 40], [130, 40], [150, 40], [170, 40], [190, 45], [195, 65]];

test('suivi multi-hypothèses : le vrai plan est décidé, le plan voisin décroche', () => {
  const vrai = plan(false), voisin = plan(true);
  const refs = [reference('vrai', vrai), reference('voisin', voisin)];
  let hyps = creerHypotheses(refs);
  let courant = null;
  for (const [x, y] of TRAJET) {
    actualiserHypotheses(hyps, refs, minimap(vrai, x, y), { x: 120, y: 120 }, TAILLE * 3);
    hyps = elaguer(hyps);
    courant = decision(hyps, { courant });
  }
  assert.equal(courant, 'vrai');
  const c = classerHypotheses(hyps);
  assert.equal(c[0].id, 'vrai');
  assert.ok(c[0].score > 0.85);
  assert.ok(c[0].score - c[1].score > 0.1);
  // la position suivie est proche de la vraie (dernier point du trajet)
  const h = hyps.find((x) => x.id === 'vrai');
  assert.ok(Math.abs(h.pos.x - 195) <= 3 && Math.abs(h.pos.y - 65) <= 3, JSON.stringify(h.pos));
});

test('decision : pas de décision trop tôt, ni sans écart suffisant ; hystérésis sur le plan courant', () => {
  const hyps = [
    { id: 'a', score: 0.8, ticks: 2 }, { id: 'b', score: 0.5, ticks: 2 },
  ];
  assert.equal(decision(hyps), null); // minTicks non atteint
  hyps.forEach((h) => { h.ticks = 6; });
  assert.equal(decision(hyps), 'a');
  hyps[1].score = 0.78;
  assert.equal(decision(hyps), null);                 // écart < marge
  assert.equal(decision(hyps, { courant: 'a' }), 'a'); // courant conservé
  assert.equal(decision(hyps, { courant: 'b' }), 'b'); // b est à moins de marge/2 de a : conservé
  hyps[1].score = 0.6;
  assert.equal(decision(hyps, { courant: 'b' }), 'a'); // b décroche : on change
});

test('elaguer : écarte les hypothèses décrochées mais garde un minimum', () => {
  const hyps = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, score: 0.9 - i * 0.2, ticks: 10 }));
  assert.deepEqual(elaguer(hyps).map((h) => h.id), ['a', 'b', 'c']);
  assert.equal(elaguer(hyps, { garder: 1, ecart: 0.1 }).length, 1);
  const jeunes = hyps.map((h) => ({ ...h, ticks: 2 }));
  assert.equal(elaguer(jeunes).length, 5); // trop tôt pour écarter
});

test('suivi : précision de la position malgré une échelle de minimap mal estimée (+6 %)', () => {
  const vrai = plan(false);
  const refs = [reference('vrai', vrai)];
  const hyps = creerHypotheses(refs);
  const erreurs = [];
  for (const [x, y] of TRAJET) {
    actualiserHypotheses(hyps, refs, minimap(vrai, x, y), { x: 120, y: 120 }, TAILLE * 3 * 1.06);
    erreurs.push(Math.hypot(hyps[0].pos.x - x, hyps[0].pos.y - y));
  }
  erreurs.sort((a, b) => a - b);
  // Dans un couloir rectiligne la position reste ambiguë le long de l'axe (rien à recaler) : on tolère quelques écarts isolés.
  assert.ok(erreurs[Math.floor(erreurs.length / 2)] <= 1, `médiane ${erreurs[Math.floor(erreurs.length / 2)]}`);
  assert.ok(erreurs[erreurs.length - 1] <= 8, `max ${erreurs[erreurs.length - 1]}`);
  assert.ok(Math.abs(hyps[0].facteur - 1.06) < 0.05, `facteur ${hyps[0].facteur}`);
});

test('calibrerEchelle : retrouve la taille de la salle de départ dans la minimap à partir d\'une position connue', () => {
  const vrai = plan(false);
  const r = reference('vrai', vrai);
  const res = calibrerEchelle({ pos: { x: 96, y: 112 } }, r, minimap(vrai, 96, 112), { x: 120, y: 120 });
  assert.ok(res, 'aucune échelle trouvée');
  assert.ok(Math.abs(res.taille - TAILLE * 3) / (TAILLE * 3) < 0.08, `taille ${res.taille}`);
});

test('suivi : perdu, le plan validé est retrouvé sur tout le plan (globalPour)', () => {
  const vrai = plan(false);
  const refs = [reference('vrai', vrai)];
  const hyps = [{ id: 'vrai', pos: { x: 25, y: 115 }, score: 0.8, corr: 0, ticks: 10, perdus: 5 }];
  actualiserHypotheses(hyps, refs, minimap(vrai, 150, 40), { x: 120, y: 120 }, TAILLE * 3, { globalPour: 'vrai' });
  assert.ok(Math.hypot(hyps[0].pos.x - 150, hyps[0].pos.y - 40) <= 3, JSON.stringify(hyps[0].pos));
  assert.equal(hyps[0].perdus, 0);
});
