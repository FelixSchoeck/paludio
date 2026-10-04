import type { BL } from './types';
import type { Crop } from './crops';
import { BUNDESLAENDER } from './geo';

/**
 * Förderkatalog (Prototyp).
 *
 * WICHTIG: Programme, Sätze und Fristen sind im Prototyp *illustrativ* modelliert und orientieren sich an real
 * existierenden Förderlogiken (EU-GAP, Bund, Länder, Rentenbank). Vor einem echten Antrag müssen Konditionen
 * bei der zuständigen Stelle verifiziert werden. Die Pflege des Katalogs würde in der Produktivversion über
 * ein Redaktionssystem bzw. eine Förderdatenbank erfolgen.
 */

export type FundingKind = 'investition' | 'flaeche' | 'kredit' | 'beratung' | 'info';
export type FundingProvider = 'EU' | 'Bund' | 'Land' | 'Bank';

export interface FundingProgram {
  id: string;
  name: string;
  provider: FundingProvider;
  states: BL[] | 'ALL';
  kind: FundingKind;
  summary: string;
  /** Fördersatz auf die förderfähigen Investitionskosten */
  rate?: number;
  capPerHa?: number;
  capTotal?: number;
  coversEstablishment?: boolean;
  /** Prämie pro ha Moorfläche und Jahr */
  annualPerHa?: number;
  years?: number;
  group?: string;
  requires: {
    moor?: boolean;
    minPeatCm?: number;
    minHa?: number;
    maxWlCm?: number;
    crops?: string[];
    minWlCm?: number;
  };
  deadline: string;
  authority: string;
  docs: string[];
  effort: 'niedrig' | 'mittel' | 'hoch';
  url: string;
  applicable: boolean;
}

const DOC = {
  flurstueck: 'Flurstücksnachweis (automatisch aus Paludio)',
  plan: 'Maßnahmen- & Zeitplan (automatisch aus Paludio)',
  pacht: 'Eigentums- bzw. Pachtnachweis',
  zustimmung: 'Zustimmung des Eigentümers (bei Pachtflächen)',
  wasser: 'Wasserrechtliche Zulassung / Stellungnahme Wasserbehörde',
  kosten: 'Kostenvoranschläge (mind. 2 Angebote)',
  natur: 'Naturschutzfachliche Stellungnahme (untere Naturschutzbehörde)',
  betrieb: 'Betriebsnummer / Registriernummer',
};

const mk = (p: Partial<FundingProgram> & Pick<FundingProgram, 'id' | 'name' | 'provider' | 'kind' | 'summary'>): FundingProgram => ({
  states: 'ALL',
  requires: {},
  deadline: 'laufend',
  authority: 'zuständige Landesbehörde',
  docs: [DOC.flurstueck, DOC.plan, DOC.betrieb],
  effort: 'mittel',
  url: '#',
  applicable: true,
  ...p,
});

const landProgram = (
  bl: BL, name: string, authority: string, deadline: string,
  inv: { rate: number; capPerHa: number } | null, annual: { perHa: number; years: number } | null,
  summary: string, effort: 'niedrig' | 'mittel' | 'hoch' = 'mittel',
): FundingProgram[] => {
  const list: FundingProgram[] = [];
  if (inv)
    list.push(mk({
      id: `${bl.toLowerCase()}_invest`, name: `${BUNDESLAENDER[bl].name}: ${name} – Wasserbau`, provider: 'Land', states: [bl], kind: 'investition',
      rate: inv.rate, capPerHa: inv.capPerHa, coversEstablishment: false, group: 'invest',
      requires: { moor: true, minHa: 1 }, authority, deadline, effort,
      docs: [DOC.flurstueck, DOC.plan, DOC.betrieb, DOC.pacht, DOC.zustimmung, DOC.wasser, DOC.kosten],
      summary,
    }));
  if (annual)
    list.push(mk({
      id: `${bl.toLowerCase()}_praemie`, name: `${BUNDESLAENDER[bl].name}: ${name} – Flächenprämie`, provider: 'Land', states: [bl], kind: 'flaeche',
      annualPerHa: annual.perHa, years: annual.years, group: 'praemie',
      requires: { moor: true, minHa: 0.5, minWlCm: 0, maxWlCm: 30 }, authority, deadline: deadline === 'laufend' ? 'laufend' : deadline,
      docs: [DOC.flurstueck, DOC.plan, DOC.betrieb, DOC.pacht],
      summary: `Jährlicher Ausgleich für dauerhaft hohe Wasserstände / moorschonende Bewirtschaftung (${annual.years} Jahre Verpflichtung).`,
      effort: 'niedrig',
    }));
  return list;
};

const generic = (bl: BL, authority: string) =>
  landProgram(bl, 'Agrarumwelt- & Klimamaßnahmen (AUKM) Moor', authority, '2027-05-15',
    { rate: 0.6, capPerHa: 4000 }, { perHa: 260, years: 5 },
    'Allgemeine Landesförderung für moorschonende Bewirtschaftung und Wasserrückhalt.');

export const FUNDING_PROGRAMS: FundingProgram[] = [
  mk({
    id: 'gap_basis', name: 'GAP-Basisprämie (EU-Direktzahlung)', provider: 'EU', kind: 'info',
    summary: 'Nasse Bewirtschaftung (Paludikultur) bleibt als landwirtschaftliche Tätigkeit prämienberechtigt – die Basisprämie (~156 €/ha) läuft unverändert weiter. Keine Neuantragstellung nötig, Flächen im Sammelantrag aktuell halten.',
    deadline: '2027-05-15', authority: 'Sammelantrag über das Landesportal', effort: 'niedrig', docs: [DOC.betrieb],
  }),
  mk({
    id: 'glöz2', name: 'GLÖZ 2 – Schutz von Feuchtgebieten und Mooren (Auflage)', provider: 'EU', kind: 'info',
    summary: 'Konditionalität: Auf Moor- und Feuchtgebietsflächen gelten Auflagen (z. B. Genehmigungspflicht für Neu-Entwässerung, Umbruchverbot auf Dauergrünland). Beratung durch Paludio-Check vor Maßnahmenbeginn.',
    requires: { moor: true }, effort: 'niedrig', docs: [],
  }),
  mk({
    id: 'bund_ank', name: 'Bundesprogramm Natürlicher Klimaschutz – Moorbodenschutz', provider: 'Bund', kind: 'investition',
    summary: 'Projektförderung für Wiedervernässung und moorschonende Nutzung auf zusammenhängenden Flächen. Zuwendung auf Planung und Wasserbau, Antragstellung häufig im Verbund.',
    rate: 0.9, capPerHa: 7500, capTotal: 1_500_000, coversEstablishment: false, group: 'invest',
    requires: { moor: true, minHa: 15 }, deadline: '2027-01-31', authority: 'Projektträger des Bundes (Förderportal)', effort: 'hoch',
    docs: [DOC.flurstueck, DOC.plan, DOC.betrieb, DOC.pacht, DOC.zustimmung, DOC.wasser, DOC.kosten, DOC.natur],
  }),
  mk({
    id: 'gak_moor', name: 'GAK – Wasserrückhalt & Moorschutz (Bund/Länder)', provider: 'Bund', kind: 'investition',
    summary: 'Gemeinschaftsaufgabe Agrarstruktur und Küstenschutz: Zuwendung zu Maßnahmen zur Wiederherstellung hoher Wasserstände auf landwirtschaftlich genutzten Moorflächen.',
    rate: 0.7, capPerHa: 5000, coversEstablishment: false, group: 'invest',
    requires: { moor: true, minHa: 1 }, deadline: 'laufend', authority: 'Bewilligungsstelle des Landes', effort: 'mittel',
    docs: [DOC.flurstueck, DOC.plan, DOC.betrieb, DOC.pacht, DOC.zustimmung, DOC.wasser, DOC.kosten],
  }),
  mk({
    id: 'eip', name: 'EIP-Agri Innovationsförderung – Paludikultur-Pilot', provider: 'Land', kind: 'investition',
    summary: 'Operationelle Gruppen für innovative Nasskulturen (z. B. Torfmoos, Rohrkolben-Wertschöpfung). Förderung von Etablierung und Versuchsbegleitung.',
    rate: 0.8, capTotal: 250_000, coversEstablishment: true, group: 'innovation',
    requires: { moor: true, minHa: 2, crops: ['torfmoos', 'rohrkolben', 'moor_pv'] }, deadline: '2027-03-31', authority: 'Landesbehörde / EIP-Servicestelle', effort: 'hoch',
    docs: [DOC.flurstueck, DOC.plan, DOC.betrieb, DOC.kosten, 'Kooperationsvereinbarung der Operationellen Gruppe'],
  }),
  mk({
    id: 'vnatur', name: 'Vertragsnaturschutz – extensive Nassweide / Nasswiese', provider: 'Land', kind: 'flaeche',
    summary: 'Flächenprämie für extensive Nutzung nasser Wiesen und Weiden mit angepasster Mahd- bzw. Beweidungsregelung.',
    annualPerHa: 380, years: 5, group: 'praemie',
    requires: { moor: true, minHa: 0.5, crops: ['nassgruenland', 'buffel'] }, deadline: '2027-04-30', authority: 'untere Naturschutzbehörde / Landesamt', effort: 'niedrig',
    docs: [DOC.flurstueck, DOC.plan, DOC.betrieb, DOC.pacht],
  }),
  mk({
    id: 'rentenbank', name: 'Rentenbank Programmkredit Nachhaltigkeit', provider: 'Bank', kind: 'kredit',
    summary: 'Zinsverbilligtes Darlehen für Investitionen in nachhaltige Bewirtschaftung. Antrag über die Hausbank. Der Zinsvorteil wird im Prototyp pauschal mit ca. 4 % der Investition angesetzt.',
    group: 'kredit', requires: {}, authority: 'Hausbank / Landwirtschaftliche Rentenbank', effort: 'niedrig', docs: [DOC.betrieb, DOC.plan, DOC.kosten],
  }),
  mk({
    id: 'beratung', name: 'Moorschutz-Erstberatung (Landesberatung, kostenfrei)', provider: 'Land', kind: 'beratung',
    summary: 'Neutrale Erstberatung zu Wasserständen, Genehmigung und Förderung. Paludio hinterlegt Ihre Daten für das Beratungsgespräch.',
    requires: { moor: true }, authority: 'Landesberatungsstelle', effort: 'niedrig', docs: [DOC.flurstueck],
  }),
  ...landProgram('NI', 'Moorschutz & Klimaschutz', 'Landwirtschaftskammer Niedersachsen / NLWKN', '2027-03-15', { rate: 0.8, capPerHa: 6000 }, { perHa: 320, years: 5 }, 'Landesförderung für die Wiedervernässung und moorschonende Bewirtschaftung auf Hoch- und Niedermoor.'),
  ...landProgram('BY', 'Moorbauernprogramm', 'Amt für Ernährung, Landwirtschaft und Forsten (AELF)', '2027-02-28', { rate: 0.9, capPerHa: 6500 }, { perHa: 520, years: 10 }, 'Bayerisches Programm für Landwirte, die Moorflächen wiedervernässen und weiter bewirtschaften.'),
  ...landProgram('BW', 'Landschaftspflegerichtlinie (LPR) / FAKT II', 'Untere Landwirtschaftsbehörde (Landratsamt)', '2027-03-01', { rate: 0.85, capPerHa: 5500 }, { perHa: 300, years: 5 }, 'Investitions- und Flächenförderung für Moor- und Feuchtgebiete.'),
  ...landProgram('BB', 'KULAP & Natürlicher Klimaschutz', 'LELF Brandenburg', '2027-05-15', { rate: 0.9, capPerHa: 6000 }, { perHa: 400, years: 5 }, 'Brandenburgische Förderung für moorschonende Stauhaltung und Paludikultur.'),
  ...landProgram('MV', 'Moorschutz & Paludikultur', 'Staatliches Amt für Landwirtschaft und Umwelt (StALU)', 'laufend', { rate: 0.9, capPerHa: 7000 }, { perHa: 500, years: 10 }, 'Mecklenburg-Vorpommern fördert Wiedervernässung und Paludikultur über Richtlinien des Landes, inkl. Moor-Klimazertifikaten.', 'niedrig'),
  ...landProgram('SH', 'Biologischer Klimaschutz (Moorschutz)', 'Landesamt für Landwirtschaft und nachhaltige Landentwicklung (LLnL)', '2027-04-30', { rate: 0.9, capPerHa: 6500 }, { perHa: 350, years: 10 }, 'Landesprogramm für Moorschutz mit Kooperation von Stiftung Naturschutz und Flächeneigentümern.'),
  ...landProgram('ST', 'Moorschutz / AUKM', 'Amt für Landwirtschaft, Flurneuordnung und Forsten (ALFF)', '2027-05-15', { rate: 0.75, capPerHa: 5000 }, { perHa: 300, years: 5 }, 'Landesförderung für Wasserrückhalt und extensive Nutzung von Niedermooren.'),
  ...landProgram('SN', 'AUKM / Moorschutz', 'Sächsisches Landesamt für Umwelt, Landwirtschaft und Geologie (LfULG)', '2027-05-15', { rate: 0.7, capPerHa: 4500 }, { perHa: 280, years: 5 }, 'Sächsische Förderung für klimaschonende Landbewirtschaftung auf organischen Böden.'),
  ...generic('NW', 'Landwirtschaftskammer NRW'),
  ...generic('HE', 'zuständige Landesbehörde'),
  ...generic('RP', 'zuständige Landesbehörde'),
  ...generic('SL', 'zuständige Landesbehörde'),
  ...generic('TH', 'zuständige Landesbehörde'),
  ...generic('BE', 'zuständige Landesbehörde'),
  ...generic('HB', 'zuständige Landesbehörde'),
  ...generic('HH', 'zuständige Landesbehörde'),
];

export const programById = (id: string) => FUNDING_PROGRAMS.find((p) => p.id === id);

export interface Capex {
  planning: number;
  waterworks: number;
  establishment: number;
  total: number;
}

export interface FundingContext {
  states: BL[];
  areaHa: number;
  moorHa: number;
  crop: Crop;
  targetWlCm: number;
  capex: Capex;
}

export interface FundingMatch {
  program: FundingProgram;
  status: 'passt' | 'teilweise' | 'nicht';
  reasons: string[];
  oneTime: number;
  annual: number;
  years: number;
}

export function evaluateProgram(p: FundingProgram, ctx: FundingContext): FundingMatch {
  const reasons: string[] = [];
  let hard = false;
  let soft = false;

  if (p.states !== 'ALL' && !p.states.some((s) => ctx.states.includes(s))) {
    hard = true;
    reasons.push(`Nur in ${p.states.map((s) => BUNDESLAENDER[s].name).join(', ')}`);
  }
  if (p.requires.moor && ctx.moorHa <= 0) {
    hard = true;
    reasons.push('Setzt Moorboden voraus');
  }
  if (p.requires.minHa && ctx.moorHa < p.requires.minHa) {
    if (ctx.moorHa >= p.requires.minHa * 0.5) {
      soft = true;
      reasons.push(`Mindestfläche ${p.requires.minHa} ha (Ihre Moorfläche: ${ctx.moorHa.toFixed(1)} ha) – ggf. im Verbund`);
    } else {
      hard = true;
      reasons.push(`Mindestfläche ${p.requires.minHa} ha nicht erreicht`);
    }
  }
  if (p.requires.crops && !p.requires.crops.includes(ctx.crop.id)) {
    hard = true;
    reasons.push('Gewählte Kultur wird nicht gefördert');
  }
  if (p.requires.maxWlCm !== undefined && ctx.targetWlCm > p.requires.maxWlCm) {
    hard = true;
    reasons.push(`Ziel-Wasserstand muss höchstens ${p.requires.maxWlCm} cm unter Flur liegen`);
  }

  let oneTime = 0;
  let annual = 0;
  let years = 0;
  if (!hard) {
    if (p.kind === 'investition') {
      const base = ctx.capex.planning + ctx.capex.waterworks + (p.coversEstablishment ? ctx.capex.establishment : 0);
      oneTime = base * (p.rate ?? 0);
      if (p.capPerHa) oneTime = Math.min(oneTime, p.capPerHa * ctx.moorHa);
      if (p.capTotal) oneTime = Math.min(oneTime, p.capTotal);
    } else if (p.kind === 'flaeche') {
      annual = (p.annualPerHa ?? 0) * ctx.moorHa;
      years = p.years ?? 5;
    } else if (p.kind === 'kredit') {
      oneTime = ctx.capex.total * 0.04;
    }
    if (soft) {
      oneTime *= 0.5;
      annual *= 0.5;
    }
  }
  const status: FundingMatch['status'] = hard ? 'nicht' : soft ? 'teilweise' : 'passt';
  if (!reasons.length) reasons.push('Alle Voraussetzungen nach Ihren Plandaten erfüllt');
  return { program: p, status, reasons, oneTime, annual, years };
}

export interface FundingSummary {
  matches: FundingMatch[];
  /** Einmalige Zuschüsse/Vorteile (nicht stapelbar je Gruppe, begrenzt auf 90 % der Investition) */
  oneTime: number;
  annual: number;
  annualYears: number;
  chosen: FundingMatch[];
}

export function summarizeFunding(ctx: FundingContext): FundingSummary {
  const matches = FUNDING_PROGRAMS.filter((p) => p.applicable).map((p) => evaluateProgram(p, ctx));
  const best = new Map<string, FundingMatch>();
  const chosen: FundingMatch[] = [];
  for (const m of matches) {
    if (m.status === 'nicht') continue;
    if (m.program.kind === 'info' || m.program.kind === 'beratung') continue;
    const g = m.program.group ?? m.program.id;
    const val = m.oneTime + m.annual * (m.years || 1);
    const cur = best.get(g);
    if (!cur || val > cur.oneTime + cur.annual * (cur.years || 1)) best.set(g, m);
  }
  for (const m of best.values()) chosen.push(m);
  let oneTime = chosen.reduce((a, m) => a + m.oneTime, 0);
  oneTime = Math.min(oneTime, ctx.capex.total * 0.92);
  const annual = chosen.reduce((a, m) => a + m.annual, 0);
  const annualYears = Math.max(0, ...chosen.filter((m) => m.annual > 0).map((m) => m.years));
  matches.sort((a, b) => {
    const order = { passt: 0, teilweise: 1, nicht: 2 } as const;
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return b.oneTime + b.annual * (b.years || 1) - (a.oneTime + a.annual * (a.years || 1));
  });
  return { matches, oneTime, annual, annualYears, chosen };
}
