// Nimmt echte Zustände der App auf (vorher / Hover / nachher) samt Klickzielen.
// Aufruf: node capture.mjs   (App-Dev-Server der Hauptanwendung muss auf :5173 laufen)
// Ergebnis: public/states/*.png (3200×2000) und public/states/states.json (Klickziele in CSS-px, 1600×1000)
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = 'http://localhost:5173/';
const OUT = fileURLToPath(new URL('./public/states/', import.meta.url));
mkdirSync(OUT, { recursive: true });
// Flurstück auf der Karte, das ausgewählt wird (CSS-px im 1600×1000-Fenster)
const PARCEL = { x: Number(process.env.PX ?? 1010), y: Number(process.env.PY ?? 560) };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const targets = {};

await page.goto(APP, { waitUntil: 'networkidle0' });
(await page.waitForSelector('xpath/.//button[contains(., "Musterbetrieb Baden")]')).click();
await page.waitForSelector('.sidebar');
await wait(4500); // Hinweis „Musterbetrieb geladen“ abwarten

async function shot(name) {
  await page.mouse.move(1599, 999); // kein Hover, außer gewollt
  await wait(350);
  await page.screenshot({ path: OUT + name + '.png' });
  console.log('ok', name);
}
async function hoverShot(name, el) {
  const b = await el.boundingBox();
  const c = { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
  await page.mouse.move(c.x, c.y);
  await wait(350);
  await page.screenshot({ path: OUT + name + '.png' });
  console.log('ok', name);
  return c;
}
const byText = (sel, text) => page.waitForSelector(`xpath/.//${sel}[contains(normalize-space(.), "${text}")]`);

/* 1 · Karte: Flurstück anklicken, dann zum Planer */
await page.goto(APP + '#/karte', { waitUntil: 'networkidle0' });
await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 }).catch(() => {});
// eine Stufe hineinzoomen, damit Flurstücke im Video gut erkennbar sind
await page.evaluate(() => document.querySelector('.leaflet-control-zoom-in')?.click());
await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 }).catch(() => {});
await wait(2500);
await shot('map0');
await page.mouse.click(PARCEL.x, PARCEL.y);
targets.parcel = { ...PARCEL };
await wait(1200);
await shot('map1');
// Weiter zum Planer über die Navigation (rechnet mit allen Betriebsflächen)
const navPlanner = await page.waitForSelector('xpath/.//aside//a[contains(normalize-space(.), "Planer")]');
targets.toPlanner = await hoverShot('map2', navPlanner);
await navPlanner.click();

/* 2 · Planer: Empfehlung „Schilf / Reet“ wählen */
await page.waitForSelector('xpath/.//h1[contains(., "Planer")]');
await wait(1500);
await shot('plan0');
const reed = await page.waitForSelector('xpath/(.//*[normalize-space(text())="Schilf / Reet"]/ancestor::*[self::label or self::button][1])[1]');
targets.reed = await hoverShot('plan1', reed);
await reed.click();
await wait(900);
await shot('plan2');

/* 3 · Förderung: Interessenbekundung vorbereiten (nur lokal, keine Übertragung) */
const navFunding = await page.waitForSelector('xpath/.//aside//a[contains(normalize-space(.), "Förderung")]');
targets.toFunding = await hoverShot('plan3', navFunding);
await navFunding.click();
await page.waitForSelector('xpath/.//h1[contains(., "Förderung")]');
await wait(1500);
await shot('fund0');
const prep = await byText('button', 'Interessenbekundung vorbereiten');
targets.prepare = await hoverShot('fund1', prep);
await prep.click();
await wait(1200);
await shot('fund2');
// Lage des Dialogs, damit er im Video aufspringen kann
targets.dialog = await page.evaluate(() => {
  const r = document.querySelector('.modal[role=dialog]').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

writeFileSync(OUT + 'states.json', JSON.stringify(targets, null, 2));
await browser.close();
