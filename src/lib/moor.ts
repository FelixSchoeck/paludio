import type { BL, LatLng, MoorType } from './types';
import { fbm, KM_PER_DEG_LAT, KM_PER_DEG_LON } from './geo';
import { kulisseAt, kulisseCovers } from './kulisse';

/**
 * Prototyp-Bodenmodell für Moorböden in Deutschland.
 *
 * Es bildet bekannte Moorlandschaften als organische Böden mit unregelmäßigen Rändern nach.
 * In der Produktivversion wird diese Schicht durch die "Aktualisierte Kulisse der organischen Böden"
 * (Thünen-Institut) bzw. die Moorbodenkarten der Länder ersetzt (siehe README, Abschnitt Datenanbindung).
 */
export interface MoorRegion {
  id: string;
  name: string;
  bl: BL;
  center: LatLng;
  /** Halbachsen in km */
  rx: number;
  ry: number;
  /** Rotation in Grad */
  rot: number;
  type: MoorType;
  peatMaxCm: number;
  /** geschätztes sommerliches Wasserdefizit (mm) – steuert Wasserbedarf & Ertragsrisiko */
  summerDeficitMm: number;
  gemeinden: string[];
  note: string;
}

export const MOOR_REGIONS: MoorRegion[] = [
  { id: 'donaumoos', name: 'Donaumoos', bl: 'BY', center: [48.69, 11.2], rx: 11, ry: 6, rot: -20, type: 'niedermoor', peatMaxCm: 220, summerDeficitMm: 60, gemeinden: ['Karlshuld', 'Neuburg a. d. Donau', 'Königsmoos', 'Karlskron'], note: 'Größtes Niedermoor Süddeutschlands, stark entwässert.' },
  { id: 'dachauer', name: 'Dachauer Moos', bl: 'BY', center: [48.31, 11.43], rx: 9, ry: 3.5, rot: 10, type: 'niedermoor', peatMaxCm: 150, summerDeficitMm: 50, gemeinden: ['Dachau', 'Karlsfeld', 'Haimhausen'], note: 'Niedermoor nördlich von München.' },
  { id: 'erdinger', name: 'Erdinger Moos', bl: 'BY', center: [48.33, 11.85], rx: 8, ry: 4, rot: 0, type: 'niedermoor', peatMaxCm: 120, summerDeficitMm: 50, gemeinden: ['Erding', 'Oberding', 'Freising'], note: 'Niedermoor im Münchner Norden.' },
  { id: 'murnau', name: 'Murnauer Moos', bl: 'BY', center: [47.66, 11.18], rx: 4.5, ry: 3, rot: 25, type: 'niedermoor', peatMaxCm: 300, summerDeficitMm: -80, gemeinden: ['Murnau', 'Eschenlohe', 'Ohlstadt'], note: 'Alpenvorland, hohe Niederschläge.' },
  { id: 'federsee', name: 'Federseemoor (Amtlich BW)', bl: 'BW', center: [48.053, 9.585], rx: 9, ry: 7, rot: 30, type: 'niedermoor', peatMaxCm: 350, summerDeficitMm: -40, gemeinden: ['Bad Buchau', 'Kanzach', 'Moosburg'], note: 'Oberschwäbisches Federseemoor – 100% amtliche Kataster-Flurstücke LGL BW.' },
  { id: 'wurzach', name: 'Wurzacher Ried (Amtlich BW)', bl: 'BW', center: [47.901, 9.895], rx: 8, ry: 6, rot: 25, type: 'hochmoor', peatMaxCm: 380, summerDeficitMm: -50, gemeinden: ['Bad Wurzach'], note: 'Größtes intaktes Hochmoor Mitteleuropas – 100% amtliche Kataster-Flurstücke LGL BW.' },
  { id: 'pfrungen', name: 'Pfrunger-Burgweiler Ried (Amtlich BW)', bl: 'BW', center: [47.884, 9.398], rx: 8, ry: 5, rot: 15, type: 'niedermoor', peatMaxCm: 320, summerDeficitMm: -30, gemeinden: ['Ostrach', 'Wilhelmsdorf'], note: 'Zweitgrößtes Moor Südwestdeutschlands – 100% amtliche Kataster-Flurstücke LGL BW.' },
  { id: 'diepholz', name: 'Diepholzer Moorniederung', bl: 'NI', center: [52.58, 8.35], rx: 14, ry: 10, rot: 10, type: 'hochmoor', peatMaxCm: 350, summerDeficitMm: 40, gemeinden: ['Diepholz', 'Barnstorf', 'Rehden', 'Lemförde'], note: 'Großes Hochmoorgebiet mit Torfabbau-Geschichte.' },
  { id: 'teufelsmoor', name: 'Teufelsmoor / Hammeniederung', bl: 'NI', center: [53.24, 8.98], rx: 12, ry: 8, rot: -15, type: 'niedermoor', peatMaxCm: 260, summerDeficitMm: 20, gemeinden: ['Worpswede', 'Osterholz-Scharmbeck', 'Grasberg'], note: 'Niedermoor-/Hochmoor-Mosaik, Grünlandnutzung.' },
  { id: 'emsland', name: 'Bourtanger Moor / Emsland', bl: 'NI', center: [52.85, 7.4], rx: 20, ry: 11, rot: 70, type: 'hochmoor', peatMaxCm: 300, summerDeficitMm: 40, gemeinden: ['Meppen', 'Haren', 'Papenburg', 'Twist'], note: 'Ehemals größtes zusammenhängendes Hochmoor Mitteleuropas.' },
  { id: 'ostfriesland', name: 'Ostfriesische Moore', bl: 'NI', center: [53.4, 7.65], rx: 14, ry: 9, rot: 20, type: 'hochmoor', peatMaxCm: 280, summerDeficitMm: 10, gemeinden: ['Aurich', 'Wiesmoor', 'Großefehn'], note: 'Hochmoor- und Niedermoorreste.' },
  { id: 'gifhorn', name: 'Großes Moor / Gifhorner Moore', bl: 'NI', center: [52.57, 10.5], rx: 9, ry: 7, rot: 0, type: 'hochmoor', peatMaxCm: 250, summerDeficitMm: 70, gemeinden: ['Gifhorn', 'Isenbüttel', 'Wesendorf'], note: 'Moore am Rand der Südheide.' },
  { id: 'droemling', name: 'Drömling', bl: 'NI', center: [52.5, 10.9], rx: 9, ry: 5, rot: -25, type: 'niedermoor', peatMaxCm: 180, summerDeficitMm: 90, gemeinden: ['Oebisfelde', 'Calvörde', 'Kunrau', 'Rühen'], note: 'Niedermoor im Grenzraum Niedersachsen/Sachsen-Anhalt.' },
  { id: 'eider', name: 'Eider-Treene-Sorge-Niederung', bl: 'SH', center: [54.3, 9.2], rx: 14, ry: 8, rot: 0, type: 'niedermoor', peatMaxCm: 250, summerDeficitMm: 0, gemeinden: ['Erfde', 'Friedrichstadt', 'Tönning', 'Bergenhusen'], note: 'Größte Niederungslandschaft Schleswig-Holsteins.' },
  { id: 'dithmarschen', name: 'Dithmarscher Moore', bl: 'SH', center: [54.15, 9.2], rx: 7, ry: 5, rot: 0, type: 'hochmoor', peatMaxCm: 300, summerDeficitMm: 0, gemeinden: ['Meldorf', 'Albersdorf', 'Wesselburen'], note: 'Moore der Geest-Marsch-Grenze.' },
  { id: 'altmark', name: 'Altmärkische Wische / Milde-Niederung', bl: 'ST', center: [52.85, 11.75], rx: 9, ry: 5, rot: -30, type: 'niedermoor', peatMaxCm: 150, summerDeficitMm: 100, gemeinden: ['Arneburg', 'Osterburg', 'Seehausen'], note: 'Elbnahe Niedermoore.' },
  { id: 'rhinluch', name: 'Rhin- & Havelländisches Luch', bl: 'BB', center: [52.72, 12.65], rx: 16, ry: 7, rot: 15, type: 'niedermoor', peatMaxCm: 200, summerDeficitMm: 140, gemeinden: ['Kremmen', 'Linum', 'Friesack', 'Fehrbellin'], note: 'Große Niedermoore, stark entwässert, trockener Osten.' },
  { id: 'spreewald', name: 'Spreewald / Unterspreewald', bl: 'BB', center: [51.9, 13.95], rx: 12, ry: 7, rot: 20, type: 'niedermoor', peatMaxCm: 150, summerDeficitMm: 150, gemeinden: ['Lübben', 'Straupitz', 'Golßen', 'Luckau'], note: 'Niedermoor in Flussniederung.' },
  { id: 'oderbruch', name: 'Oderbruch', bl: 'BB', center: [52.7, 14.2], rx: 11, ry: 5, rot: -30, type: 'niedermoor', peatMaxCm: 120, summerDeficitMm: 150, gemeinden: ['Bad Freienwalde', 'Letschin', 'Seelow'], note: 'Teilweise organische Böden.' },
  { id: 'peene', name: 'Peenetal', bl: 'MV', center: [53.9, 13.2], rx: 16, ry: 5, rot: 5, type: 'niedermoor', peatMaxCm: 320, summerDeficitMm: 60, gemeinden: ['Demmin', 'Loitz', 'Jarmen', 'Anklam'], note: 'Eines der größten Niedermoorgebiete Mitteleuropas.' },
  { id: 'trebel', name: 'Trebel- & Recknitztal', bl: 'MV', center: [54.0, 12.55], rx: 14, ry: 4.5, rot: 25, type: 'niedermoor', peatMaxCm: 280, summerDeficitMm: 60, gemeinden: ['Tribsees', 'Bad Sülze', 'Gnoien'], note: 'Flusstalmoore, Pionierregion Paludikultur.' },
  { id: 'friedland', name: 'Friedländer Große Wiese', bl: 'MV', center: [53.68, 13.65], rx: 9, ry: 6, rot: 0, type: 'niedermoor', peatMaxCm: 250, summerDeficitMm: 80, gemeinden: ['Friedland', 'Ferdinandshof', 'Altentreptow'], note: 'Großes Niedermoor, Pilotflächen für Paludikultur.' },
  { id: 'randow', name: 'Randow-Welse-Bruch', bl: 'BB', center: [53.25, 14.0], rx: 11, ry: 5, rot: 20, type: 'niedermoor', peatMaxCm: 180, summerDeficitMm: 110, gemeinden: ['Schwedt', 'Angermünde', 'Pasewalk'], note: 'Niedermoor im Nordosten Brandenburgs.' },
  { id: 'muritz', name: 'Müritz-Havel-Niederung', bl: 'MV', center: [53.4, 13.0], rx: 12, ry: 8, rot: -10, type: 'niedermoor', peatMaxCm: 220, summerDeficitMm: 80, gemeinden: ['Neustrelitz', 'Waren', 'Mirow'], note: 'Moorgürtel der Mecklenburgischen Seenplatte.' },
  { id: 'torfmoor', name: 'Moore im Wiehengebirgsvorland', bl: 'NW', center: [52.38, 8.75], rx: 6, ry: 4, rot: 0, type: 'hochmoor', peatMaxCm: 250, summerDeficitMm: 30, gemeinden: ['Hille', 'Rahden', 'Espelkamp'], note: 'Kleine Hochmoore in NRW.' },
];

export const regionById = (id: string | undefined) => MOOR_REGIONS.find((r) => r.id === id);

export interface SoilInfo {
  type: MoorType;
  depthCm: number;
  regionId?: string;
  /** kulisse = Thünen-Kulisse; modell = Rückfallmodell ohne Kartengrundlage */
  source: 'kulisse' | 'modell';
  /** true, wenn die Torfmächtigkeit aus einer Klasse der Kulisse stammt */
  depthKnown: boolean;
  category?: string;
  categoryNote?: string;
  peatClass?: string;
}

const MINERAL: SoilInfo = { type: 'mineral', depthCm: 0, source: 'modell', depthKnown: false };

/**
 * Boden am Punkt. Grundlage ist die Thünen-Kulisse organischer Böden; nur wenn sie nicht geladen
 * werden konnte, greift das alte Regionenmodell (dann als „modell“ gekennzeichnet).
 */
export function soilAt(lat: number, lon: number): SoilInfo {
  const hit = kulisseAt(lat, lon);
  // Kachel nicht geladen bzw. Kulisse nicht verfügbar: Rückfallmodell (als „modell“ gekennzeichnet)
  if (hit === undefined) return modelSoilAt(lat, lon);
  if (hit === null) return { type: 'mineral', depthCm: 0, source: 'kulisse', depthKnown: true };
  const known = hit.peat.depthCm != null;
  return {
    type: hit.category.genese,
    // Unbekannte Mächtigkeit (TMX): vorsichtige Annahme, als Schätzung gekennzeichnet
    depthCm: hit.peat.depthCm ?? 70,
    regionId: nearestRegion([lat, lon]).id,
    source: 'kulisse',
    depthKnown: known,
    category: hit.category.label,
    categoryNote: hit.category.note,
    peatClass: `${hit.peat.code} (${hit.peat.label})`,
  };
}

// Vorberechnete Hüllrechtecke (km) für schnellen Ausschluss
const REGION_BOX = MOOR_REGIONS.map((r) => {
  const R = Math.max(r.rx, r.ry) * 1.5;
  const cx = r.center[1] * KM_PER_DEG_LON;
  const cy = r.center[0] * KM_PER_DEG_LAT;
  return { minX: cx - R, maxX: cx + R, minY: cy - R, maxY: cy + R, cx, cy, cos: Math.cos((-r.rot * Math.PI) / 180), sin: Math.sin((-r.rot * Math.PI) / 180) };
});

/** Rückfallmodell: bekannte Moorgebiete als Ellipsen (keine Kartengrundlage) */
function modelSoilAt(lat: number, lon: number): SoilInfo {
  const x = lon * KM_PER_DEG_LON;
  const y = lat * KM_PER_DEG_LAT;
  let best: SoilInfo = MINERAL;
  for (let i = 0; i < MOOR_REGIONS.length; i++) {
    const b = REGION_BOX[i];
    if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
    const r = MOOR_REGIONS[i];
    const dx = x - b.cx;
    const dy = y - b.cy;
    const rx = dx * b.cos - dy * b.sin;
    const ry = dx * b.sin + dy * b.cos;
    const d = Math.hypot(rx / r.rx, ry / r.ry);
    const n = fbm(x / 2.6, y / 2.6, 7 + i) * 0.38;
    const v = d + n;
    if (v >= 1) continue;
    const depth = r.peatMaxCm * Math.pow(1 - v, 0.55) * (0.75 + 0.25 * (fbm(x / 0.9, y / 0.9, 31 + i) + 1) / 2);
    if (depth < 30) continue;
    if (!best.regionId || depth > best.depthCm) best = { type: r.type, depthCm: Math.round(depth / 5) * 5, regionId: r.id, source: 'modell', depthKnown: false };
  }
  return best;
}

function pointInRing(lat: number, lon: number, ring: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Boden eines Flurstücks: tastet die Fläche in einem Raster ab (bis ca. 100 Punkte) und nimmt die
 * vorherrschende Kategorie und Torfklasse der organischen Teilfläche.
 * `moorShare` = Anteil der Fläche mit organischem Boden laut Kulisse.
 */
export function soilForRing(ring: LatLng[], centroid: LatLng): SoilInfo & { moorShare: number } {
  let s = 90, n = -90, w = 180, e = -180;
  for (const [la, lo] of ring) { s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, lo); e = Math.max(e, lo); }
  // Ohne geladene Kulisse für diesen Ausschnitt: Rückfallmodell am Mittelpunkt
  if (ring.length < 3 || !kulisseCovers(s, w, n, e)) return { ...soilAt(centroid[0], centroid[1]), moorShare: 0 };
  const steps = 10;
  const samples: SoilInfo[] = [];
  let inside = 0;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const la = s + ((i + 0.5) / steps) * (n - s);
      const lo = w + ((j + 0.5) / steps) * (e - w);
      if (!pointInRing(la, lo, ring)) continue;
      inside++;
      const soil = soilAt(la, lo);
      if (soil.type !== 'mineral') samples.push(soil);
    }
  }
  if (!inside) return { ...soilAt(centroid[0], centroid[1]), moorShare: 0 };
  const moorShare = samples.length / inside;
  // Unter 50 % organischer Fläche gilt das Flurstück als Mineralboden
  if (moorShare < 0.5) return { type: 'mineral', depthCm: 0, source: 'kulisse', depthKnown: true, moorShare };
  const count = new Map<string, { n: number; soil: SoilInfo }>();
  for (const soil of samples) {
    const key = `${soil.category}|${soil.peatClass}`;
    const c = count.get(key);
    if (c) c.n++; else count.set(key, { n: 1, soil });
  }
  const dominant = [...count.values()].sort((a, b) => b.n - a.n)[0].soil;
  return { ...dominant, moorShare };
}

export function nearestRegion(p: LatLng): MoorRegion {
  let best = MOOR_REGIONS[0];
  let bd = Infinity;
  for (const r of MOOR_REGIONS) {
    const dx = (p[1] - r.center[1]) * KM_PER_DEG_LON;
    const dy = (p[0] - r.center[0]) * KM_PER_DEG_LAT;
    const d = Math.hypot(dx, dy) / Math.max(r.rx, r.ry);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best;
}

/** Grobe Abschätzung des Sommer-Wasserdefizits auch außerhalb von Moorregionen */
export function summerDeficitAt(p: LatLng): number {
  const r = nearestRegion(p);
  return r.summerDeficitMm;
}
