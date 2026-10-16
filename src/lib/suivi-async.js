/**
 * Suivi des hypothèses hors du fil principal.
 * `creerSuiviAsync().actualiser(...)` a la même signature que `actualiserHypotheses` mais renvoie une promesse : le calcul se fait
 * dans un Web Worker (le fil principal reste libre pour l'affichage). Sans Worker (tests Node, navigateur ancien) ou si le worker
 * échoue, le calcul est fait sur place : le résultat est identique.
 * Contrairement à `actualiserHypotheses`, `hyps` n'est pas modifié : il faut utiliser le tableau renvoyé.
 */
import { actualiserHypotheses } from './suivi.js';

export function creerSuiviAsync() {
  let worker = null;
  let hs = typeof Worker === 'undefined'; // pas de Worker disponible : calcul sur place
  let refsEnvoyees = null;
  let seq = 0;
  const attente = new Map();

  const abandonner = () => {
    hs = true;
    if (worker) worker.terminate();
    worker = null;
    for (const { reject } of attente.values()) reject(new Error('worker indisponible'));
    attente.clear();
  };

  const demarrer = () => {
    if (hs) return null;
    if (worker) return worker;
    try {
      worker = new Worker(new URL('./suivi.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const a = attente.get(e.data.id);
        if (!a) return;
        attente.delete(e.data.id);
        if (e.data.erreur) a.reject(new Error(e.data.erreur)); else a.resolve(e.data.hyps);
      };
      worker.onerror = abandonner;
    } catch {
      abandonner();
    }
    return worker;
  };

  return {
    /** Même contrat que `actualiserHypotheses`, mais asynchrone ; renvoie les hypothèses à jour (tableau neuf avec le worker). */
    async actualiser(hyps, refs, mm, centre, tailleMM, options = {}) {
      const w = demarrer();
      if (w) {
        try {
          if (refsEnvoyees !== refs) {
            w.postMessage({ type: 'refs', refs: refs.map((r) => ({ id: r.id, taille: r.taille, refPad: r.refPad })) });
            refsEnvoyees = refs;
          }
          const id = ++seq;
          return await new Promise((resolve, reject) => {
            attente.set(id, { resolve, reject });
            w.postMessage({ type: 'actualiser', id, hyps, mm: { plein: mm.plein, w: mm.w, h: mm.h }, centre, tailleMM, options });
          });
        } catch {
          // worker en échec : on continue sur place (les hypothèses d'origine n'ont pas été modifiées, elles ont été copiées)
        }
      }
      return actualiserHypotheses(hyps, refs, mm, centre, tailleMM, options);
    },
    fermer() {
      if (worker) worker.terminate();
      worker = null; refsEnvoyees = null;
      for (const { reject } of attente.values()) reject(new Error('suivi fermé'));
      attente.clear();
    },
  };
}
