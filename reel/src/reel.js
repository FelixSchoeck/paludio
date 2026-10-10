// Komposition: App-Fenster als „Kamera“, echte App-Zustände, Cursor mit Klicks, kurze Beschriftungen, Logo-Abspann
import { seg, E, lerp, clamp } from './timeline.js';

const $ = (id) => document.getElementById(id);
const css = (el, o) => Object.assign(el.style, o);

/* Fenster: 1600 × 1000 CSS-px App + 34 px Titelleiste, Grundmaßstab 0,9375 → 1500 px breit */
const CH = 34, WW = 1600, WH = 1000 + CH, BS = 0.9375;
let T = {};          // Klickziele aus states.json
let dialog = null;   // Lage des Antragsdialogs

/* ---------- Drehbuch (Sekunden) ---------- */
// App-Zustände: Zeitpunkt, Bild, Überblendung (Seitenwechsel etwas länger, mit leichtem Nachrutschen)
const STATES = [
  [0, 'map0', 0], [2.35, 'map1', 0.2], [3.65, 'map2', 0.15], [3.85, 'plan0', 0.32],
  [5.35, 'plan1', 0.15], [5.6, 'plan2', 0.2], [7.25, 'plan3', 0.15], [7.45, 'fund0', 0.32],
  [8.5, 'fund1', 0.15], [8.7, 'fund2', 0.5],
];
const PAGES = new Set(['plan0', 'fund0']);
// Kamera: Start, Ende, Zoom, Bildmitte in App-Koordinaten. Wenige, lange Fahrten; Ursache und Wirkung im selben Bild
const CAM = [
  [0.9, 2.2, 1.3, 1050, 480],    // Karte und Auswahlbereich
  [2.85, 3.75, 1.0, 800, 500],   // zurück, Navigation sichtbar
  [4.1, 5.2, 1.32, 900, 560],    // Kulturen und Ergebnis
  [5.85, 6.6, 1.42, 1150, 470],  // sanft zum Ergebnis
  [6.65, 7.35, 1.0, 800, 500],   // zurück zur Navigation
  [7.65, 8.6, 1.22, 760, 560],   // Förderprogramme
  [8.85, 9.65, 1.3, 800, 505],   // Antragsdialog
];
// Cursorwege und Klicks (werden nach dem Laden der Klickziele gefüllt)
let MOVES = [], CLICKS = [];
const CAPTIONS = [
  ['cap1', 0.6, 3.6],
  ['cap2', 4.0, 7.15],
  ['cap3', 7.7, 9.7],
];

export async function initReel() {
  const st = await fetch('states/states.json').then((r) => r.json());
  T = st;
  dialog = st.dialog;
  MOVES = [
    [1.15, 2.2, [1330, 880], [T.parcel.x, T.parcel.y], 40],
    [2.85, 3.7, null, [T.toPlanner.x - 40, T.toPlanner.y], -50],
    [4.4, 5.4, null, [T.reed.x - 180, T.reed.y], 35],
    [6.35, 7.3, null, [T.toFunding.x - 40, T.toFunding.y], -45],
    [7.75, 8.55, null, [T.prepare.x, T.prepare.y], 35],
    // zum „Weiter“-Knopf im Dialog
    [9.0, 9.7, null, [dialog.x + dialog.w - 64, dialog.y + dialog.h - 38], -25],
  ];
  CLICKS = [2.3, 3.8, 5.55, 7.4, 8.65];
  // Wortmarke und Bildmarke für den Abspann
  const load = async (url) => new DOMParser().parseFromString(await fetch(url).then((r) => r.text()), 'image/svg+xml').documentElement;
  $('mark').innerHTML = (await load('mark.svg')).innerHTML;
  parts = [...$('mark').querySelectorAll('path')];
  $('wordtext').innerHTML = (await load('logo-schrift.svg')).innerHTML;
  $('wordtext').querySelector('#ArtBoard1 > g').style.display = 'none';
  // je Zustand ein vorab dekodiertes Bild; der Dialog bekommt eine eigene Ebene
  for (const [, n] of STATES) {
    const img = new Image();
    img.src = `states/${n}.png`;
    img.className = 'state';
    $('view').appendChild(img);
    imgs[n] = img;
  }
  modal = imgs.fund2.cloneNode();
  $('view').appendChild(modal);
  await Promise.all([...Object.values(imgs), modal].map((i) => i.decode()));
}

// Ausschnitt so begrenzen, dass das Fenster den Bildrand füllt, sobald es größer als das Bild ist.
// Die Begrenzung gilt für die Schlüsselbilder, nicht für jeden Frame – so bleibt die Fahrt ohne Knick.
function frameKey(z, x, y) {
  const S = BS * z;
  const fx = WW * S < 1920 ? WW / 2 : clamp(x, 960 / S, WW - 960 / S);
  const fy = WH * S < 1080 ? WH / 2 : clamp(y + CH, 540 / S, WH - 540 / S);
  return { z, fx, fy };
}
const KEYS = CAM.map(([t0, t1, z, x, y]) => [t0, t1, frameKey(z, x, y)]);
function camera(t) {
  let cur = frameKey(1, WW / 2, (WH - CH) / 2);
  for (const [t0, t1, k] of KEYS) {
    if (t <= t0) break;
    const p = E.ioSine(seg(t, t0, t1));
    // Zoom logarithmisch überblenden: gleichmäßig wirkende Fahrt
    cur = { z: Math.exp(lerp(Math.log(cur.z), Math.log(k.z), p)), fx: lerp(cur.fx, k.fx, p), fy: lerp(cur.fy, k.fy, p) };
  }
  // ganz leichtes, stetiges Heranfahren für Ruhe und Tiefe
  const z = cur.z * (1 + 0.012 * Math.sin((t / 12) * Math.PI));
  return { S: BS * z, fx: cur.fx, fy: cur.fy };
}
const toScreen = (c, x, y) => [960 + (x - c.fx) * c.S, 540 + (y + CH - c.fy) * c.S];

function stateAt(t) {
  let i = 0;
  while (i + 1 < STATES.length && t >= STATES[i + 1][0]) i++;
  const [ts, name, dur] = STATES[i];
  const prev = i > 0 ? STATES[i - 1][1] : name;
  return { a: prev, b: name, p: dur > 0 ? E.ioSine(clamp((t - ts) / dur)) : 1 };
}

function cursorAt(t) {
  let pos = MOVES[0][2];
  for (const [t0, t1, from, to, arc] of MOVES) {
    if (t <= t0) break;
    const a = from ?? pos;
    const p = E.smoother(seg(t, t0, t1));
    // leichter Bogen wie bei einer echten Mausbewegung
    const dx = to[0] - a[0], dy = to[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const bend = Math.sin(Math.PI * p) * arc;
    pos = [lerp(a[0], to[0], p) - (dy / len) * bend, lerp(a[1], to[1], p) + (dx / len) * bend];
    if (t < t1) break;
    pos = to;
  }
  return pos;
}

function caption(id, t, tin, tout) {
  const el = $(id);
  const pi = E.out5(seg(t, tin, tin + 0.8)), po = E.ioSine(seg(t, tout, tout + 0.4));
  const vis = pi > 0 && po < 1;
  el.style.display = vis ? '' : 'none';
  if (!vis) return;
  css(el, {
    opacity: clamp(pi * 1.6) * (1 - po),
    transform: `translateX(-50%) translateY(${(1 - pi) * 22 - po * 10}px) scale(${lerp(0.96, 1, pi)})`,
    filter: pi < 0.99 || po > 0.01 ? `blur(${(1 - pi) * 10 + po * 8}px)` : 'none',
  });
}

/* ---------- Logo-Abspann ---------- */
const K = 230 / 471;
const TOTAL = (1714 - 66) * K;
const left0 = 960 - TOTAL / 2;
const textTop = 540 - (451 * K) / 2 - (46.8 - 37) * K;
const markTop = textTop + 2 * K;
const markLeftEnd = left0 - (59.8 - 41) * K;
const markLeftStart = 960 - (429 * K) / 2 - (59.8 - 41) * K;
const textLeft = left0 + (580 - 66) * K;
let parts = [];
const imgs = {};
let modal = null;

function outro(t) {
  const on = t > 9.9;
  $('mark').style.display = $('wordtext').style.display = on ? '' : 'none';
  if (!on) return;
  const [pad1, pad2, basin, head1, head2, stems] = parts;
  const pb = E.out5(seg(t, 9.95, 10.6));
  css(basin, { transformOrigin: '50% 50%', transform: `scale(${lerp(0.5, 1, pb)})`, opacity: clamp(pb * 2.5) });
  const ps = E.out5(seg(t, 10.05, 10.8));
  css(stems, { transformOrigin: '50% 100%', transform: `scaleY(${ps})`, opacity: clamp(ps * 4) });
  [head1, head2].forEach((h, i) => {
    const p = seg(t, 10.35 + i * 0.08, 10.85 + i * 0.08);
    css(h, { transformOrigin: '50% 100%', transform: `translateY(${(1 - E.out3(p)) * 50}px) scale(${lerp(0.5, 1, E.back(p))})`, opacity: clamp(p * 3) });
  });
  [pad1, pad2].forEach((h, i) => {
    const p = seg(t, 10.5 + i * 0.07, 10.95 + i * 0.07);
    css(h, { transformOrigin: '50% 50%', transform: `scale(${E.back(p)})`, opacity: clamp(p * 3) });
  });
  const pm = E.ioSine(seg(t, 10.7, 11.35));
  const drift = 1 + 0.02 * seg(t, 9.95, 12);
  const ml = lerp(markLeftStart, markLeftEnd, pm);
  css($('mark'), { left: ml + 'px', top: markTop + 'px', width: 467 * K + 'px', height: 467 * K + 'px', transform: `scale(${drift})`, transformOrigin: `${960 - ml}px ${540 - markTop}px` });
  const pt = E.out5(seg(t, 10.95, 11.7));
  css($('wordtext'), {
    left: textLeft + 'px', top: textTop + 'px', width: 1134 * K + 'px', height: 471 * K + 'px',
    clipPath: `inset(-10% ${(1 - pt) * 100}% -10% 0)`, transform: `translateX(${(1 - pt) * -30}px) scale(${drift})`,
    transformOrigin: `${960 - textLeft}px ${540 - textTop}px`, opacity: clamp(pt * 3),
  });
}

/* ---------- Bild für Zeitpunkt t ---------- */
export function renderReel(t) {
  // Fenster erscheint und verabschiedet sich
  const pin = E.out5(seg(t, 0.05, 1.4));
  const pout = E.ioSine(seg(t, 9.85, 10.5));
  css($('rig'), {
    opacity: clamp(pin * 1.5) * (1 - pout),
    transform: `perspective(2200px) translateY(${(1 - pin) * 140 - pout * 20}px) rotateX(${(1 - pin) * 18}deg) scale(${lerp(0.9, 1, pin) * lerp(1, 0.88, pout)})`,
    filter: pout > 0.01 ? `blur(${pout * 14}px)` : 'none',
  });

  const c = camera(t);
  css($('cam'), { transform: `translate(${960 - c.fx * c.S}px, ${540 - c.fy * c.S}px) scale(${c.S})` });

  // App-Zustände überblenden; der Antragsdialog springt auf
  const s = stateAt(t);
  for (const [n, el] of Object.entries(imgs)) {
    const on = n === s.a || n === s.b;
    el.style.display = on ? '' : 'none';
    if (on) css(el, { opacity: n === s.b ? s.p : 1, clipPath: 'none', zIndex: n === s.b ? 2 : 1, transform: n === s.b && PAGES.has(n) ? `translateY(${(1 - s.p) * 14}px)` : 'none' });
  }
  const isDialog = s.b === 'fund2';
  const d = dialog;
  if (isDialog) css(imgs.fund2, { clipPath: `polygon(evenodd, 0 0, 1600px 0, 1600px 1000px, 0 1000px, 0 0, ${d.x}px ${d.y}px, ${d.x}px ${d.y + d.h}px, ${d.x + d.w}px ${d.y + d.h}px, ${d.x + d.w}px ${d.y}px, ${d.x}px ${d.y}px)` });
  modal.style.display = isDialog ? '' : 'none';
  if (isDialog) {
    const p = E.out5(s.p);
    css(modal, {
      zIndex: 3,
      opacity: clamp(s.p * 2.5),
      clipPath: `inset(${d.y}px ${1600 - d.x - d.w}px ${1000 - d.y - d.h}px ${d.x}px round 16px)`,
      transformOrigin: `${d.x + d.w / 2}px ${d.y + d.h / 2}px`,
      transform: `translateY(${(1 - p) * 18}px) scale(${lerp(0.955, 1, p)})`,
    });
  }

  // Cursor (Bildschirmgröße bleibt gleich, nur leicht mit dem Zoom)
  const [cx, cy] = cursorAt(t);
  const [sx, sy] = toScreen(c, cx, cy);
  const cv = E.ioSine(seg(t, 0.95, 1.3)) * (1 - E.ioSine(seg(t, 9.75, 10.0)));
  const press = Math.max(0, ...CLICKS.map((k) => Math.exp(-Math.pow((t - k - 0.05) / 0.08, 2))));
  css($('cursor'), { display: cv > 0 ? '' : 'none', opacity: cv, transform: `translate(${sx}px, ${sy}px) scale(${(0.9 + 0.1 * Math.sqrt(c.S)) * (1 - 0.14 * press)})` });

  // Klick-Welle am Klickpunkt
  const last = CLICKS.filter((k) => t >= k).pop();
  const rp = last !== undefined ? seg(t, last, last + 0.8) : 1;
  css($('ripple'), { display: rp < 1 ? '' : 'none', left: sx + 'px', top: sy + 'px', transform: `translate(-50%, -50%) scale(${lerp(0.2, 1, E.out3(rp))})`, opacity: (1 - rp) * 0.9 });

  CAPTIONS.forEach(([id, a, b]) => caption(id, t, a, b));
  outro(t);
}
