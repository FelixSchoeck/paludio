import type { LandUse, Parcel, PlanDraft } from './types';
import { CROPS, type Crop, cropById } from './crops';
import { summarizeFunding, type Capex, type FundingSummary } from './funding';
import { summerDeficitAt } from './moor';

/* ---------- Treibhausgas-Modell (vereinfacht, GEST-Logik) ---------- */

const EMISSION_CURVE: [number, number][] = [
  [-10, 10], [0, 6], [10, 5], [20, 10], [30, 17], [40, 23], [60, 29], [80, 32], [100, 35],
];

/** Netto-THG-Emission organischer Böden in t CO₂-Äq./ha·a in Abhängigkeit vom mittleren Wasserflurabstand (cm) */
export function emissionPerHa(wlCm: number, peatDepthCm = 100, landUse: LandUse = 'gruenland_intensiv'): number {
  const pts = EMISSION_CURVE;
  let e: number;
  if (wlCm <= pts[0][0]) e = pts[0][1];
  else if (wlCm >= pts[pts.length - 1][0]) e = pts[pts.length - 1][1];
  else {
    let i = 0;
    while (wlCm > pts[i + 1][0]) i++;
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    e = y1 + ((wlCm - x1) / (x2 - x1)) * (y2 - y1);
  }
  const adder = landUse === 'acker' ? 3 : landUse === 'brache' ? -2 : 0;
  e += adder * Math.min(1, Math.max(0, (wlCm - 10) / 30));
  const peatFactor = 0.6 + 0.4 * Math.min(1, peatDepthCm / 100);
  return Math.max(0, e * peatFactor);
}

export const emissionCurvePoints = () => {
  const out: [number, number][] = [];
  for (let w = -10; w <= 100; w += 5) out.push([w, emissionPerHa(w)]);
  return out;
};

/** Deckungsbeitrag der heutigen Nutzung (ohne GAP-Basisprämie, die in beiden Varianten gleich bleibt) */
export const BASELINE_DB: Record<LandUse, number> = {
  acker: 520, gruenland_intensiv: 470, gruenland_extensiv: 210, brache: 0,
};

/* ---------- Heutige Nutzung und Wasserstand ---------- */

/**
 * Typische Entwässerungstiefe je Nutzung (Jahresmittel, cm unter Flur) – Planannahme,
 * solange der Betrieb keinen gemessenen Wasserstand eingetragen hat.
 */
export const TYPICAL_WL: Record<LandUse, number> = { acker: 70, gruenland_intensiv: 50, gruenland_extensiv: 35, brache: 25 };
export const DEFAULT_LAND_USE: LandUse = 'gruenland_intensiv';
const notGiven = (s?: string) => !s || s === 'schaetzung' || s === 'modell';

/** Heutige Nutzung: Angabe des Betriebs, sonst die Planannahme */
export function currentUse(p: Parcel, assumed: LandUse = DEFAULT_LAND_USE): LandUse {
  return notGiven(p.sources?.landUse) ? assumed : p.landUse;
}

/** Heutiger Wasserstand: Angabe des Betriebs, sonst typischer Wert für die (angenommene) Nutzung */
export function currentWl(p: Parcel, assumed: LandUse = DEFAULT_LAND_USE): number {
  return notGiven(p.sources?.water) ? TYPICAL_WL[currentUse(p, assumed)] : p.waterLevelCm;
}

/* ---------- Eignung ---------- */

export interface CropFit {
  ok: boolean;
  level: 'gut' | 'bedingt' | 'nein';
  reasons: string[];
}

export function cropFit(crop: Crop, parcels: Parcel[]): CropFit {
  const moor = parcels.filter((p) => p.moorType !== 'mineral');
  const ha = moor.reduce((a, p) => a + p.areaHa, 0);
  if (!ha) return { ok: false, level: 'nein', reasons: ['Keine Moorfläche ausgewählt'] };
  const typeHa = moor.filter((p) => crop.moor.includes(p.moorType)).reduce((a, p) => a + p.areaHa, 0);
  const peatAvg = moor.reduce((a, p) => a + p.peatDepthCm * p.areaHa, 0) / ha;
  const typeLabel = crop.moor.map((m) => (m === 'niedermoor' ? 'Niedermoor' : 'Hochmoor')).join(' und ');
  const reasons: string[] = [];
  let level: CropFit['level'] = 'gut';
  if (typeHa / ha < 0.5) {
    reasons.push(`Nur für ${typeLabel} geeignet`);
    level = 'nein';
  } else if (typeHa / ha < 0.95) {
    reasons.push(`Nur ${Math.round((typeHa / ha) * 100)} % der Fläche sind ${typeLabel}`);
    level = 'bedingt';
  }
  if (peatAvg < crop.minPeatCm) {
    reasons.push(`Torfmächtigkeit Ø ${Math.round(peatAvg)} cm, benötigt mindestens ${crop.minPeatCm} cm`);
    level = 'nein';
  }
  if (ha < crop.minAreaHa) {
    // Unter der Mindestgröße ist das Verfahren nicht wirtschaftlich bzw. nicht umsetzbar
    reasons.push(`Mindestens ${crop.minAreaHa} ha nötig, Ihre Moorfläche: ${ha.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ha`);
    level = 'nein';
  }
  return { ok: level !== 'nein', level, reasons: reasons.length ? reasons : [`${typeLabel}, Ø ${Math.round(peatAvg)} cm Torf, ${ha.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ha`] };
}

/* ---------- Plan-Berechnung ---------- */

export interface YearRow {
  year: number;
  revenue: number;
  varCost: number;
  certificates: number;
  certCost: number;
  premiums: number;
  grants: number;
  capex: number;
  baselineLoss: number;
  net: number;
  delta: number;
  cumNet: number;
  cumDelta: number;
  avoidedT: number;
}

export interface PlanResult {
  hasMoor: boolean;
  parcels: Parcel[];
  areaHa: number;
  moorHa: number;
  mineralHa: number;
  crop: Crop;
  targetWl: number;
  /** Planannahme für die heutige Nutzung von Flurstücken ohne Angabe */
  assumedLandUse: LandUse;
  yieldFactor: number;
  deficitMm: number;
  fit: CropFit;
  emissions: { baselinePerHa: number; scenarioPerHa: number; baselineT: number; scenarioT: number; avoidedT: number };
  baselineDb: number;
  capex: Capex & { perHa: number; ditchLenM: number; weirs: number; dikeM: number };
  funding: FundingSummary;
  rows: YearRow[];
  kpis: {
    fullRevenue: number;
    fullVarCost: number;
    fullCropDb: number;
    fullCertNet: number;
    steadyNet: number;
    steadyDelta: number;
    npv: number;
    payback: number | null;
    labourHours: number;
    grantShare: number;
  };
}

export const eur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

function waterworksCost(moorHa: number, hochmoorShare: number, targetWl: number, deficit: number) {
  const base = targetWl <= 10 ? 3200 : 1600;
  const size = moorHa >= 20 ? 0.85 : moorHa >= 8 ? 1 : moorHa >= 3 ? 1.15 : 1.3;
  const perHa = (base + 1200 * hochmoorShare + Math.max(0, deficit) * 2.5) * size;
  return perHa * moorHa;
}

export function analyze(parcels: Parcel[], draft: PlanDraft, cropOverride?: string): PlanResult {
  const crop = cropById(cropOverride ?? draft.cropId) ?? CROPS[0];
  const moorParcels = parcels.filter((p) => p.moorType !== 'mineral');
  const moorHa = moorParcels.reduce((a, p) => a + p.areaHa, 0);
  const areaHa = parcels.reduce((a, p) => a + p.areaHa, 0);
  const hochHa = moorParcels.filter((p) => p.moorType === 'hochmoor').reduce((a, p) => a + p.areaHa, 0);
  const hochmoorShare = moorHa ? hochHa / moorHa : 0;
  const targetWl = draft.targetWlCm ?? crop.waterLevelCm;
  const deficit = moorHa
    ? moorParcels.reduce((a, p) => a + summerDeficitAt(p.centroid) * p.areaHa, 0) / moorHa
    : 0;
  const dev = Math.abs(targetWl - crop.waterLevelCm);
  const wlFactor = Math.max(0.4, 1 - 0.015 * Math.max(0, dev - 8));
  const deficitFactor = 1 - (Math.min(Math.max(deficit, 0), 200) / 200) * 0.15;
  const yieldFactor = wlFactor * deficitFactor;

  // Emissionen
  let baseT = 0;
  let scenT = 0;
  for (const p of moorParcels) {
    const use = currentUse(p, draft.assumedLandUse);
    baseT += emissionPerHa(currentWl(p, draft.assumedLandUse), p.peatDepthCm, use) * p.areaHa;
    scenT += emissionPerHa(targetWl, p.peatDepthCm, use) * p.areaHa;
  }
  const avoidedT = Math.max(0, baseT - scenT);

  // Investition
  const waterworks = waterworksCost(moorHa, hochmoorShare, targetWl, deficit);
  const planning = moorHa ? 4500 + 350 * moorHa : 0;
  const establishment = crop.establishmentPerHa * moorHa;
  const total = waterworks + planning + establishment;
  const ditchLenM = (moorHa * 10000) / 60;
  const capex = {
    planning, waterworks, establishment, total,
    perHa: moorHa ? total / moorHa : 0,
    ditchLenM,
    weirs: moorHa ? Math.max(2, Math.round(ditchLenM / 300)) : 0,
    dikeM: targetWl <= 10 && moorHa ? Math.round(4 * Math.sqrt(moorHa * 10000) * 1.1) : 0,
  };

  const baselineDb = parcels.reduce((a, p) => a + (p.moorType !== 'mineral' ? BASELINE_DB[currentUse(p, draft.assumedLandUse)] * p.areaHa : 0), 0);
  const states = [...new Set(parcels.map((p) => p.bundesland))];
  const funding = summarizeFunding({ states, areaHa, moorHa, crop, targetWlCm: targetWl, capex, baselineDb });
  const grants = draft.useFunding ? funding.oneTime : 0;
  const premiumAnnual = draft.useFunding ? funding.annual : 0;
  const premiumYears = draft.useFunding ? funding.annualYears : 0;

  const rows: YearRow[] = [];
  let cumNet = 0;
  let cumDelta = 0;
  for (let y = 0; y <= draft.horizonYears; y++) {
    let r: YearRow;
    if (y === 0) {
      r = {
        year: 0, revenue: 0, varCost: 0, certificates: 0, certCost: 0, premiums: 0, grants: 0,
        capex: total, baselineLoss: 0, net: -total, delta: -total, cumNet: 0, cumDelta: 0, avoidedT: 0,
      };
    } else {
      const ramp = crop.ramp[Math.min(y - 1, crop.ramp.length - 1)];
      const revenue = moorHa * crop.yieldPerHa * crop.pricePerUnit * ramp * yieldFactor;
      const varCost = moorHa * crop.varCostPerHa * Math.max(ramp, 0.35);
      const avoided = y === 1 ? avoidedT * 0.5 : avoidedT;
      const certGross = draft.sellCertificates && y >= 2 ? avoided * draft.co2Price * 0.8 : 0;
      const certCost = certGross > 0 ? 800 + certGross * 0.12 : 0;
      const premiums = y <= premiumYears ? premiumAnnual : 0;
      const grantsY = y === 1 ? grants : 0;
      const net = revenue - varCost + certGross - certCost + premiums + grantsY;
      r = {
        year: y, revenue, varCost, certificates: certGross, certCost, premiums, grants: grantsY, capex: 0,
        baselineLoss: baselineDb, net, delta: net - baselineDb, cumNet: 0, cumDelta: 0, avoidedT: avoided,
      };
    }
    cumNet += r.net;
    cumDelta += r.delta;
    r.cumNet = cumNet;
    r.cumDelta = cumDelta;
    rows.push(r);
  }

  let npv = 0;
  rows.forEach((r) => (npv += r.delta / Math.pow(1 + draft.discountRate, r.year)));
  let payback: number | null = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].cumDelta >= 0) {
      const prev = rows[i - 1].cumDelta;
      payback = i - 1 + (0 - prev) / (rows[i].cumDelta - prev);
      break;
    }
  }

  const fullRevenue = moorHa * crop.yieldPerHa * crop.pricePerUnit * yieldFactor;
  const fullVarCost = moorHa * crop.varCostPerHa;
  const fullCertGross = draft.sellCertificates ? avoidedT * draft.co2Price * 0.8 : 0;
  const fullCertNet = fullCertGross > 0 ? fullCertGross - 800 - fullCertGross * 0.12 : 0;
  const steady = rows[Math.min(rows.length - 1, Math.max(1, Math.min(draft.horizonYears, 12)))];

  return {
    hasMoor: moorHa > 0,
    assumedLandUse: draft.assumedLandUse ?? DEFAULT_LAND_USE,
    parcels,
    areaHa, moorHa, mineralHa: areaHa - moorHa,
    crop, targetWl, yieldFactor, deficitMm: deficit,
    fit: cropFit(crop, parcels),
    emissions: {
      baselinePerHa: moorHa ? baseT / moorHa : 0,
      scenarioPerHa: moorHa ? scenT / moorHa : 0,
      baselineT: baseT, scenarioT: scenT, avoidedT,
    },
    baselineDb,
    capex, funding, rows,
    kpis: {
      fullRevenue, fullVarCost,
      fullCropDb: fullRevenue - fullVarCost,
      fullCertNet,
      steadyNet: steady?.net ?? 0,
      steadyDelta: steady?.delta ?? 0,
      npv, payback,
      labourHours: moorHa * crop.labourHoursPerHa,
      grantShare: total ? grants / total : 0,
    },
  };
}

export function rankCrops(parcels: Parcel[], draft: PlanDraft) {
  return CROPS.map((c) => {
    const d = { ...draft, cropId: c.id, targetWlCm: null };
    return analyze(parcels, d, c.id);
  }).sort((a, b) => {
    if (a.fit.ok !== b.fit.ok) return a.fit.ok ? -1 : 1;
    return b.kpis.npv - a.kpis.npv;
  });
}

/* ---------- Empfehlung ---------- */

export interface CropOption {
  res: PlanResult;
  crop: Crop;
  fit: CropFit;
  /** Umsetzbarkeit 0–1: Reifegrad, Marktrisiko, Eignung und besondere Hürden */
  feasibility: number;
  feasibilityLabel: 'hoch' | 'mittel' | 'gering';
  /** Kapitalwert gewichtet mit der Umsetzbarkeit */
  expected: number;
  pros: string[];
  cons: string[];
  recommended: boolean;
  highestNpv: boolean;
}

const MATURITY_FACTOR: Record<Crop['maturity'], number> = { etabliert: 1, Pilot: 0.8, Forschung: 0.6 };
const MARKET_FACTOR: Record<Crop['marketRisk'], number> = { 1: 1, 2: 0.9, 3: 0.75 };
/** Zusätzliche Hürden, die über Reifegrad und Markt hinausgehen */
const SPECIAL: Record<string, { factor: number; note: string }> = {
  moor_pv: {
    factor: 0.6,
    note: 'Nur mit Projektierer, Bebauungsplan, Netzanschluss und EEG-Zuschlag; nicht in Schutzgebieten. Die EEG-Novelle 2027 soll die Moor-PV-Sonderregeln streichen.',
  },
};

const eurShort = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio. €` : eur(v));

/**
 * Bewertet alle Nutzungen und begründet die Empfehlung.
 * Reihenfolge: geeignete Optionen nach Kapitalwert × Umsetzbarkeit, ungeeignete zuletzt.
 */
export function recommendCrops(parcels: Parcel[], draft: PlanDraft): CropOption[] {
  const options: CropOption[] = CROPS.map((crop) => {
    const res = analyze(parcels, { ...draft, cropId: crop.id, targetWlCm: null }, crop.id);
    const fit = res.fit;
    const special = SPECIAL[crop.id];
    const feasibility = fit.ok
      ? MATURITY_FACTOR[crop.maturity] * MARKET_FACTOR[crop.marketRisk] * (fit.level === 'bedingt' ? 0.85 : 1) * (special?.factor ?? 1)
      : 0;
    const npv = res.kpis.npv;
    const expected = !fit.ok ? -Infinity : npv >= 0 ? npv * feasibility : npv / Math.max(feasibility, 0.1);

    const pros: string[] = [];
    const cons: string[] = [];
    if (!fit.ok) cons.push(...fit.reasons);
    else if (fit.level === 'bedingt') cons.push(...fit.reasons);
    else pros.push(`Standort passt: ${fit.reasons[0]}`);

    const wl = res.targetWl;
    const stufe = wl <= 10 ? 1 : wl <= 20 ? 2 : null;
    if (crop.id === 'moor_pv') cons.push('Kein Palu-Ausgleich für Wert- und Ertragsverlust bei PV-Flächen, nur Beratung und Planung');
    else if (stufe) pros.push(`Zielwasserstand ${wl} cm unter Flur: Vernässungsstufe ${stufe}, Ausgleich nach Palu möglich`);
    else cons.push(`Zielwasserstand ${wl} cm: für Palu zu trocken (höchstens 20 cm) – kein Ausgleich, höhere Emissionen`);

    if (crop.maturity === 'etabliert') pros.push(crop.marketRisk === 1 ? 'Etabliertes Verfahren mit bestehendem Absatzmarkt' : 'Etabliertes Verfahren');
    else if (crop.maturity === 'Pilot') cons.push(crop.id === 'moor_pv' ? 'Pilotstadium: bisher nur wenige Moor-PV-Anlagen in Betrieb' : 'Pilotstadium: Technik und Abnehmer noch im Aufbau');
    else cons.push('Forschungsstadium: Erträge und Preise noch unsicher');
    if (crop.marketRisk === 3) cons.push('Marktpreis noch nicht etabliert');
    if (special) cons.push(special.note);

    if (npv < 0) cons.push(`Kapitalwert negativ (${eurShort(npv)}) über ${draft.horizonYears} Jahre`);
    if (res.kpis.payback == null) cons.push(`Keine Amortisation innerhalb von ${draft.horizonYears} Jahren`);
    else if (res.kpis.payback <= 8) pros.push(`Amortisation nach ${res.kpis.payback.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Jahren`);
    else if (res.kpis.payback > 15) cons.push(`Lange Kapitalbindung: Amortisation erst nach ${Math.round(res.kpis.payback)} Jahren`);

    if (res.emissions.avoidedT > 0) pros.push(`Spart ${Math.round(res.emissions.avoidedT).toLocaleString('de-DE')} t CO₂e pro Jahr`);
    if (res.funding.oneTime > 0) {
      const parts = new Set(res.funding.chosen.flatMap((m) => m.program.covers ?? []));
      const label = [parts.has('planning') && 'Planung', parts.has('waterworks') && 'Wasserbau', parts.has('establishment') && 'Etablierung'].filter(Boolean).join(', ');
      pros.push(`${eurShort(res.funding.oneTime)} Zuschuss möglich${label ? ` (${label})` : ''}`);
    }

    return {
      res, crop, fit, feasibility,
      feasibilityLabel: feasibility >= 0.85 ? 'hoch' : feasibility >= 0.65 ? 'mittel' : 'gering',
      expected, pros, cons, recommended: false, highestNpv: false,
    };
  });

  options.sort((a, b) => (a.fit.ok !== b.fit.ok ? (a.fit.ok ? -1 : 1) : b.expected - a.expected));
  const first = options.find((o) => o.fit.ok);
  if (first) first.recommended = true;
  const maxNpv = options.filter((o) => o.fit.ok).sort((a, b) => b.res.kpis.npv - a.res.kpis.npv)[0];
  if (maxNpv) maxNpv.highestNpv = true;
  return options;
}

export const defaultDraft = (): PlanDraft => ({
  parcelIds: [],
  cropId: 'rohrkolben',
  targetWlCm: null,
  co2Price: 65,
  sellCertificates: true,
  useFunding: true,
  horizonYears: 20,
  discountRate: 0.03,
});
