// Hochkant-Marketing-Reel (1080 × 1920): 128 BPM, Schnitte auf dem Schlag, App-Ausschnitte als Karten, kinetische Typografie
import { createBackground, LIGHT } from './bg.js';
import { seg, E, lerp, clamp } from './timeline.js';

export const BPM = 128;
export const B = 60 / BPM;            // ein Schlag ≈ 0,469 s
export const DURATION = 19.5;
const at = (beats) => beats * B;
const $ = (id) => document.getElementById(id);
const css = (el, o) => Object.assign(el.style, o);

const DARK = { base: [0.075, 0.2, 0.11], tintA: [0.11, 0.29, 0.16], tintB: [0.06, 0.19, 0.22], line: [0.62, 0.82, 0.66] };

/* ---------- Szenen (Schläge) ---------- */
export const SCENES = [
  { id: 's0', b0: 0, b1: 4, pal: DARK },
  { id: 's1', b0: 4, b1: 8, pal: LIGHT },
  { id: 's2', b0: 8, b1: 12, pal: DARK },
  { id: 's3', b0: 12, b1: 18, pal: LIGHT },
  { id: 's4', b0: 18, b1: 22, pal: DARK },
  { id: 's5', b0: 22, b1: 28, pal: LIGHT },
  { id: 's6', b0: 28, b1: 32, pal: DARK },
  { id: 's7', b0: 32, b1: 36, pal: DARK },
  { id: 's8', b0: 36, b1: 42, pal: LIGHT },
].map((s) => ({ ...s, t0: at(s.b0), t1: at(s.b1) }));
// Ereignisse für Bild und Ton
export const TAPS = [at(6), at(14), at(24)];
export const CUTS = SCENES.slice(1).map((s) => s.t0);

/* ---------- Karten: Ausschnitt eines App-Zustands ---------- */
class Card {
  constructor(el, region, width, states) {
    this.el = el; this.r = region; this.s = width / region.w;
    css(el, { width: width + 'px', height: region.h * this.s + 'px' });
    this.inner = document.createElement('div');
    this.inner.className = 'inner';
    el.appendChild(this.inner);
    this.imgs = {};
    for (const n of states) {
      const img = new Image();
      img.src = `states/${n}.png`;
      css(img, { left: -region.x * this.s + 'px', top: -region.y * this.s + 'px', width: 1600 * this.s + 'px', height: 1000 * this.s + 'px' });
      this.inner.appendChild(img);
      this.imgs[n] = img;
    }
    this.ring = document.createElement('div'); this.ring.className = 'ring';
    this.dot = document.createElement('div'); this.dot.className = 'tap';
    this.inner.append(this.ring, this.dot);
  }
  get height() { return this.r.h * this.s; }
  decode() { return Promise.all(Object.values(this.imgs).map((i) => i.decode())); }
  /** Zustandsfolge [[t, name, dauer], …] überblenden */
  show(t, seq) {
    let i = 0;
    while (i + 1 < seq.length && t >= seq[i + 1][0]) i++;
    const [ts, b, dur] = seq[i];
    const a = i > 0 ? seq[i - 1][1] : b;
    const p = dur > 0 ? E.ioSine(clamp((t - ts) / dur)) : 1;
    for (const [n, img] of Object.entries(this.imgs)) {
      const on = n === a || n === b;
      img.style.display = on ? '' : 'none';
      if (on) css(img, { opacity: n === b ? p : 1, zIndex: n === b ? 2 : 1 });
    }
  }
  /** Fingertipp: Punkt gleitet heran, drückt, Welle */
  tap(t, tTap, x, y, from = [x + 160, y + 260]) {
    const k = this.s, px = (x - this.r.x) * k, py = (y - this.r.y) * k;
    const fx = (from[0] - this.r.x) * k, fy = (from[1] - this.r.y) * k;
    const vis = E.ioSine(seg(t, tTap - 0.55, tTap - 0.4)) * (1 - E.ioSine(seg(t, tTap + 0.3, tTap + 0.5)));
    const m = E.smoother(seg(t, tTap - 0.55, tTap - 0.06));
    const press = Math.exp(-Math.pow((t - tTap) / 0.07, 2));
    css(this.dot, { display: vis > 0 ? '' : 'none', opacity: vis, left: lerp(fx, px, m) + 'px', top: lerp(fy, py, m) + 'px', transform: `scale(${1 - 0.25 * press})` });
    const rp = seg(t, tTap, tTap + 0.6);
    css(this.ring, { display: rp > 0 && rp < 1 ? '' : 'none', left: px + 'px', top: py + 'px', transform: `scale(${lerp(0.6, 3.2, E.out3(rp))})`, opacity: (1 - rp) * 0.9 });
  }
}

let cards = {};
let parts = [];
let T = {};

export async function initVertical() {
  T = await fetch('states/states.json').then((r) => r.json());
  const D = T.dialog;
  cards = {
    map: new Card($('c-map'), { x: 600, y: 300, w: 620, h: 520 }, 960, ['map0', 'map1']),
    panel: new Card($('c-panel'), { x: 1225, y: 120, w: 375, h: 560 }, 520, ['map1']),
    list: new Card($('c-list'), { x: 336, y: 432, w: 708, h: 468 }, 980, ['plan0', 'plan1', 'plan2']),
    result: new Card($('c-result'), { x: 1070, y: 350, w: 440, h: 540 }, 620, ['plan2']),
    prog: new Card($('c-prog'), { x: 330, y: 615, w: 700, h: 290 }, 980, ['fund0', 'fund1']),
    dialog: new Card($('c-dialog'), { x: D.x, y: D.y, w: D.w, h: D.h }, 1000, ['fund2']),
    m1: new Card($('c-m1'), { x: 1070, y: 350, w: 440, h: 540 }, 620, ['plan2']),
    m2: new Card($('c-m2'), { x: D.x, y: D.y, w: D.w, h: D.h }, 860, ['fund2']),
    m3: new Card($('c-m3'), { x: 540, y: 110, w: 1060, h: 780 }, 900, ['map1']),
  };
  const load = async (url) => new DOMParser().parseFromString(await fetch(url).then((r) => r.text()), 'image/svg+xml').documentElement;
  $('mark').innerHTML = (await load('mark.svg')).innerHTML;
  parts = [...$('mark').querySelectorAll('path')];
  $('wordtext').innerHTML = (await load('logo-schrift.svg')).innerHTML;
  $('wordtext').querySelector('#ArtBoard1 > g').style.display = 'none';
  await Promise.all(Object.values(cards).map((c) => c.decode()));
}

/* ---------- Bausteine ---------- */
// Szenenwechsel: vertikaler Wisch (rein von unten, raus nach oben), Schnitt auf dem Schlag
function sceneMotion(t, s) {
  const el = $(s.id);
  if (!el) return false;
  const pin = E.out5(seg(t, s.t0 - 0.05, s.t0 + 0.42));
  const pout = E.in3(seg(t, s.t1 - 0.2, s.t1 + 0.04));
  const vis = t >= s.t0 - 0.05 && t <= s.t1 + 0.04;
  el.style.display = vis ? '' : 'none';
  if (vis) css(el, { transform: `translateY(${(1 - pin) * 820 - pout * 820}px) scale(${lerp(0.94, 1, pin)})` });
  return vis;
}
// Wort/Zeile springt herein: groß → normal, unscharf → scharf
function slam(el, t, tin, tout = 1e9, from = 1.35) {
  const p = E.out5(seg(t, tin, tin + 0.38)), q = E.in3(seg(t, tout, tout + 0.16));
  // Sichtbarkeit statt display: gestapelte Wörter verschieben sich nicht
  const vis = p > 0 && q < 1;
  el.style.visibility = vis ? 'visible' : 'hidden';
  if (!vis) return;
  css(el, { opacity: clamp(p * 2.2) * (1 - q), transform: `scale(${lerp(from, 1, p) * lerp(1, 0.92, q)})`, filter: p < 0.99 || q > 0.01 ? `blur(${(1 - p) * 18 + q * 10}px)` : 'none' });
}
// Überschrift: Zeilen gleiten aus einer Maske nach oben
function lines(el, t, tin, tout = 1e9) {
  const q = E.in3(seg(t, tout, tout + 0.2));
  el.style.display = t >= tin - 0.01 && q < 1 ? '' : 'none';
  css(el, { opacity: 1 - q, transform: `translateY(${-q * 30}px)` });
  el.querySelectorAll('.line > span').forEach((sp, i) => {
    const p = E.out5(seg(t, tin + i * 0.07, tin + i * 0.07 + 0.5));
    css(sp, { transform: `translateY(${(1 - p) * 110}%)` });
  });
}
function kicker(el, t, tin) {
  const p = E.out3(seg(t, tin, tin + 0.4));
  css(el, { opacity: p, transform: `translateY(${(1 - p) * 16}px)`, letterSpacing: `${lerp(0.4, 0.14, p)}em` });
}
// Karte: federnd herein, danach langsames Driften
function place(card, t, tin, x, y, { rot = 0, from = 260, scaleTo = 1.03, t1 = tin + 3 } = {}) {
  const p = seg(t, tin, tin + 0.6);
  const spring = 1 - Math.exp(-6 * p) * Math.cos(9 * p); // leichtes Überschwingen
  const drift = seg(t, tin, t1);
  const vis = t >= tin;
  card.el.style.display = vis ? '' : 'none';
  if (!vis) return;
  css(card.el, {
    left: x + 'px', top: y + 'px', opacity: clamp(p * 3),
    transform: `translateY(${(1 - spring) * from}px) rotate(${rot * (1 - spring) * 3 + rot}deg) scale(${lerp(0.9, 1, clamp(spring)) * lerp(1, scaleTo, drift)})`,
  });
}
function count(el, t, t0, t1, value, decimals = 0, prefix = '', suffix = '') {
  const v = value * E.out5(seg(t, t0, t1));
  el.textContent = prefix + v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
}
// Schlag-Puls auf den dunklen Statement-Szenen
function pulse(t) {
  const beat = Math.floor(t / B) * B;
  return Math.exp(-(t - beat) * 9);
}

/* ---------- Logo-Abspann ---------- */
const K = 860 / (1714 - 66);
const L0 = 540 - 430, TEXT_TOP = 960 - (451 * K) / 2 - (46.8 - 37) * K;
const MARK_TOP = TEXT_TOP + 2 * K;
const MARK_END = L0 - (59.8 - 41) * K, MARK_START = 540 - (429 * K) / 2 - (59.8 - 41) * K;
const TEXT_LEFT = L0 + (580 - 66) * K;
function outro(t, t0) {
  const on = t >= t0;
  $('mark').style.display = $('wordtext').style.display = on ? '' : 'none';
  if (!on) return;
  const r = (a, b) => seg(t, t0 + a, t0 + b);
  const [pad1, pad2, basin, head1, head2, stems] = parts;
  const pb = E.out5(r(0, 0.45));
  css(basin, { transformOrigin: '50% 50%', transform: `scale(${lerp(0.4, 1, E.back(clamp(pb)))})`, opacity: clamp(pb * 3) });
  const ps = E.out5(r(0.08, 0.6));
  css(stems, { transformOrigin: '50% 100%', transform: `scaleY(${ps})`, opacity: clamp(ps * 4) });
  [head1, head2].forEach((h, i) => {
    const p = r(0.3 + i * 0.06, 0.7 + i * 0.06);
    css(h, { transformOrigin: '50% 100%', transform: `translateY(${(1 - E.out3(p)) * 60}px) scale(${lerp(0.4, 1, E.back(p))})`, opacity: clamp(p * 3) });
  });
  [pad1, pad2].forEach((h, i) => {
    const p = r(0.42 + i * 0.05, 0.8 + i * 0.05);
    css(h, { transformOrigin: '50% 50%', transform: `scale(${E.back(p)})`, opacity: clamp(p * 3) });
  });
  const pm = E.io5(r(0.7, 1.2));
  const drift = 1 + 0.03 * seg(t, t0, DURATION);
  const ml = lerp(MARK_START, MARK_END, pm);
  css($('mark'), { left: ml + 'px', top: MARK_TOP + 'px', width: 467 * K + 'px', height: 467 * K + 'px', transform: `scale(${drift})`, transformOrigin: `${540 - ml}px ${960 - MARK_TOP}px` });
  const pt = E.out5(r(0.9, 1.5));
  css($('wordtext'), {
    left: TEXT_LEFT + 'px', top: TEXT_TOP + 'px', width: 1134 * K + 'px', height: 471 * K + 'px',
    clipPath: `inset(-10% ${(1 - pt) * 100}% -10% 0)`, transform: `translateX(${(1 - pt) * -30}px) scale(${drift})`,
    transformOrigin: `${540 - TEXT_LEFT}px ${960 - TEXT_TOP}px`, opacity: clamp(pt * 3),
  });
}

/* ---------- Bild für Zeitpunkt t ---------- */
export function renderVertical(t, tf = t) {
  const sc = SCENES.find((s) => t >= s.t0 && t < s.t1) ?? SCENES[SCENES.length - 1];
  SCENES.forEach((s) => sceneMotion(t, s));
  const dark = sc.pal === DARK;
  css($('world'), { transform: `scale(${1 + (dark && sc.id !== 's7' ? 0.012 * pulse(t) : 0)})` });

  /* 0 · Aufhänger: ein Wort pro Schlag */
  $('s0').querySelectorAll('.hook span').forEach((w, i) => slam(w, t, at(i) + 0.02, at(4) - 0.18, 1.5));

  /* 1 · Flächen */
  if (t < at(8.2)) {
    kicker($('s1').querySelector('.kicker'), t, at(4));
    lines($('s1').querySelector('.head'), t, at(4) + 0.08);
    const c = cards.map;
    place(c, t, at(4.4), 50, 580, { t1: at(8) });
    c.show(t, [[0, 'map0', 0], [at(6) + 0.03, 'map1', 0.14]]);
    c.tap(t, at(6), T.parcel.x, T.parcel.y);
    // nach dem Tipp springt der Auswahlbereich als zweite Karte nach vorn
    const pn = cards.panel;
    place(pn, t, at(6.5), 500, 1110, { rot: 2, from: 520, t1: at(8) });
    pn.show(t, [[0, 'map1', 0]]);
  }

  /* 2 · Moorboden erkannt */
  count($('n-ha'), tf, at(8) + 0.1, at(10.5), 137.7, 1);
  kicker($('s2').querySelector('.kicker'), t, at(8));
  slam($('s2').querySelector('.label'), t, at(8.6), 1e9, 1.15);

  /* 3 · Planer */
  if (t >= at(11.8) && t < at(18.2)) {
    kicker($('s3').querySelector('.kicker'), t, at(12));
    lines($('s3').querySelector('.head'), t, at(12) + 0.08);
    const l = cards.list;
    place(l, t, at(12.4), 50, 580, { t1: at(18) });
    l.show(t, [[0, 'plan0', 0], [at(14) - 0.2, 'plan1', 0.12], [at(14) + 0.03, 'plan2', 0.16]]);
    l.tap(t, at(14), T.reed.x - 170, T.reed.y);
    const r = cards.result;
    place(r, t, at(15), 410, 960, { rot: -2, from: 520, t1: at(18) });
    r.show(t, [[0, 'plan2', 0]]);
  }

  /* 4 · Klimawirkung */
  count($('n-co2'), tf, at(18) + 0.1, at(20.5), 2227, 0, '−');
  kicker($('s4').querySelector('.kicker'), t, at(18));
  slam($('s4').querySelector('.label'), t, at(18.6), 1e9, 1.15);

  /* 5 · Förderung → Antrag */
  if (t >= at(21.8) && t < at(28.2)) {
    kicker($('s5').querySelector('.kicker'), t, at(22));
    lines($('h5a'), t, at(22) + 0.08, at(24) + 0.05);
    lines($('h5b'), t, at(24) + 0.25);
    const pc = cards.prog;
    place(pc, t, at(22.4), 50, 720, { t1: at(28) });
    pc.show(t, [[0, 'fund0', 0], [at(24) - 0.2, 'fund1', 0.12]]);
    pc.tap(t, at(24), T.prepare.x, T.prepare.y);
    // Karte tritt zurück, der Dialog springt nach vorn
    const back = E.ioSine(seg(t, at(24) + 0.05, at(24) + 0.45));
    if (back > 0) css(pc.el, { opacity: 1 - back * 0.85, filter: `blur(${back * 6}px)` }); else pc.el.style.filter = 'none';
    const d = cards.dialog;
    place(d, t, at(24) + 0.06, 40, 600, { from: 380, t1: at(28) });
    d.show(t, [[0, 'fund2', 0]]);
  }

  /* 6 · Zuschuss */
  count($('n-eur'), tf, at(28) + 0.1, at(30.5), 1253258, 0, '', ' €');
  kicker($('s6').querySelector('.kicker'), t, at(28));
  slam($('s6').querySelector('.label'), t, at(28.6), 1e9, 1.15);

  /* 7 · Montage: ein Wort pro Schlag, Karten blitzen dahinter auf */
  ['w1', 'w2', 'w3'].forEach((id, i) => slam($(id), t, at(32 + i) + 0.01, i < 2 ? at(33 + i) - 0.06 : at(36) - 0.12, 1.6));
  [['m1', 250, 560, -6], ['m2', 110, 520, 4], ['m3', 90, 600, -3]].forEach(([k, x, y, rot], i) => {
    const c = cards[k];
    const t0 = at(32 + i);
    const p = E.out5(seg(t, t0, t0 + 0.35));
    const q = i < 2 ? E.in3(seg(t, at(33 + i) - 0.08, at(33 + i) + 0.05)) : E.in3(seg(t, at(35.6), at(36)));
    const vis = t >= t0 && q < 1;
    c.el.style.display = vis ? '' : 'none';
    if (!vis) return;
    c.show(t, [[0, Object.keys(c.imgs)[0], 0]]);
    css(c.el, { left: x + 'px', top: y + 'px', opacity: p * (1 - q) * 0.55, filter: 'brightness(.55) saturate(.9)', transform: `rotate(${rot}deg) scale(${lerp(1.25, 1.05, p) + 0.04 * seg(t, t0, t0 + B)})` });
  });

  /* Weißblitz in den Abspann, Logo */
  css($('flash'), { opacity: t < at(36) ? E.out3(seg(t, at(35.75), at(36))) : 0 });
  outro(t, at(36) + 0.02);
}

/* ---------- Hintergrund und Start ---------- */
const q = new URLSearchParams(location.search);
const drawBg = createBackground($('bg'), Number(q.get('ss') ?? 1), 1080, 1920);
function mixPal(a, b, p) { const m = (x, y) => x.map((v, i) => lerp(v, y[i], p)); return { base: m(a.base, b.base), tintA: m(a.tintA, b.tintA), tintB: m(a.tintB, b.tintB), line: m(a.line, b.line) }; }

function renderFrame(t, tf = t) {
  // Palette wechselt hart auf dem Schlag (mit 60 ms Übergang gegen Flimmern)
  let i = SCENES.findIndex((s) => t < s.t1);
  if (i < 0) i = SCENES.length - 1;
  const s = SCENES[i], prev = SCENES[Math.max(0, i - 1)];
  const pal = mixPal(prev.pal, s.pal, clamp((t - s.t0 + 0.03) / 0.06));
  drawBg(t, s.pal === DARK ? 0.11 : 0.06, i === 0 ? s.pal : pal);
  renderVertical(t, tf);
}

window.DURATION = DURATION;
window.ready = (async () => {
  await initVertical();
  await Promise.all(['800 200px Geist', '700 100px Geist', '600 30px Geist'].map((f) => document.fonts.load(f)));
  await document.fonts.ready;
  renderFrame(0);
  return true;
})();
window.renderFrame = renderFrame;
window.renderAudio = async () => (await import('./audio-vertical.js')).renderAudio();

window.ready.then(() => {
  if (q.has('t')) renderFrame(Number(q.get('t')));
  else if (q.has('play')) {
    const t0 = performance.now();
    const loop = () => { renderFrame(((performance.now() - t0) / 1000) % (DURATION + 0.5)); requestAnimationFrame(loop); };
    loop();
  }
});
