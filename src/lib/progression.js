// Logique pure du suivi de progression (montée de niveau du camping-car).
// Aucune dépendance React : testable avec `npm test`.

export const MAX_HISTORY = 20;

// Anciens champs de niveaux.json (niveaux 2 à 6) → noms de ressources.
const LEGACY_FIELDS = {
  bois: 'Bloc de bois',
  sable: 'Sable minéral',
  argile: 'Argile',
};

export const PIECES = 'Pièces de logis';

/** Besoins pour monter d'un niveau précis (null si le niveau n'existe pas). */
export function levelRequirements(niveaux, level) {
  const row = niveaux.find((n) => n.niveau === level);
  if (!row) return null;
  const items = {};
  for (const [field, name] of Object.entries(LEGACY_FIELDS)) {
    if (row[field] > 0) items[name] = (items[name] || 0) + row[field];
  }
  for (const m of row.materiaux || []) {
    items[m.nom] = (items[m.nom] || 0) + m.qte;
  }
  return {
    level,
    pieces: row.pieces || 0,
    items,
    dureeMin: row.dureeMin || 0,
    aniimo: row.aniimo || 0,
  };
}

/** Besoins cumulés pour passer de `from` à `to` (niveaux from+1 … to). */
export function cumulativeRequirements(niveaux, from, to) {
  const total = { pieces: 0, items: {}, dureeMin: 0, aniimo: 0, levels: [] };
  for (let lvl = from + 1; lvl <= to; lvl++) {
    const r = levelRequirements(niveaux, lvl);
    if (!r) continue;
    total.pieces += r.pieces;
    total.dureeMin += r.dureeMin;
    total.aniimo = Math.max(total.aniimo, r.aniimo);
    total.levels.push(lvl);
    for (const [name, qty] of Object.entries(r.items)) {
      total.items[name] = (total.items[name] || 0) + qty;
    }
  }
  return total;
}

/**
 * Compare les besoins au stock.
 * stock : { [nom]: quantité } ; les pièces sont lues sous la clé PIECES.
 * Renvoie une ligne par ressource + le pourcentage global (le plus faible) et le goulot.
 */
export function computeProgress(requirements, stock = {}) {
  const needs = { [PIECES]: requirements.pieces, ...requirements.items };
  const rows = Object.entries(needs)
    .filter(([, needed]) => needed > 0)
    .map(([name, needed]) => {
      const have = Math.max(0, Number(stock[name]) || 0);
      const missing = Math.max(0, needed - have);
      const pct = Math.min(100, Math.floor((have / needed) * 100));
      return { name, needed, have, missing, pct };
    });
  const done = rows.every((r) => r.missing === 0);
  let bottleneck = null;
  for (const r of rows) {
    if (r.missing > 0 && (!bottleneck || r.pct < bottleneck.pct)) bottleneck = r;
  }
  const overallPct = rows.length === 0 ? 100 : Math.min(...rows.map((r) => r.pct));
  return { rows, done, overallPct, bottleneck: bottleneck ? bottleneck.name : null };
}

const norm = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Cadence de production (unités/h) d'une ressource, ou null si inconnue. */
export function rateFor(name, rates = {}) {
  if (name in rates) return rates[name];
  const target = norm(name);
  for (const [k, v] of Object.entries(rates)) {
    if (norm(k) === target) return v;
  }
  return null;
}

/** Heures nécessaires pour produire `missing` à `rate`/h (0 si rien ne manque, null si impossible). */
export function estimateHours(missing, rate) {
  if (missing <= 0) return 0;
  if (rate === null || rate === undefined || !(rate > 0)) return null;
  return missing / rate;
}

/** Délai total = ressource la plus lente ; `unknown` liste celles sans cadence exploitable. */
export function estimateTotal(rows, rates = {}) {
  let hours = 0;
  let slowest = null;
  const unknown = [];
  for (const r of rows) {
    if (r.missing <= 0) continue;
    const h = estimateHours(r.missing, rateFor(r.name, rates));
    if (h === null) {
      unknown.push(r.name);
    } else if (h > hours) {
      hours = h;
      slowest = r.name;
    }
  }
  return { hours, slowest, unknown };
}

export function formatDuration(hours) {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return '—';
  if (hours <= 0) return '0 min';
  const totalMin = Math.round(hours * 60);
  const days = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (days > 0) return `${days}j ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return `${m}min`;
}

/** Durée de construction en minutes → texte (le jeu l'exprime en 30 s, 5 min, 1 h 30…). */
export function formatBuildTime(minutes) {
  if (!(minutes > 0)) return '—';
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Ajoute le niveau à l'historique s'il diffère du dernier ; conserve MAX_HISTORY entrées. */
export function recordLevel(history, level, now = Date.now()) {
  const last = history[history.length - 1];
  if (last && last.level === level) return history;
  return [...history, { level, at: now }].slice(-MAX_HISTORY);
}

/** Retire du stock ce qu'a coûté la montée de niveau (sans passer sous 0). */
export function spendStock(stock, requirements) {
  const next = { ...stock };
  for (const [name, qty] of Object.entries(requirements.items)) {
    next[name] = Math.max(0, (Number(next[name]) || 0) - qty);
  }
  return next;
}
