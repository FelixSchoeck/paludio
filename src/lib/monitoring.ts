import type { Application, Listing, Machine, Project } from './types';
import type { PlanResult } from './calc';
import { emissionPerHa } from './calc';
import { hash32, haversineKm, rngFrom } from './geo';

/* ---------- Projektphasen ---------- */

export type PhaseId = 'planung' | 'genehmigung' | 'bau' | 'etablierung' | 'betrieb';

export const PHASES: { id: PhaseId; label: string; short: string; startMonth: number }[] = [
  { id: 'planung', label: 'Planung & Förderung', short: 'Planung', startMonth: 0 },
  { id: 'genehmigung', label: 'Genehmigung', short: 'Genehmigung', startMonth: 2 },
  { id: 'bau', label: 'Wasserbau', short: 'Bau', startMonth: 7 },
  { id: 'etablierung', label: 'Etablierung', short: 'Etablierung', startMonth: 9 },
  { id: 'betrieb', label: 'Regelbetrieb', short: 'Betrieb', startMonth: 9 + 18 },
];

export const BUILD_END_MONTH = 9;

export function phaseAt(month: number): (typeof PHASES)[number] {
  let cur = PHASES[0];
  for (const p of PHASES) if (month >= p.startMonth) cur = p;
  return cur;
}

export const TASKS: { id: string; phase: PhaseId; label: string }[] = [
  { id: 'p1', phase: 'planung', label: 'Standortanalyse und Wirtschaftlichkeitsplan erstellen' },
  { id: 'p2', phase: 'planung', label: 'Einigung mit Eigentümern/Verpächtern (Wasserstandsanhebung)' },
  { id: 'p3', phase: 'planung', label: 'Erstberatung Wasserbehörde und Moorschutzberatung' },
  { id: 'p4', phase: 'planung', label: 'Förderantrag einreichen' },
  { id: 'g1', phase: 'genehmigung', label: 'Wasserrechtliche Zulassung beantragen' },
  { id: 'g2', phase: 'genehmigung', label: 'Naturschutzrechtliche Prüfung abstimmen' },
  { id: 'g3', phase: 'genehmigung', label: 'Anlieger und Nachbarflächen über Wasserstände informieren' },
  { id: 'g4', phase: 'genehmigung', label: 'Förderbescheid erhalten und Bauauftrag vergeben' },
  { id: 'b1', phase: 'bau', label: 'Wasserbau-Maschinen im Maschinenmarkt buchen' },
  { id: 'b2', phase: 'bau', label: 'Staue, Grabenverschlüsse und Verwallungen errichten' },
  { id: 'b3', phase: 'bau', label: 'Pegel und Wasserstandslogger installieren' },
  { id: 'b4', phase: 'bau', label: 'Bauabnahme und Fotodokumentation' },
  { id: 'e1', phase: 'etablierung', label: 'Pflanzung bzw. Ansaat der Paludikultur' },
  { id: 'e2', phase: 'etablierung', label: 'Wasserstände wöchentlich kontrollieren' },
  { id: 'e3', phase: 'etablierung', label: 'Verwendungsnachweis für die Förderung einreichen' },
  { id: 'e4', phase: 'etablierung', label: 'Abnahmeverträge im Produktmarkt abschließen' },
  { id: 'o1', phase: 'betrieb', label: 'Jahresernte planen und Erntetechnik reservieren' },
  { id: 'o2', phase: 'betrieb', label: 'Wasserstandsprotokoll für Förderstelle exportieren' },
  { id: 'o3', phase: 'betrieb', label: 'Zertifikats-Monitoring und Verkauf prüfen' },
  { id: 'o4', phase: 'betrieb', label: 'Gräben, Staue und Wege instand halten' },
];

export function dateAtMonth(startDate: string, month: number): Date {
  const d = new Date(startDate + 'T00:00:00');
  d.setMonth(d.getMonth() + Math.floor(month));
  d.setDate(d.getDate() + Math.round((month % 1) * 30));
  return d;
}

/* ---------- Sensorsimulation ---------- */

export interface SimParams {
  seed: number;
  wl0: number;
  target: number;
  deficit: number;
  startDate: string;
}

export interface DayPoint {
  day: number; // Tage seit Projektstart
  date: Date;
  wl: number;
  rain: number;
}

const DAY_MS = 86400000;

function rainOn(seed: number, absDay: number, month: number): number {
  const r = rngFrom(hash32(seed, absDay, 3));
  const wet = [0.45, 0.4, 0.38, 0.33, 0.33, 0.35, 0.38, 0.36, 0.34, 0.4, 0.45, 0.47][month];
  if (r() > wet) return 0;
  return Math.round(-Math.log(1 - r() * 0.98) * 7 * 10) / 10;
}

/** Tagesgenaue Simulation von Wasserstand (cm unter Flur) und Niederschlag */
export function simulate(p: SimParams, fromDay: number, toDay: number): DayPoint[] {
  const start = new Date(p.startDate + 'T00:00:00').getTime();
  const out: DayPoint[] = [];
  const warm = 10;
  const rains: number[] = [];
  for (let d = fromDay - warm; d <= toDay; d++) {
    const date = new Date(start + d * DAY_MS);
    rains.push(rainOn(p.seed, Math.floor((start + d * DAY_MS) / DAY_MS), date.getMonth()));
  }
  for (let d = fromDay; d <= toDay; d++) {
    const date = new Date(start + d * DAY_MS);
    const idx = d - fromDay + warm;
    const monthF = d / 30.4;
    const prog = Math.min(1, Math.max(0, (monthF - BUILD_END_MONTH) / 3));
    const mean = p.wl0 + (p.target - p.wl0) * prog;
    const doy = (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / DAY_MS;
    const season = Math.cos((2 * Math.PI * (doy - 225)) / 365);
    const amp = (6 + Math.max(0, p.deficit) / 18) * (1.5 - 0.5 * prog);
    let rain7 = 0;
    for (let k = 0; k < 7; k++) rain7 += rains[idx - k];
    const rainEffect = Math.min(14, rain7 * 0.28) * (1 - 0.4 * prog);
    const noise = (hash32(p.seed, d, 9) / 4294967296 - 0.5) * 1.6;
    let wl = mean + amp * season - rainEffect + noise;
    wl = Math.max(-12, Math.min(140, wl));
    out.push({ day: d, date, wl, rain: rains[idx] });
  }
  return out;
}

export interface MonthlyRow {
  month: number;
  date: Date;
  wl: number;
  rain: number;
  avoidedT: number;
  revenue: number;
  cost: number;
  grants: number;
  certificates: number;
  net: number;
}

const WEATHER = (seed: number, opYear: number) => 0.85 + 0.3 * (hash32(seed, opYear, 41) / 4294967296);

export function simSeed(project: Project): number {
  return hash32(...[...project.id].map((c) => c.charCodeAt(0)));
}

export function simParams(project: Project, plan: PlanResult): SimParams {
  const moor = plan.parcels.filter((p) => p.moorType !== 'mineral');
  const ha = moor.reduce((a, p) => a + p.areaHa, 0) || 1;
  const wl0 = moor.reduce((a, p) => a + p.waterLevelCm * p.areaHa, 0) / ha || 50;
  return { seed: simSeed(project), wl0, target: plan.targetWl, deficit: plan.deficitMm, startDate: project.startDate };
}

/** Monatliche Kennzahlen bis einschließlich `upToMonth` */
export function monthlyStats(project: Project, plan: PlanResult, draftSell: boolean, upToMonth: number): MonthlyRow[] {
  const sp = simParams(project, plan);
  const rows: MonthlyRow[] = [];
  const crop = plan.crop;
  const e0 = emissionPerHa(sp.wl0, 120) || 1;
  const days = simulate(sp, 0, Math.ceil(upToMonth * 30.4) + 30);
  const baseMonthT = plan.emissions.baselineT / 12;
  const capexPlanning = plan.capex.planning;
  const capexRest = plan.capex.total - capexPlanning;
  const harvests = crop.harvestMonths;
  for (let m = 0; m <= upToMonth; m++) {
    const date = dateAtMonth(project.startDate, m);
    const slice = days.filter((d) => d.day >= m * 30.4 && d.day < (m + 1) * 30.4);
    const wl = slice.length ? slice.reduce((a, d) => a + d.wl, 0) / slice.length : sp.wl0;
    const rain = slice.reduce((a, d) => a + d.rain, 0);
    const ratio = Math.max(0, emissionPerHa(wl, 120) / e0);
    const avoidedT = Math.max(0, baseMonthT * (1 - ratio));
    let revenue = 0;
    let cost = 0;
    let grants = 0;
    let certificates = 0;
    if (m === 1) cost += capexPlanning;
    if (m === 7 || m === 8) cost += (capexRest * 0.5);
    if (m === BUILD_END_MONTH + 2) grants += plan.rows[1]?.grants ?? 0;
    if (m >= BUILD_END_MONTH) {
      const opMonth = m - BUILD_END_MONTH;
      const opYear = Math.floor(opMonth / 12) + 1;
      const row = plan.rows[Math.min(opYear, plan.rows.length - 1)];
      const calMonth = date.getMonth() + 1;
      const w = WEATHER(sp.seed, opYear);
      if (crop.id === 'moor_pv') revenue += row.revenue / 12;
      else if (harvests.includes(calMonth)) revenue += (row.revenue * w) / harvests.length;
      cost += row.varCost / 12;
      if (calMonth === 12) certificates += row.certificates - row.certCost;
      if (calMonth === 6) grants += row.premiums;
    }
    if (!draftSell) certificates = 0;
    rows.push({ month: m, date, wl, rain, avoidedT, revenue, cost, grants, certificates, net: revenue + grants + certificates - cost });
  }
  return rows;
}

export function yieldByYear(project: Project, plan: PlanResult, upToMonth: number) {
  const sp = simParams(project, plan);
  const out: { year: number; planned: number; actual: number | null }[] = [];
  const maxYear = Math.max(1, Math.min(8, Math.floor((upToMonth - BUILD_END_MONTH) / 12) + 2));
  for (let y = 1; y <= maxYear + 1 && y <= 8; y++) {
    const row = plan.rows[Math.min(y, plan.rows.length - 1)];
    const planned = row.revenue;
    const opEnd = BUILD_END_MONTH + y * 12;
    out.push({ year: y, planned, actual: upToMonth >= opEnd ? planned * WEATHER(sp.seed, y) : null });
  }
  return out;
}

/* ---------- Empfehlungen ---------- */

export type RecoLevel = 'kritisch' | 'wichtig' | 'hinweis' | 'positiv';

export interface Reco {
  id: string;
  level: RecoLevel;
  title: string;
  text: string;
  cta?: { label: string; to: string };
}

export interface RecoContext {
  project: Project;
  plan: PlanResult;
  month: number;
  date: Date;
  wlNow: number;
  inBandShare: number;
  applications: Application[];
  machines: Machine[];
  listings: Listing[];
  farmLocation: [number, number];
}

export function recommend(c: RecoContext): Reco[] {
  const out: Reco[] = [];
  const { month, plan, date } = c;
  const phase = phaseAt(month);
  const calMonth = date.getMonth() + 1;
  const crop = plan.crop;
  const target = plan.targetWl;
  const summer = calMonth >= 5 && calMonth <= 9;
  const submitted = c.applications.some((a) => a.status === 'eingereicht' || a.status === 'bewilligt');
  const fmt = (n: number) => Math.round(n).toLocaleString('de-DE');

  if (phase.id === 'planung') {
    if (!submitted)
      out.push({ id: 'r-foerder', level: 'wichtig', title: 'Förderantrag vorbereiten', text: `Für Ihr Vorhaben (${plan.moorHa.toFixed(1)} ha Moor) passen ${plan.funding.chosen.length} Programme mit bis zu ${fmt(plan.funding.oneTime)} € einmalig und ${fmt(plan.funding.annual)} € pro Jahr. Anträge müssen vor Maßnahmenbeginn gestellt werden.`, cta: { label: 'Zu den Förderungen', to: '/foerderung' } });
    else out.push({ id: 'r-foerder-ok', level: 'positiv', title: 'Förderantrag eingereicht', text: 'Ihr Antrag wird bearbeitet. Mit der Maßnahme darf erst nach Bewilligung oder Genehmigung des vorzeitigen Maßnahmenbeginns gestartet werden.' });
    out.push({ id: 'r-berat', level: 'hinweis', title: 'Erstberatung nutzen', text: 'Die kostenfreie Moorschutz-Erstberatung klärt Wasserrecht, Nachbarbetroffenheit und Förderfähigkeit, bevor Sie Kosten auslösen.' });
  }
  if (phase.id === 'genehmigung') {
    out.push({ id: 'r-wasser', level: 'wichtig', title: 'Wasserrechtliche Zulassung vorantreiben', text: 'Für Staue und Wasserstandsanhebung ist meist eine wasserrechtliche Zulassung nötig. Planen Sie 3–6 Monate Bearbeitungszeit ein und binden Sie Nachbarn und Wasser- und Bodenverband frühzeitig ein.' });
    if (plan.deficitMm > 90)
      out.push({ id: 'r-water-supply', level: 'hinweis', title: 'Wasserverfügbarkeit klären', text: `In Ihrer Region liegt das Sommer-Wasserdefizit bei ca. ${fmt(plan.deficitMm)} mm. Prüfen Sie Zuleitungen und Speicherpolder, damit der Zielwasserstand im Sommer gehalten werden kann.` });
  }
  if (phase.id === 'bau') {
    const near = c.machines.filter((m) => m.category === 'wasserbau' && haversineKm(c.farmLocation, m.location) <= 150).length;
    out.push({ id: 'r-bau', level: 'wichtig', title: 'Wasserbau-Maschinen reservieren', text: `Der Bau startet in der trockenen Jahreszeit. ${near} Wasserbau-Maschinen sind im Umkreis von 150 km verfügbar. Rechnen Sie mit ca. ${plan.capex.weirs} Stauen und ${fmt(plan.capex.ditchLenM)} m Graben.`, cta: { label: 'Maschinenmarkt öffnen', to: '/maschinen?cat=wasserbau' } });
    out.push({ id: 'r-pegel', level: 'hinweis', title: 'Pegel für Monitoring mitplanen', text: 'Installieren Sie bereits beim Bau mindestens 3 Pegel. Die Daten sind Grundlage für Förderung und Zertifikate.', cta: { label: 'Monitoring-Set leihen', to: '/maschinen?cat=monitoring' } });
  }

  if (month > BUILD_END_MONTH) {
    const diff = c.wlNow - target;
    if (summer && diff > 12)
      out.push({ id: 'r-dry', level: diff > 22 ? 'kritisch' : 'wichtig', title: `Wasserstand ${fmt(diff)} cm unter Ziel`, text: `Aktuell ${fmt(c.wlNow)} cm unter Flur (Ziel: ${fmt(target)} cm). Stauklappen schließen, Zuleitung prüfen und gegebenenfalls Zusatzwasser aus dem Speicherpolder zuführen. Anhaltende Trockenheit gefährdet Ertrag und Zertifikatsanspruch.` });
    else if (diff < -12)
      out.push({ id: 'r-wet', level: 'hinweis', title: 'Fläche überstaut – Befahrbarkeit eingeschränkt', text: 'Der Wasserstand liegt deutlich über Ziel. Planen Sie Pflege- oder Erntearbeiten mit Raupenfahrzeug mit geringem Bodendruck statt Traktor.', cta: { label: 'Raupenfahrzeuge ansehen', to: '/maschinen?cat=raupe-maehen' } });
    if (c.inBandShare >= 0.85)
      out.push({ id: 'r-good', level: 'positiv', title: 'Zielwasserstand stabil gehalten', text: `In den letzten 30 Tagen lagen ${Math.round(c.inBandShare * 100)} % der Messtage im Zielkorridor. Das sichert Klimawirkung und Förderanspruch.` });
    if (summer && plan.deficitMm > 100 && diff <= 12)
      out.push({ id: 'r-drought', level: 'hinweis', title: 'Trockenjahr-Risiko beobachten', text: 'In Ihrer Region sind sommerliche Wasserdefizite häufig. Halten Sie den Wasserstand im Frühjahr hoch, um den Sommer abzupuffern.' });
  }

  if (month >= BUILD_END_MONTH && crop.harvestMonths.length) {
    let daysToHarvest = Infinity;
    for (let i = 0; i < 365; i += 5) {
      const d = new Date(date.getTime() + i * 86400000);
      if (crop.harvestMonths.includes(d.getMonth() + 1)) {
        daysToHarvest = i;
        break;
      }
    }
    const opYear = Math.floor((month - BUILD_END_MONTH) / 12) + 1;
    const ramp = crop.ramp[Math.min(opYear - 1, crop.ramp.length - 1)];
    if (daysToHarvest <= 70 && ramp > 0) {
      const cats = crop.machineCategories[0] ?? 'raupe-maehen';
      const avail = c.machines.filter((m) => crop.machineCategories.includes(m.category) && haversineKm(c.farmLocation, m.location) <= 150).length;
      out.push({ id: 'r-harvest', level: daysToHarvest === 0 ? 'wichtig' : 'hinweis', title: daysToHarvest === 0 ? 'Erntefenster ist offen' : `Erntefenster in ca. ${daysToHarvest} Tagen`, text: `Passende Erntetechnik ist knapp. ${avail} Maschinen im Umkreis von 150 km. Frühzeitig buchen, bevor die Hochphase beginnt.`, cta: { label: 'Erntetechnik buchen', to: `/maschinen?cat=${cats}` } });
      const demand = c.listings.filter((l) => l.type === 'gesuch' && l.cropId === crop.id);
      const qty = demand.reduce((a, l) => a + l.quantity, 0);
      if (demand.length)
        out.push({ id: 'r-sell', level: 'hinweis', title: `${demand.length} Abnehmer-Gesuche passen zu Ihrer Ernte`, text: `Gesamtnachfrage ${fmt(qty)} ${demand[0].unit}. Sichern Sie Ihre Ernte vorab über Liefervereinbarungen.`, cta: { label: 'Zum Produktmarkt', to: `/produkte?tab=gesuch&cat=${crop.productCategory}` } });
    }
  }
  if (phase.id === 'etablierung' && month - BUILD_END_MONTH <= 6 && ['rohrkolben', 'schilf', 'erle', 'torfmoos'].includes(crop.id))
    out.push({ id: 'r-etab', level: 'wichtig', title: 'Etablierung überwachen', text: 'In den ersten Monaten entscheidet gleichmäßiger Wasserstand über den Anwuchserfolg. Kontrollieren Sie Bestände auf Lücken, Wildverbiss und Fremdbewuchs.' });
  if (month >= BUILD_END_MONTH + 2 && month <= BUILD_END_MONTH + 8)
    out.push({ id: 'r-vwn', level: 'wichtig', title: 'Verwendungsnachweis vorbereiten', text: 'Nach Bauabschluss verlangt die Förderstelle Rechnungen, Fotodokumentation und Wasserstandsdaten. Paludio erstellt das Protokoll automatisch aus Ihren Pegeldaten.' });
  if (month >= BUILD_END_MONTH + 12 && calMonth === 11)
    out.push({ id: 'r-cert', level: 'hinweis', title: 'Jahresabschluss für Moor-Zertifikate', text: 'Vor Jahresende sollten Messdaten validiert und Zertifikate verkauft werden. Aktuell sind im Produktmarkt Käufergesuche aktiv.', cta: { label: 'Zertifikat-Gesuche', to: '/produkte?tab=gesuch&cat=zertifikat' } });

  const order: Record<RecoLevel, number> = { kritisch: 0, wichtig: 1, hinweis: 2, positiv: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
