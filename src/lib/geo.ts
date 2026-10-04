import type { BL, LatLng } from './types';

/* ---------- Zufall / Rauschen (deterministisch) ---------- */

export function hash32(...nums: number[]): number {
  let h = 2166136261 >>> 0;
  for (const n of nums) {
    let x = Math.floor(n) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = x ^ (x >>> 16);
    h = Math.imul(h ^ x, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

export function rngFrom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export function valueNoise(x: number, y: number, seed = 1): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const v = (a: number, b: number) => hash32(a, b, seed) / 4294967296;
  const a = v(ix, iy);
  const b = v(ix + 1, iy);
  const c = v(ix, iy + 1);
  const d = v(ix + 1, iy + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

/** Fraktales Rauschen im Bereich ca. [-1, 1] */
export function fbm(x: number, y: number, seed = 1): number {
  let amp = 1;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < 3; o++) {
    sum += (valueNoise(x * f, y * f, seed + o * 17) * 2 - 1) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return sum / norm;
}

/* ---------- Projektion (lokal, ausreichend für Deutschland) ---------- */

export const KM_PER_DEG_LAT = 111.32;
/** Globale, feste Näherung (cos 51° · 111,32 km), damit das Raster überall konsistent ist */
export const KM_PER_DEG_LON = 70.0;

export const toKm = (lat: number, lon: number): [number, number] => [lon * KM_PER_DEG_LON, lat * KM_PER_DEG_LAT];
export const fromKm = (x: number, y: number): LatLng => [y / KM_PER_DEG_LAT, x / KM_PER_DEG_LON];

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function ringAreaHa(ring: LatLng[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = toKm(ring[i][0], ring[i][1]);
    const [x2, y2] = toKm(ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1]);
    sum += x1 * y2 - x2 * y1;
  }
  return (Math.abs(sum) / 2) * 100; // km² -> ha
}

export function ringCentroid(ring: LatLng[]): LatLng {
  let lat = 0;
  let lon = 0;
  for (const p of ring) {
    lat += p[0];
    lon += p[1];
  }
  return [lat / ring.length, lon / ring.length];
}

export function pointInRing(lat: number, lon: number, ring: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ---------- Deutschland (grobe Umrisse, Prototyp) ---------- */

export const GERMANY_OUTLINE: LatLng[] = [
  [55.05, 8.4], [54.9, 8.65], [54.8, 9.4], [54.8, 9.95], [54.55, 10.05], [54.45, 10.2], [54.45, 11.2],
  [54.0, 10.9], [54.1, 11.6], [54.18, 12.1], [54.45, 12.5], [54.7, 13.4], [54.05, 14.25], [53.9, 14.3],
  [53.55, 14.3], [52.9, 14.4], [52.35, 14.55], [51.9, 14.7], [51.45, 15.0], [51.05, 15.0], [50.85, 14.8],
  [50.9, 14.3], [50.6, 13.9], [50.4, 12.5], [50.25, 12.1], [49.7, 12.5], [49.0, 13.8], [48.75, 13.8],
  [48.55, 13.8], [48.2, 13.0], [47.5, 13.0], [47.55, 12.2], [47.4, 11.0], [47.55, 10.2], [47.55, 9.65],
  [47.6, 8.8], [47.6, 7.6], [48.0, 7.55], [49.0, 8.2], [49.15, 7.0], [49.4, 6.4], [49.8, 6.3],
  [50.4, 6.2], [50.8, 6.0], [51.5, 6.2], [52.0, 6.9], [52.5, 7.05], [53.2, 7.2], [53.3, 7.2],
  [53.55, 6.7], [53.7, 7.3], [53.7, 8.0], [53.9, 8.7], [54.3, 8.85],
];

export function inGermany(lat: number, lon: number): boolean {
  if (lat < 47.2 || lat > 55.1 || lon < 5.8 || lon > 15.1) return false;
  return pointInRing(lat, lon, GERMANY_OUTLINE);
}

/* ---------- Bundesländer (Näherung per gewichtetem Nächste-Zentrum) ---------- */

export const BUNDESLAENDER: Record<BL, { name: string; center: LatLng; weight: number }> = {
  SH: { name: 'Schleswig-Holstein', center: [54.1, 9.8], weight: 0.9 },
  HH: { name: 'Hamburg', center: [53.55, 10.0], weight: 0.15 },
  NI: { name: 'Niedersachsen', center: [52.8, 9.3], weight: 1.25 },
  HB: { name: 'Bremen', center: [53.08, 8.8], weight: 0.12 },
  NW: { name: 'Nordrhein-Westfalen', center: [51.45, 7.5], weight: 1.0 },
  HE: { name: 'Hessen', center: [50.6, 9.0], weight: 0.9 },
  RP: { name: 'Rheinland-Pfalz', center: [49.9, 7.4], weight: 0.9 },
  SL: { name: 'Saarland', center: [49.4, 6.95], weight: 0.35 },
  BW: { name: 'Baden-Württemberg', center: [48.6, 9.0], weight: 1.0 },
  BY: { name: 'Bayern', center: [48.9, 11.5], weight: 1.3 },
  BE: { name: 'Berlin', center: [52.52, 13.4], weight: 0.2 },
  BB: { name: 'Brandenburg', center: [52.4, 13.4], weight: 1.1 },
  MV: { name: 'Mecklenburg-Vorpommern', center: [53.7, 12.7], weight: 1.1 },
  SN: { name: 'Sachsen', center: [51.0, 13.3], weight: 0.85 },
  ST: { name: 'Sachsen-Anhalt', center: [51.9, 11.7], weight: 0.9 },
  TH: { name: 'Thüringen', center: [50.9, 11.0], weight: 0.75 },
};

export function bundeslandAt(lat: number, lon: number): BL {
  let best: BL = 'NI';
  let bestD = Infinity;
  for (const [code, bl] of Object.entries(BUNDESLAENDER) as [BL, (typeof BUNDESLAENDER)[BL]][]) {
    const dx = (lon - bl.center[1]) * KM_PER_DEG_LON;
    const dy = (lat - bl.center[0]) * KM_PER_DEG_LAT;
    const d = Math.hypot(dx, dy) / bl.weight;
    if (d < bestD) {
      bestD = d;
      best = code;
    }
  }
  return best;
}

/* ---------- Orte (für Gemarkungsnamen & Suche) ---------- */

export const CITIES: { name: string; pos: LatLng }[] = [
  { name: 'Flensburg', pos: [54.78, 9.44] }, { name: 'Kiel', pos: [54.32, 10.14] }, { name: 'Lübeck', pos: [53.87, 10.69] },
  { name: 'Husum', pos: [54.48, 9.05] }, { name: 'Heide', pos: [54.2, 9.1] }, { name: 'Hamburg', pos: [53.55, 10.0] },
  { name: 'Bremen', pos: [53.08, 8.8] }, { name: 'Oldenburg', pos: [53.14, 8.21] }, { name: 'Emden', pos: [53.37, 7.2] },
  { name: 'Osnabrück', pos: [52.28, 8.04] }, { name: 'Lingen', pos: [52.52, 7.32] }, { name: 'Diepholz', pos: [52.6, 8.37] },
  { name: 'Hannover', pos: [52.37, 9.73] }, { name: 'Celle', pos: [52.62, 10.08] }, { name: 'Gifhorn', pos: [52.48, 10.55] },
  { name: 'Braunschweig', pos: [52.27, 10.52] }, { name: 'Münster', pos: [51.96, 7.63] }, { name: 'Bielefeld', pos: [52.02, 8.53] },
  { name: 'Dortmund', pos: [51.51, 7.47] }, { name: 'Köln', pos: [50.94, 6.96] }, { name: 'Aachen', pos: [50.78, 6.08] },
  { name: 'Kassel', pos: [51.31, 9.48] }, { name: 'Frankfurt am Main', pos: [50.11, 8.68] }, { name: 'Mainz', pos: [50.0, 8.27] },
  { name: 'Trier', pos: [49.75, 6.64] }, { name: 'Saarbrücken', pos: [49.24, 6.99] }, { name: 'Stuttgart', pos: [48.78, 9.18] },
  { name: 'Karlsruhe', pos: [49.01, 8.4] }, { name: 'Freiburg', pos: [47.99, 7.85] }, { name: 'Ulm', pos: [48.4, 9.99] },
  { name: 'Ravensburg', pos: [47.78, 9.61] }, { name: 'Würzburg', pos: [49.79, 9.95] }, { name: 'Nürnberg', pos: [49.45, 11.08] },
  { name: 'Regensburg', pos: [49.01, 12.1] }, { name: 'Ingolstadt', pos: [48.76, 11.42] }, { name: 'München', pos: [48.14, 11.58] },
  { name: 'Rosenheim', pos: [47.86, 12.12] }, { name: 'Passau', pos: [48.57, 13.46] }, { name: 'Garmisch-Partenkirchen', pos: [47.49, 11.1] },
  { name: 'Erfurt', pos: [50.98, 11.03] }, { name: 'Jena', pos: [50.93, 11.59] }, { name: 'Leipzig', pos: [51.34, 12.37] },
  { name: 'Dresden', pos: [51.05, 13.74] }, { name: 'Chemnitz', pos: [50.83, 12.92] }, { name: 'Magdeburg', pos: [52.12, 11.63] },
  { name: 'Halle (Saale)', pos: [51.48, 11.97] }, { name: 'Stendal', pos: [52.6, 11.86] }, { name: 'Berlin', pos: [52.52, 13.4] },
  { name: 'Potsdam', pos: [52.4, 13.06] }, { name: 'Cottbus', pos: [51.76, 14.33] }, { name: 'Neuruppin', pos: [52.93, 12.8] },
  { name: 'Frankfurt (Oder)', pos: [52.35, 14.55] }, { name: 'Schwerin', pos: [53.63, 11.41] }, { name: 'Rostock', pos: [54.09, 12.14] },
  { name: 'Greifswald', pos: [54.09, 13.38] }, { name: 'Neubrandenburg', pos: [53.56, 13.26] }, { name: 'Waren (Müritz)', pos: [53.52, 12.68] },
  { name: 'Stralsund', pos: [54.31, 13.09] }, { name: 'Anklam', pos: [53.86, 13.69] },
];

export function nearestCity(p: LatLng) {
  let best = CITIES[0];
  let bd = Infinity;
  for (const c of CITIES) {
    const d = haversineKm(p, c.pos);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return { name: best.name, distKm: bd };
}
