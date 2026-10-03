/** Durée d'un cycle (en minutes, éventuellement décimales) → « 34 s », « 2 min 15 s », « 40 min », « 1 h 30 ». */
export function formatCycle(minutes) {
  if (!(minutes > 0)) return '—';
  const totalSec = Math.round(minutes * 60);
  if (totalSec < 60) return `${totalSec} s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  return s ? `${m} min ${String(s).padStart(2, '0')} s` : `${m} min`;
}
