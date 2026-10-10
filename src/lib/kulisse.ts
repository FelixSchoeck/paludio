/**
 * Thünen-Kulisse organischer Böden in Deutschland (2023) als Vektorkacheln.
 *
 * Quelle: Wittnebel, Frank, Tiemeyer (2023), Thünen Working Paper 212 (DOI 10.3220/WP1683180852000),
 *         Daten DOI 10.3220/DATA20230510130443-0, Lizenz CC BY 4.0.
 * Aufbereitung: scripts/build_kulisse.py → public/data/kulisse/{i}_{j}.bin.gz (Format KV1)
 *
 * Die Kacheln (0,1° × 0,15°) werden bei Bedarf geladen; Abfragen prüfen den Punkt gegen die Polygone.
 */

export interface KulisseCategory {
  label: string;
  genese: 'niedermoor' | 'hochmoor';
  /** Moorfolgeboden, überdeckt oder tiefumgebrochen – nur eingeschränkt wie Moor zu behandeln */
  note?: string;
}

export const KULISSE_CATEGORIES: Record<number, KulisseCategory> = {
  1: { label: 'Niedermoorboden', genese: 'niedermoor' },
  2: { label: 'Hochmoorboden', genese: 'hochmoor' },
  3: { label: 'Moorfolgeboden', genese: 'niedermoor', note: 'Stark degradierter, meist geringmächtiger Torf' },
  4: { label: 'Flach überdeckter Niedermoorboden', genese: 'niedermoor', note: 'Torf unter dünner Mineralbodendecke' },
  5: { label: 'Flach überdeckter Hochmoorboden', genese: 'hochmoor', note: 'Torf unter dünner Mineralbodendecke' },
  6: { label: 'Mächtig überdeckter Niedermoorboden', genese: 'niedermoor', note: 'Torf unter mächtiger Mineralbodendecke' },
  7: { label: 'Mächtig überdeckter Hochmoorboden', genese: 'hochmoor', note: 'Torf unter mächtiger Mineralbodendecke' },
  8: { label: 'Tiefumbruchboden aus Niedermoor', genese: 'niedermoor', note: 'Torf mit Mineralboden durchmischt' },
  9: { label: 'Tiefumbruchboden aus Hochmoor', genese: 'hochmoor', note: 'Torf mit Mineralboden durchmischt' },
};

export interface PeatClass {
  code: string;
  label: string;
  /** Klassenmitte für Berechnungen (cm); null = unbekannt */
  depthCm: number | null;
}

/** Torfmächtigkeitsklassen nach Thünen Working Paper 212 */
export const PEAT_CLASSES: Record<number, PeatClass> = {
  1: { code: 'TM0', label: 'kein Torf (unter 10 cm)', depthCm: 5 },
  2: { code: 'TM1', label: '10–30 cm', depthCm: 20 },
  3: { code: 'TM2', label: '30–70 cm', depthCm: 50 },
  4: { code: 'TM3', label: '70–120 cm', depthCm: 95 },
  5: { code: 'TM4', label: '120–200 cm', depthCm: 160 },
  6: { code: 'TM5', label: 'über 200 cm', depthCm: 250 },
  7: { code: 'TMX', label: 'unbekannt', depthCm: null },
};

interface Poly {
  code: number;
  minLat: number; maxLat: number; minLon: number; maxLon: number;
  /** Ringe als [lat, lon, lat, lon, …] */
  rings: Float64Array[];
}

interface Index { tileLat: number; tileLon: number; q: number; tiles: Set<string> }

const BASE = `${import.meta.env.BASE_URL}data/kulisse/`;
let index: Index | null = null;
let indexLoading: Promise<boolean> | null = null;
const tiles = new Map<string, Poly[]>();
const pending = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

/** Lädt das Kachelverzeichnis (klein). Liefert false, wenn die Kulisse nicht verfügbar ist. */
export function loadKulisse(): Promise<boolean> {
  if (!indexLoading) {
    indexLoading = fetch(`${BASE}index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: { tileLat: number; tileLon: number; q: number; tiles: string[] }) => {
        index = { ...j, tiles: new Set(j.tiles) };
        return true;
      })
      .catch((err) => {
        console.warn('Thünen-Kulisse nicht verfügbar – Bodenmodell als Rückfall', err);
        return false;
      });
  }
  return indexLoading;
}

export const kulisseReady = () => index !== null;

async function readBytes(resp: Response): Promise<Uint8Array> {
  const buf = new Uint8Array(await resp.arrayBuffer());
  // Manche Server liefern die .gz-Datei bereits entpackt aus (Content-Encoding)
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return buf;
}

function parseTile(d: Uint8Array, key: string, ix: Index): Poly[] {
  if (String.fromCharCode(d[0], d[1], d[2]) !== 'KV1') throw new Error('Unbekanntes Kachelformat');
  let o = 3;
  const varint = () => {
    let n = 0;
    let mul = 1;
    for (;;) {
      const b = d[o++];
      n += (b & 0x7f) * mul;
      if (b < 0x80) return n;
      mul *= 128;
    }
  };
  const unzz = (n: number) => (n % 2 ? -(n + 1) / 2 : n / 2);
  const [i, j] = key.split('_').map(Number);
  const ox = Math.round(j * ix.tileLon * ix.q);
  const oy = Math.round(i * ix.tileLat * ix.q);
  const polys: Poly[] = [];
  const n = varint();
  for (let p = 0; p < n; p++) {
    const code = d[o++];
    const nr = varint();
    const rings: Float64Array[] = [];
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    for (let r = 0; r < nr; r++) {
      const np = varint();
      const ring = new Float64Array(np * 2);
      let x = ox;
      let y = oy;
      for (let k = 0; k < np; k++) {
        x += unzz(varint());
        y += unzz(varint());
        const lat = y / ix.q;
        const lon = x / ix.q;
        ring[2 * k] = lat;
        ring[2 * k + 1] = lon;
        if (r === 0) {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
        }
      }
      rings.push(ring);
    }
    polys.push({ code, minLat, maxLat, minLon, maxLon, rings });
  }
  return polys;
}

function tileKeys(s: number, w: number, n: number, e: number, ix: Index): string[] {
  const keys: string[] = [];
  for (let i = Math.floor(s / ix.tileLat); i <= Math.floor(n / ix.tileLat); i++)
    for (let j = Math.floor(w / ix.tileLon); j <= Math.floor(e / ix.tileLon); j++) keys.push(`${i}_${j}`);
  return keys;
}

/** Lädt alle Kacheln, die den Ausschnitt berühren. */
export async function ensureKulisse(s: number, w: number, n: number, e: number): Promise<void> {
  if (!(await loadKulisse()) || !index) return;
  const ix = index;
  const jobs = tileKeys(s, w, n, e, ix)
    .filter((k) => ix.tiles.has(k) && !tiles.has(k))
    .map((k) => {
      if (!pending.has(k)) {
        pending.set(k, fetch(`${BASE}${k}.bin.gz`)
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return readBytes(r);
          })
          .then((bytes) => { tiles.set(k, parseTile(bytes, k, ix)); })
          .catch((err) => { console.warn('Kulisse-Kachel', k, err); tiles.set(k, []); })
          .finally(() => pending.delete(k)));
      }
      return pending.get(k)!;
    });
  if (jobs.length) {
    await Promise.all(jobs);
    listeners.forEach((fn) => fn());
  }
}

/** true, wenn alle Kacheln des Ausschnitts geladen sind (oder es dort keine gibt). */
export function kulisseCovers(s: number, w: number, n: number, e: number): boolean {
  if (!index) return false;
  const ix = index;
  return tileKeys(s, w, n, e, ix).every((k) => !ix.tiles.has(k) || tiles.has(k));
}

/** Meldet sich für „neue Kacheln geladen“ an; gibt die Abmeldung zurück. */
export function onKulisseLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function inRing(lat: number, lon: number, r: Float64Array): boolean {
  let inside = false;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = r[2 * i], xi = r[2 * i + 1], yj = r[2 * j], xj = r[2 * j + 1];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface KulisseHit {
  category: KulisseCategory;
  categoryCode: number;
  peat: PeatClass;
}

/**
 * Kategorie und Torfklasse am Punkt.
 * null = kein organischer Boden; undefined = Kachel noch nicht geladen.
 */
export function kulisseAt(lat: number, lon: number): KulisseHit | null | undefined {
  const ix = index;
  if (!ix) return undefined;
  const key = `${Math.floor(lat / ix.tileLat)}_${Math.floor(lon / ix.tileLon)}`;
  if (!ix.tiles.has(key)) return null;
  const polys = tiles.get(key);
  if (!polys) return undefined;
  for (const p of polys) {
    if (lat < p.minLat || lat > p.maxLat || lon < p.minLon || lon > p.maxLon) continue;
    // Gerade-ungerade-Regel über alle Ringe (Löcher eingeschlossen)
    let inside = false;
    for (const r of p.rings) if (inRing(lat, lon, r)) inside = !inside;
    if (!inside) continue;
    const category = KULISSE_CATEGORIES[Math.floor(p.code / 8)];
    if (!category) continue;
    return { category, categoryCode: Math.floor(p.code / 8), peat: PEAT_CLASSES[p.code % 8] ?? PEAT_CLASSES[7] };
  }
  return null;
}

/* ---------- Kartendarstellung über den WMS des Thünen-Atlas ---------- */

export const KULISSE_WMS = 'https://atlas.thuenen.de/geoserver/ows';
export const KULISSE_LAYER = 'geonode:ti_kulisse_kat_final_v10';

/** Darstellung in den Paludio-Farben (Niedermoor braun, Hochmoor rot, degradierte Böden heller) */
export function kulisseSld(): string {
  const rule = (values: string[], fill: string) =>
    `<Rule><ogc:Filter>${values.length > 1 ? '<ogc:Or>' : ''}${values.map((v) => `<ogc:PropertyIsEqualTo><ogc:PropertyName>KAT_LANG</ogc:PropertyName><ogc:Literal>${v}</ogc:Literal></ogc:PropertyIsEqualTo>`).join('')}${values.length > 1 ? '</ogc:Or>' : ''}</ogc:Filter>`
    + `<PolygonSymbolizer><Fill><CssParameter name="fill">${fill}</CssParameter><CssParameter name="fill-opacity">0.55</CssParameter></Fill></PolygonSymbolizer></Rule>`;
  return '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">'
    + `<NamedLayer><Name>${KULISSE_LAYER}</Name><UserStyle><FeatureTypeStyle>`
    + rule(['Niedermoorboden'], '#b08a45')
    + rule(['Hochmoorboden'], '#8a4f5a')
    + rule(['Moorfolgeboden', 'Tiefumbruchboden aus Niedermoor', 'Tiefumbruchboden aus Hochmoor'], '#d6c29a')
    + rule(['flach ueberdeckter Niedermoorboden', 'flach ueberdeckter Hochmoorboden', 'maechtig ueberdeckter Niedermoorboden', 'maechtig ueberdeckter Hochmoorboden'], '#c9b48a')
    + '</FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';
}

export const KULISSE_ATTRIBUTION = 'Moorböden: Thünen-Institut (2023), CC BY 4.0';
