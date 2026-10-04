import type { LandUse, LatLng, Parcel } from './types';
import {
  bundeslandAt, fbm, fromKm, hash32, inGermany, KM_PER_DEG_LAT, KM_PER_DEG_LON, nearestCity,
  ringAreaHa, ringCentroid, rngFrom, toKm,
} from './geo';
import { regionById, soilAt, type SoilInfo } from './moor';
import { BW_ALKIS_PARCELS, getBwAlkisParcelsInBounds, fetchLiveBwAlkisParcels } from './alkis_bw';

export { BW_ALKIS_PARCELS, fetchLiveBwAlkisParcels };

/**
 * Parzellen-Provider (Prototyp).
 *
 * Es gibt keinen bundesweiten Open-Data-Dienst für Flurstücke (ALKIS liegt bei den Ländern).
 * Dieser Provider erzeugt deshalb deterministisch eine realistisch wirkende Flurstücksstruktur für
 * ganz Deutschland. Die Schnittstelle `parcelsInBounds` kann später 1:1 durch Länder-WFS/ALKIS ersetzt werden.
 */

const cache = new Map<string, Parcel[]>();

const LAND_USE_LABEL: Record<LandUse, string> = {
  acker: 'Acker',
  gruenland_intensiv: 'Grünland (intensiv)',
  gruenland_extensiv: 'Grünland (extensiv)',
  brache: 'Brache / Sukzession',
};
export const landUseLabel = (l: LandUse) => LAND_USE_LABEL[l];

function pickLandUse(r: number, soil: SoilInfo): LandUse {
  if (soil.type === 'hochmoor') {
    if (r < 0.15) return 'acker';
    if (r < 0.55) return 'gruenland_intensiv';
    if (r < 0.8) return 'gruenland_extensiv';
    return 'brache';
  }
  if (r < 0.25) return 'acker';
  if (r < 0.7) return 'gruenland_intensiv';
  if (r < 0.9) return 'gruenland_extensiv';
  return 'brache';
}

function buildParcel(
  id: string, label: string, ring: LatLng[], gemarkung: string, seed: number, custom = false,
): Parcel {
  const centroid = ringCentroid(ring);
  const soil = soilAt(centroid[0], centroid[1]);
  const rnd = rngFrom(seed);
  const landUse = pickLandUse(rnd(), soil);
  let waterLevelCm = 0;
  if (soil.type !== 'mineral') {
    const base = { acker: 72, gruenland_intensiv: 52, gruenland_extensiv: 36, brache: 28 }[landUse];
    waterLevelCm = Math.round(base + (rnd() - 0.5) * 22);
  } else {
    waterLevelCm = Math.round(90 + rnd() * 80);
  }
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
  };
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
  // Pruefen ob der Ausschnitt Baden-Wuerttemberg beruehrt:
  const isBw = south <= 49.85 && north >= 47.50 && west <= 10.55 && east >= 7.45;
  const bwParcels = isBw ? getBwAlkisParcelsInBounds(south, west, north, east) : [];

  const [x1, y1] = toKm(south, west);
  const [x2, y2] = toKm(north, east);
  const i0 = Math.floor(x1);
  const i1 = Math.floor(x2);
  const j0 = Math.floor(y1);
  const j1 = Math.floor(y2);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > maxBlocks) return bwParcels;
  const res: Parcel[] = [...bwParcels];
  for (let I = i0; I <= i1; I++) for (let J = j0; J <= j1; J++) res.push(...superBlockParcels(I, J));
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
