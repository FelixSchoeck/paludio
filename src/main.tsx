import './style.css';
import { ensureKulisse, loadKulisse } from './lib/kulisse';

/** Ausschnitte, die vor dem Start geladen werden: Musterbetriebe und die eigenen Flächen */
function startAreas(): [number, number, number, number][] {
  const areas: [number, number, number, number][] = [
    [47.85, 9.35, 48.1, 9.95], // Musterbetrieb und Beispiel-Flurstücke Oberschwaben
    [53.15, 8.85, 53.32, 9.1], // Musterbetrieb Teufelsmoor
  ];
  try {
    const saved = JSON.parse(localStorage.getItem('paludio.prototype.v1') ?? 'null');
    const pts: [number, number][] = (saved?.myParcels ?? []).flatMap((p: { ring: [number, number][] }) => p.ring);
    if (pts.length) {
      const lats = pts.map((p) => p[0]);
      const lons = pts.map((p) => p[1]);
      areas.push([Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)]);
    }
  } catch {
    /* keine gespeicherten Flächen */
  }
  return areas;
}

// Die Moorbodenkarte (Thünen-Kulisse) wird vor dem App-Start geladen, damit alle Flächenwerte
// auf derselben Grundlage beruhen. Schlägt das Laden fehl, startet die App mit dem Rückfallmodell.
loadKulisse()
  .then(() => Promise.all(startAreas().map((a) => ensureKulisse(...a))))
  .catch(() => undefined)
  .finally(() => {
    import('./app').then((m) => m.mount());
  });
