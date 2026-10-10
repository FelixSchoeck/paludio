import type { Parcel } from './types';
import { buildParcel } from './parcels';
import { BW_ALKIS_PARCELS, getBwAlkisParcelsInBounds } from './alkis_bw';
import { hash32, ringAreaHa } from './geo';
import type { RawParcel } from './alkis_worker';

/**
 * Amtliche Flurstücke Baden-Württemberg, live vom LGL.
 *
 * Dienst: INSPIRE-WFS BW Flurstücke/Grundstücke ALKIS (offene Daten, CORS freigegeben)
 * Lizenz: Datenlizenz Deutschland – Namensnennung – 2.0, Quellenvermerk „LGL-BW (Jahr), dl-de/by-2-0“
 *
 * Amtlich sind Geometrie, Flurstückskennzeichen, amtliche Fläche und Gemarkung.
 * Boden, Torf, Nutzung und Wasserstand sind Modellwerte (Moorbodenkarte), bis eigene Daten vorliegen.
 *
 * Laden in drei Stufen: Arbeitsspeicher → IndexedDB (90 Tage) → WFS über einen Web Worker.
 * Nur Kacheln im sichtbaren Ausschnitt, von der Mitte nach außen, höchstens 4 gleichzeitig;
 * Kacheln, die aus dem Bild fallen, werden abgebrochen.
 */

const WFS = 'https://owsproxy.lgl-bw.de/owsproxy/wfs/WFS_INSP_BW_Flst_ALKIS';
const CRS = 'urn:ogc:def:crs:EPSG::4258'; // ETRS89, Achsenfolge Breite/Länge

/** Abdeckung laut GetCapabilities des Dienstes */
export const BW_BBOX = { south: 47.53, west: 7.44, north: 49.8, east: 10.5 };
/** Ab dieser Zoomstufe werden amtliche Flurstücke geladen */
export const BW_MIN_ZOOM = 15;

// ca. 550 × 560 m – klein genug, dass auch dichte Ortslagen schnell kommen
const TILE_LAT = 0.005;
const TILE_LON = 0.0075;
const MAX_PARALLEL = 4;
const MAX_TILES_IN_MEMORY = 800;
const CACHE_DAYS = 90;
const RETRY_AFTER_MS = 60_000;

const tiles = new Map<string, Parcel[]>();
const failedAt = new Map<string, number>();
const listeners = new Set<() => void>();
const bundled = new Map(BW_ALKIS_PARCELS.map((p) => [p.alkis!.flurstueckskennzeichen, p]));

export function touchesBw(s: number, w: number, n: number, e: number) {
  return s <= BW_BBOX.north && n >= BW_BBOX.south && w <= BW_BBOX.east && e >= BW_BBOX.west;
}

/** Zerlegt das 20-stellige Flurstückskennzeichen: LL GGGG FFF ZZZZZ NNNN __ */
export function parseKennzeichen(ref: string) {
  const land = ref.slice(0, 2);
  const gemarkung = ref.slice(2, 6);
  const flur = Number(ref.slice(6, 9));
  const zaehler = Number(ref.slice(9, 14));
  const nenner = Number(ref.slice(14, 18));
  return { land, gemarkung, gemarkungSchluessel: land + gemarkung, flur, zaehler, nenner, nummer: nenner ? `${zaehler}/${nenner}` : String(zaehler) };
}

/* ---------- Gemarkungsnamen (einmal je Gemarkung, dauerhaft gespeichert) ---------- */

const GMK_KEY = 'paludio-gemarkungen-bw';
const gemarkungen = new Map<string, string>(readGemarkungen());
const gmkPending = new Map<string, Promise<void>>();

function readGemarkungen(): [string, string][] {
  try {
    return Object.entries(JSON.parse(localStorage.getItem(GMK_KEY) ?? '{}'));
  } catch {
    return [];
  }
}

async function ensureGemarkungen(keys: string[]) {
  const missing = [...new Set(keys)].filter((k) => !gemarkungen.has(k) && !gmkPending.has(k));
  if (missing.length) {
    const ids = missing.map((k) => `CadastralZoning.${k}`).join(',');
    const job = fetch(`${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&RESOURCEID=${ids}`)
      .then((r) => r.text())
      .then((xml) => {
        for (const m of xml.split('<wfs:member>').slice(1)) {
          const id = /gml:id="CadastralZoning\.(\d+)"/.exec(m)?.[1];
          const name = /<gn:text>([^<]+)</.exec(m)?.[1];
          if (id && name) gemarkungen.set(id, name.trim());
        }
        try {
          localStorage.setItem(GMK_KEY, JSON.stringify(Object.fromEntries(gemarkungen)));
        } catch {
          /* Speicher voll – Namen bleiben im Arbeitsspeicher */
        }
      })
      .catch(() => { /* Namen sind optional */ })
      .finally(() => missing.forEach((k) => gmkPending.delete(k)));
    missing.forEach((k) => gmkPending.set(k, job));
  }
  await Promise.all(keys.map((k) => gmkPending.get(k)).filter(Boolean));
}

/* ---------- IndexedDB-Cache ---------- */

interface CachedTile { key: string; savedAt: number; parcels: RawParcel[] }
let dbPromise: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open('paludio-kataster', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('bw-tiles', { keyPath: 'key' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

async function cacheGet(key: string): Promise<RawParcel[] | null> {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const req = d.transaction('bw-tiles').objectStore('bw-tiles').get(key);
      req.onsuccess = () => {
        const t = req.result as CachedTile | undefined;
        resolve(t && Date.now() - t.savedAt < CACHE_DAYS * 86400000 ? t.parcels : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function cachePut(key: string, parcels: RawParcel[]) {
  const d = await db();
  if (!d) return;
  try {
    d.transaction('bw-tiles', 'readwrite').objectStore('bw-tiles').put({ key, savedAt: Date.now(), parcels } satisfies CachedTile);
  } catch {
    /* Cache ist optional */
  }
}

/** Löscht den gespeicherten Kataster-Cache (z. B. nach einer Katasteraktualisierung). */
export async function clearBwCache() {
  tiles.clear();
  const d = await db();
  d?.transaction('bw-tiles', 'readwrite').objectStore('bw-tiles').clear();
}

/* ---------- Worker ---------- */

let worker: Worker | null = null;
const workerJobs = new Map<string, { resolve: (p: RawParcel[]) => void; reject: (e: Error & { aborted?: boolean }) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./alkis_worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const job = workerJobs.get(e.data.id);
      if (!job) return;
      workerJobs.delete(e.data.id);
      if ('error' in e.data) job.reject(Object.assign(new Error(e.data.error), { aborted: e.data.aborted }));
      else job.resolve(e.data.parcels);
    };
  }
  return worker;
}

function fetchTile(key: string, s: number, w: number, n: number, e: number): Promise<RawParcel[]> {
  const url = `${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=cp:CadastralParcel&COUNT=5000&SRSNAME=${CRS}&BBOX=${s},${w},${n},${e},${CRS}`;
  return new Promise((resolve, reject) => {
    workerJobs.set(key, { resolve, reject });
    getWorker().postMessage({ type: 'load', id: key, url });
  });
}

/* ---------- Aufbau der Flurstücke ---------- */

function toParcel(raw: RawParcel): Parcel {
  const known = bundled.get(raw.ref);
  const k = parseKennzeichen(raw.ref);
  const gmkName = gemarkungen.get(k.gemarkungSchluessel);
  if (known) return gmkName ? { ...known, gemarkung: `${gmkName} (Gmk. ${k.gemarkungSchluessel})` } : known;
  const base = buildParcel(`alkis_bw_${raw.ref}`, `Flst. ${k.nummer}`, raw.ring, gmkName ?? `Gemarkung ${k.gemarkungSchluessel}`, hash32(Number(raw.ref.slice(6, 14)), Number(raw.ref.slice(2, 6))));
  return {
    ...base,
    bundesland: 'BW',
    areaHa: raw.areaM2 > 0 ? Math.round(raw.areaM2 / 100) / 100 : Math.round(ringAreaHa(raw.ring) * 100) / 100,
    gemarkung: `${gmkName ?? 'Gemarkung'} (Gmk. ${k.gemarkungSchluessel})`,
    isAlkis: true,
    alkis: {
      flurstueckskennzeichen: raw.ref,
      flurstuecksnummer: k.nummer,
      gemarkungSchluessel: k.gemarkungSchluessel,
      amtlicheFlaecheQm: raw.areaM2,
      katasteramt: 'LGL Baden-Württemberg',
      aktualitaet: 'Amtlicher Katasterstand (LGL-WFS)',
      source: 'LGL_BW_ALKIS_WFS',
    },
  };
}

function bounds(key: string) {
  const [i, j] = key.split('_').map(Number);
  return { s: i * TILE_LAT, n: (i + 1) * TILE_LAT, w: j * TILE_LON, e: (j + 1) * TILE_LON };
}

async function loadTile(key: string) {
  const b = bounds(key);
  let raw = await cacheGet(key);
  if (!raw) {
    raw = await fetchTile(key, b.s, b.w, b.n, b.e);
    void cachePut(key, raw);
  }
  // Nur Flurstücke, deren erster Punkt in der Kachel liegt – so gibt es keine Dubletten
  const own = raw.filter((p) => p.ring[0][0] >= b.s && p.ring[0][0] < b.n && p.ring[0][1] >= b.w && p.ring[0][1] < b.e);
  await ensureGemarkungen(own.map((p) => p.ref.slice(0, 6)));
  tiles.set(key, own.map(toParcel));
  if (tiles.size > MAX_TILES_IN_MEMORY) tiles.delete(tiles.keys().next().value!);
}

/* ---------- Warteschlange ---------- */

let wanted = new Set<string>();
let queue: { key: string; dist: number }[] = [];
const running = new Set<string>();

function pump() {
  queue = queue.filter((q) => wanted.has(q.key) && !tiles.has(q.key) && !running.has(q.key));
  queue.sort((a, b) => a.dist - b.dist);
  while (running.size < MAX_PARALLEL && queue.length) {
    const { key } = queue.shift()!;
    running.add(key);
    loadTile(key)
      .catch((err: Error & { aborted?: boolean }) => { if (!err.aborted) failedAt.set(key, Date.now()); })
      .finally(() => {
        running.delete(key);
        listeners.forEach((fn) => fn());
        pump();
      });
  }
}

/** Meldet sich für „neue Kacheln geladen“ an; gibt die Abmeldung zurück. */
export function onBwTilesLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface BwView {
  parcels: Parcel[];
  loading: boolean;
  /** true, wenn der Dienst nicht erreichbar war und nur eingebaute Daten gezeigt werden */
  offline: boolean;
  /** true, wenn für amtliche Flurstücke weiter hineingezoomt werden muss */
  needZoom: boolean;
}

/** Liefert die geladenen BW-Flurstücke im Ausschnitt und lädt fehlende Kacheln nach. */
export function bwParcelsInView(s: number, w: number, n: number, e: number, zoom: number): BwView {
  if (!touchesBw(s, w, n, e)) {
    wanted = new Set();
    return { parcels: [], loading: false, offline: false, needZoom: false };
  }
  if (zoom < BW_MIN_ZOOM) {
    wanted = new Set();
    for (const key of running) if (workerJobs.has(key)) worker?.postMessage({ type: 'abort', id: key });
    return { parcels: getBwAlkisParcelsInBounds(s, w, n, e), loading: false, offline: false, needZoom: true };
  }

  const cLat = (s + n) / 2;
  const cLon = (w + e) / 2;
  const next = new Set<string>();
  const parcels: Parcel[] = [];
  let loading = false;
  let offline = false;

  for (let i = Math.floor(s / TILE_LAT); i <= Math.floor(n / TILE_LAT); i++) {
    for (let j = Math.floor(w / TILE_LON); j <= Math.floor(e / TILE_LON); j++) {
      const key = `${i}_${j}`;
      next.add(key);
      const t = tiles.get(key);
      if (t) {
        // als zuletzt benutzt markieren
        tiles.delete(key);
        tiles.set(key, t);
        parcels.push(...t);
        continue;
      }
      const failed = failedAt.get(key);
      if (failed && Date.now() - failed < RETRY_AFTER_MS) { offline = true; continue; }
      loading = true;
      if (!running.has(key) && !queue.some((q) => q.key === key)) {
        const b = bounds(key);
        queue.push({ key, dist: ((b.s + b.n) / 2 - cLat) ** 2 + (((b.w + b.e) / 2 - cLon) * 0.67) ** 2 });
      }
    }
  }

  // Kacheln, die nicht mehr im Bild sind, abbrechen
  for (const key of running) if (!next.has(key) && workerJobs.has(key)) worker?.postMessage({ type: 'abort', id: key });
  wanted = next;
  pump();

  if (offline) {
    const have = new Set(parcels.map((p) => p.id));
    parcels.push(...getBwAlkisParcelsInBounds(s, w, n, e).filter((p) => !have.has(p.id)));
  }
  return { parcels, loading, offline, needZoom: false };
}

/** Quellenvermerk nach Datenlizenz Deutschland */
export const BW_ATTRIBUTION = `Flurstücke: LGL-BW (${new Date().getFullYear()}), dl-de/by-2-0`;
