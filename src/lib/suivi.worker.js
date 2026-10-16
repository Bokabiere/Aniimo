/**
 * Web Worker du suivi : exécute `actualiserHypotheses` (recalage de la minimap, la partie la plus coûteuse) hors du fil principal,
 * pour que l'interface et l'animation du point restent fluides. Voir suivi-async.js.
 * Messages reçus : { type: 'refs', refs } (une fois, puis à chaque changement) et { type: 'actualiser', id, hyps, mm, centre, tailleMM, options }.
 * Réponse : { id, hyps } ou { id, erreur }.
 */
import { actualiserHypotheses } from './suivi.js';

let refs = [];

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'refs') { refs = m.refs; return; }
  if (m.type !== 'actualiser') return;
  try {
    const hyps = actualiserHypotheses(m.hyps, refs, m.mm, m.centre, m.tailleMM, m.options);
    self.postMessage({ id: m.id, hyps });
  } catch (err) {
    self.postMessage({ id: m.id, erreur: String((err && err.message) || err) });
  }
};
