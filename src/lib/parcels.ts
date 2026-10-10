import type { LandUse, LatLng, Parcel } from './types';
import {
  bundeslandAt, fbm, fromKm, hash32, inGermany, KM_PER_DEG_LAT, KM_PER_DEG_LON, nearestCity,
  ringAreaHa, ringCentroid, rngFrom, toKm,
} from './geo';
import { regionById, soilAt, soilForRing, type SoilInfo } from './moor';
import { BW_ALKIS_PARCELS } from './alkis_bw';
import { onKulisseLoaded } from './kulisse';

export { BW_ALKIS_PARCELS };

/**
 * Parzellen-Provider (Prototyp).
 *
 * Es gibt keinen bundesweiten Open-Data-Dienst für Flurstücke (ALKIS liegt bei den Ländern).
 * Für Baden-Württemberg lädt `alkis_live.ts` die amtlichen Flurstücke direkt vom LGL-WFS.
 * Für alle anderen Länder erzeugt dieser Provider deterministisch eine Flurstücksstruktur (Modell).
 */

const cache = new Map<string, Parcel[]>();
// Neu geladene Kulisse-Kacheln ändern die Bodenwerte – Modellflurstücke neu erzeugen
onKulisseLoaded(() => cache.clear());

const LAND_USE_LABEL: Record<LandUse, string> = {
  acker: 'Acker',
  gruenland_intensiv: 'Grünland (intensiv)',
  gruenland_extensiv: 'Grünland (extensiv)',
  brache: 'Brache / Sukzession',
};
export const landUseLabel = (l: LandUse) => LAND_USE_LABEL[l];


export function buildParcel(
  id: string, label: string, ring: LatLng[], gemarkung: string, seed: number, custom = false,
): Parcel {
  const centroid = ringCentroid(ring);
  const soil = soilForRing(ring, centroid);
  const rnd = rngFrom(seed);
  // Nutzung und Wasserstand sind ohne Angabe des Betriebs unbekannt; die Rechnung nutzt dann die Planannahme
  const landUse: LandUse = 'gruenland_intensiv';
  const waterLevelCm = soil.type === 'mineral' ? 0 : 50;
  const drainage = rnd() < 0.55 ? 'drainage' : rnd() < 0.85 ? 'graeben' : 'keine';
  return {
    id,
    label,
    ring,
    areaHa: Math.round(ringAreaHa(ring) * 100) / 100,
    centroid,
    bundesland: bundeslandAt(centroid[0], centroid[1]),
    gemarkung,
    moorType: soil.type,
    peatDepthCm: soil.depthCm,
    landUse,
    waterLevelCm,
    drainage: soil.type === 'mineral' ? 'drainage' : drainage,
    regionId: soil.regionId,
    custom,
    soilCategory: soil.category,
    peatClass: soil.peatClass,
    sources: {
      moor: soil.source,
      peat: soil.source === 'kulisse' && soil.depthKnown ? 'kulisse' : 'schaetzung',
      water: 'schaetzung',
      landUse: 'schaetzung',
    },
  };
}

const USER_SOURCES = new Set(['angabe', 'messung', 'gutachten', 'sammelantrag']);
export const isUserSource = (s?: string) => !!s && USER_SOURCES.has(s);
/** Wert beruht auf keiner Karte und keiner eigenen Angabe */
export const isEstimate = (s?: string) => !s || s === 'schaetzung' || s === 'modell';

/**
 * Leitet Moortyp und Torf eines vorhandenen Flurstücks neu aus der Kulisse ab.
 * Eigene Angaben (Messung, Gutachten …) bleiben unverändert.
 */
export function refreshSoil(p: Parcel): Parcel {
  const src = p.sources ?? { moor: 'schaetzung', peat: 'schaetzung', water: 'schaetzung', landUse: 'schaetzung' };
  const soil = soilForRing(p.ring, p.centroid);
  const next: Parcel = { ...p, sources: { ...src } };
  if (!isUserSource(src.moor)) {
    next.moorType = soil.type;
    next.soilCategory = soil.category;
    next.regionId = soil.regionId ?? p.regionId;
    next.sources!.moor = soil.source;
  }
  if (!isUserSource(src.peat)) {
    next.peatDepthCm = soil.depthCm;
    next.peatClass = soil.peatClass;
    next.sources!.peat = soil.source === 'kulisse' && soil.depthKnown ? 'kulisse' : 'schaetzung';
  }
  return next;
}

function rectRing(x: number, y: number, w: number, h: number): LatLng[] {
  return [fromKm(x, y), fromKm(x + w, y), fromKm(x + w, y + h), fromKm(x, y + h)];
}

function superBlockParcels(I: number, J: number): Parcel[] {
  const key = `${I}_${J}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out: Parcel[] = [];
  const rnd = rngFrom(hash32(I, J, 99));
  const cx = I + 0.5;
  const cy = J + 0.5;
  const [clat, clon] = fromKm(cx, cy);
  if (inGermany(clat, clon) || inGermany(...fromKm(I, J)) || inGermany(...fromKm(I + 1, J + 1))) {
    // Fuer Baden-Wuerttemberg werden die amtlichen ALKIS-Katasterdaten verwendet, keine Simulation
    if (bundeslandAt(clat, clon) === 'BW') {
      cache.set(key, []);
      return [];
    }

    const soilC = soilAt(clat, clon);
    const nonAgri = fbm(cx / 6, cy / 6, 555) > (soilC.type === 'mineral' ? 0.28 : 0.45);
    if (!nonAgri) {
      // Gemarkung
      let gemarkung: string;
      if (soilC.regionId) {
        const reg = regionById(soilC.regionId)!;
        gemarkung = reg.gemeinden[hash32(I >> 1, J >> 1) % reg.gemeinden.length];
      } else {
        const c = nearestCity([clat, clon]);
        gemarkung = c.distKm > 8 ? `${c.name}-Umland` : c.name;
      }
      const gemNr = 1000 + (hash32(...[...gemarkung].map((ch) => ch.charCodeAt(0))) % 8999);
      const flur = 1 + (hash32(I, J, 5) % 9);

      const mode = rnd();
      const rects: [number, number, number, number][] =
        mode < 0.35 ? [[0, 0, 1, 1]]
        : mode < 0.55 ? [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]]
        : mode < 0.75 ? [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]]
        : [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];

      let counter = 0;
      rects.forEach(([rx, ry, rw, rh], q) => {
        if (rnd() < 0.07) return; // Hof, Gehölz, Weg …
        const x0 = I + rx;
        const y0 = J + ry;
        const lengthwiseX = rw >= rh ? rnd() < 0.7 : rnd() < 0.3; // Streifen verlaufen entlang x?
        const longSide = lengthwiseX ? rw : rh;
        const shortSide = lengthwiseX ? rh : rw;
        const n = Math.max(1, Math.round((shortSide * 1000) / (45 + rnd() * 90)));
        const weights = Array.from({ length: n }, () => 0.6 + rnd() * 0.8);
        const sumW = weights.reduce((a, b) => a + b, 0);
        let off = 0;
        for (let s = 0; s < n; s++) {
          const wS = (weights[s] / sumW) * shortSide;
          const pieces: [number, number][] =
            longSide > 0.4 && rnd() < 0.4
              ? (() => {
                  const f = 0.3 + rnd() * 0.4;
                  return [[0, f * longSide], [f * longSide, (1 - f) * longSide]] as [number, number][];
                })()
              : [[0, longSide]];
          for (const [pOff, pLen] of pieces) {
            const px = lengthwiseX ? x0 + pOff : x0 + off;
            const py = lengthwiseX ? y0 + off : y0 + pOff;
            const pw = lengthwiseX ? pLen : wS;
            const ph = lengthwiseX ? wS : pLen;
            const ring = rectRing(px, py, pw, ph);
            const c = ringCentroid(ring);
            counter++;
            if (!inGermany(c[0], c[1])) continue;
            if (bundeslandAt(c[0], c[1]) === 'BW') continue;
            const zaehler = 1 + (hash32(I, J, q, counter) % 399);
            const nenner = hash32(I, J, counter, 3) % 4 === 0 ? 1 + (hash32(I, counter) % 9) : 0;
            const label = `${gemNr}-${flur}-${zaehler}${nenner ? '/' + nenner : ''}`;
            const id = `p_${I}_${J}_${q}_${counter}`;
            out.push(buildParcel(id, label, ring, gemarkung, hash32(I, J, q, counter, 77)));
          }
          off += wS;
        }
      });
    }
  }
  if (cache.size > 3000) cache.clear();
  cache.set(key, out);
  return out;
}

export function parcelsInBounds(south: number, west: number, north: number, east: number, maxBlocks = 220): Parcel[] {
  const [x1, y1] = toKm(south, west);
  const [x2, y2] = toKm(north, east);
  const i0 = Math.floor(x1);
  const i1 = Math.floor(x2);
  const j0 = Math.floor(y1);
  const j1 = Math.floor(y2);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > maxBlocks) return [];
  const res: Parcel[] = [];
  // Baden-Württemberg kommt live aus dem amtlichen LGL-Kataster (siehe alkis_live.ts)
  for (let I = i0; I <= i1; I++) for (let J = j0; J <= j1; J++) res.push(...superBlockParcels(I, J).filter((p) => p.bundesland !== 'BW'));
  return res;
}

export function makeCustomParcel(ring: LatLng[]): Parcel {
  const id = `c_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
  const c = ringCentroid(ring);
  const city = nearestCity(c);
  return buildParcel(id, 'Eigene Fläche', ring, `${city.name}-Umland`, hash32(Math.floor(c[0] * 1e4), Math.floor(c[1] * 1e4)), true);
}

/** Findet einen Moor-Flurstück-Cluster um eine Koordinate (für Demo-Daten oder Vorauswahl) */
export function findMoorParcels(center: LatLng, count: number, minHa = 3): Parcel[] {
  if (bundeslandAt(center[0], center[1]) === 'BW') {
    const bw = BW_ALKIS_PARCELS.filter((p) => p.areaHa >= minHa);
    bw.sort((a, b) => {
      const da = (a.centroid[0] - center[0]) ** 2 + ((a.centroid[1] - center[1]) * 0.63) ** 2;
      const db = (b.centroid[0] - center[0]) ** 2 + ((b.centroid[1] - center[1]) * 0.63) ** 2;
      return da - db;
    });
    return bw.slice(0, count);
  }
  const d = 0.02;
  const list = parcelsInBounds(center[0] - d, center[1] - d * 1.6, center[0] + d, center[1] + d * 1.6)
    .filter((p) => p.moorType !== 'mineral' && p.areaHa >= minHa);
  list.sort((a, b) => {
    const da = (a.centroid[0] - center[0]) ** 2 + ((a.centroid[1] - center[1]) * 0.63) ** 2;
    const db = (b.centroid[0] - center[0]) ** 2 + ((b.centroid[1] - center[1]) * 0.63) ** 2;
    return da - db;
  });
  return list.slice(0, count);
}

export { KM_PER_DEG_LAT, KM_PER_DEG_LON };
