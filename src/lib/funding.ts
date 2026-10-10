import type { BL } from './types';
import type { Crop } from './crops';
import { BUNDESLAENDER } from './geo';

/**
 * Förderkatalog – nur Programme, die mit Quelle belegt sind (Stand siehe `source`).
 *
 * Grundlage für das Bundesprogramm ist die Förderrichtlinie Palu des BMUKN vom 16.04.2026
 * (BAnz. 03.06.2026), umgesetzt durch die Landwirtschaftliche Rentenbank, und das Rentenbank-Merkblatt V3 vom 03.09.2026.
 * Beträge, die eine Behörde individuell berechnet (z. B. Wertverlust über den Kompensationsrechner), werden
 * nicht geschätzt, sondern als „wird von der Bewilligungsstelle berechnet“ ausgewiesen.
 */

export type FundingKind = 'investition' | 'ausgleich' | 'flaeche' | 'kredit' | 'beratung' | 'info';
export type FundingProvider = 'EU' | 'Bund' | 'Land' | 'Bank' | 'Privat';
export type CostPart = 'planning' | 'waterworks' | 'establishment';
/** berechnet = aus Plandaten nach Richtlinie; geschaetzt = aus Modellwerten; extern = Behörde berechnet; keiner = kein Geldbetrag */
export type AmountMode = 'berechnet' | 'geschaetzt' | 'extern' | 'keiner';

export interface FundingWindow {
  from: string;
  to: string;
  label?: string;
}

export interface FundingProgram {
  id: string;
  name: string;
  provider: FundingProvider;
  states: BL[] | 'ALL';
  kind: FundingKind;
  summary: string;
  /** Förderquote auf die förderfähigen Kosten der genannten Kostenteile */
  rate?: number;
  /** abweichende Quote, wenn der Zielwasserstand Vernässungsstufe 1 (≤ 10 cm) erreicht */
  rateStufe1?: number;
  covers?: CostPart[];
  annualPerHa?: number;
  years?: number;
  amountMode: AmountMode;
  /** Erläuterung zur Höhe, wenn nicht berechnet */
  amountNote?: string;
  /** Programme derselben Gruppe fördern dieselbe Maßnahme und sind nicht kumulierbar */
  group?: string;
  requires: {
    moor?: boolean;
    minHa?: number;
    maxWlCm?: number;
    crops?: string[];
    excludeCrops?: string[];
  };
  /** Antragsfenster; ohne Fenster gilt `rolling` */
  windows?: FundingWindow[];
  rolling?: string;
  authority: string;
  portal?: string;
  source: { label: string; url: string; stand: string };
  docs: DocId[];
  /** Pflichten nach Bewilligung */
  obligations: string[];
  effort: 'niedrig' | 'mittel' | 'hoch';
  applicable: boolean;
}

/* ---------- Nachweise ---------- */

export const DOCS = {
  flurstuecke: { label: 'Flurstücksliste mit Kennzeichen, Gemarkung, Flur und amtlicher Fläche', auto: true },
  kostenplan: { label: 'Kosten- und Finanzierungsplan', auto: true },
  thg: { label: 'THG-Abschätzung als Grundlage für das Umsetzungskonzept', auto: true },
  eigentum: { label: 'Eigentumsnachweis (Grundbuch- oder Liegenschaftskatasterauszug)', auto: false },
  nutzungsrecht: { label: 'Nachweis der Nutzungsrechte für Pachtflächen (z. B. Pachtvertrag)', auto: false },
  zustimmung: { label: 'Einverständniserklärung der Flächeneigentümer*innen (bei Pacht oder Miteigentum)', auto: false },
  wasserrecht: { label: 'Abgeschlossenes wasserrechtliches Verfahren oder Zustimmung aller Betroffenen', auto: false },
  hydro: { label: 'Hydrologisches Gutachten mit Zuordnung zur Vernässungsstufe', auto: false },
  umsetzung: { label: 'Flächenbezogenes Umsetzungskonzept inkl. ermittelter THG-Einsparung', auto: false },
  monitoring: { label: 'Monitoringkonzept bzw. Pegelmessung der Flächenwasserstände', auto: false },
  wasserstand: { label: 'Nachweis des Wasserstands zum Zeitpunkt der Antragstellung', auto: false },
  angebote: { label: 'Kostenangebote qualifizierter Dienstleister', auto: false },
  bodenrichtwert: { label: 'Bodenrichtwert zum Antragszeitpunkt', auto: false },
  nutzung5j: { label: 'Nachweis der landwirtschaftlichen Nutzung in den letzten 5 Jahren (z. B. Sammelanträge)', auto: false },
  deminimis: { label: 'De-minimis-Erklärung über Beihilfen der letzten 3 Jahre', auto: false },
  mehrfachantrag: { label: 'Mehrfach- bzw. Sammelantrag des laufenden Jahres', auto: false },
} as const;
export type DocId = keyof typeof DOCS;

const RENTENBANK = 'Landwirtschaftliche Rentenbank (im Auftrag des BMUKN)';
const RENTENBANK_PORTAL = 'https://www.rentenbank.de/zuschussprogramme/ank-palu/';
const PALU_SRC = { label: 'Förderrichtlinie Palu (BMUKN, 16.04.2026); Merkblatt V3 (03.09.2026)', url: 'https://www.bundesumweltministerium.de/programm/palu-wiedervernaessung-und-bewirtschaftung-von-moorboeden', stand: '09/2026' };
const PALU_WINDOWS_SRC = 'https://www.nrwbank.de/de/foerderung/foerderprodukte/60441/wiedervernaessung-und-innovative-nutzung-von-moorboeden-foerderrichtlinie-palu.html';

/** Geschwindigkeitsbonus Palu Modul 3: +20 Prozentpunkte bei Antrag innerhalb eines Jahres nach Veröffentlichung (BAnz. 03.06.2026) */
export const PALU_BONUS_UNTIL = '2027-06-02';
export const paluBonusActive = (d = new Date()) => d.toISOString().slice(0, 10) <= PALU_BONUS_UNTIL;

const p = (x: Omit<FundingProgram, 'applicable' | 'states'> & { states?: BL[] | 'ALL' }): FundingProgram => ({ states: 'ALL', applicable: true, ...x });

export const FUNDING_PROGRAMS: FundingProgram[] = [
  /* ----- Bund: Förderrichtlinie Palu ----- */
  p({
    id: 'palu_1', name: 'Palu Modul 1 – Beratung zur Wiedervernässung', provider: 'Bund', kind: 'beratung',
    summary: 'Beratung zu flächenbezogener Wiedervernässung, Nutzungsmöglichkeiten und betrieblichem Umsetzungskonzept durch qualifizierte Dienstleister. Vollfinanzierung bis 15.000 € (5–50 ha), 25.000 € (50–200 ha) bzw. 30.000 € (über 200 ha).',
    amountMode: 'keiner', amountNote: 'Beratungskosten werden zu 100 % übernommen.',
    requires: { moor: true, minHa: 5 },
    windows: [{ from: '2026-06-29', to: '2026-09-29', label: 'Geschlossene Interessenbekundung' }],
    authority: RENTENBANK, portal: RENTENBANK_PORTAL, source: { ...PALU_SRC, url: PALU_WINDOWS_SRC },
    docs: ['flurstuecke', 'deminimis'],
    obligations: ['Individuelle Beratung ist De-minimis-Beihilfe (max. 50.000 € in 3 Jahren in der Primärproduktion)'],
    effort: 'niedrig',
  }),
  p({
    id: 'palu_2a', name: 'Palu Modul 2.A – Planung, Gutachten und Genehmigung', provider: 'Bund', kind: 'investition',
    summary: 'Fachliche, planerische und rechtliche Voraussetzungen für das Wassermanagement: Planungsleistungen, Gutachten, Beteiligungs- und Genehmigungsverfahren. Vollfinanzierung der förderfähigen Ausgaben.',
    rate: 1, covers: ['planning'], amountMode: 'berechnet', group: 'planung',
    requires: { moor: true, minHa: 5, maxWlCm: 20 },
    windows: [{ from: '2026-06-29', to: '2026-09-29', label: 'Geschlossene Interessenbekundung' }],
    authority: RENTENBANK, portal: RENTENBANK_PORTAL, source: { ...PALU_SRC, url: PALU_WINDOWS_SRC },
    docs: ['flurstuecke', 'kostenplan', 'eigentum', 'nutzungsrecht', 'zustimmung', 'angebote'],
    obligations: ['Ziel ist eine dauerhafte, weitgehende Wiedervernässung (Jahresmittel ≤ 20 cm unter Flur)', 'Eigenleistungen sind nicht förderfähig'],
    effort: 'mittel',
  }),
  p({
    id: 'palu_2b', name: 'Palu Modul 2.B – Wasserbau und Pegel', provider: 'Bund', kind: 'investition',
    summary: 'Technische und hydrologische Umsetzung: Staue, Grabenverschlüsse, Verwallungen, Bauabnahme und Pegelmesser. Vollfinanzierung der förderfähigen Ausgaben.',
    rate: 1, covers: ['waterworks'], amountMode: 'berechnet', group: 'wasserbau',
    requires: { moor: true, minHa: 5, maxWlCm: 20 },
    windows: [{ from: '2026-09-28', to: '2026-12-31', label: 'Offene Interessenbekundung' }],
    authority: RENTENBANK, portal: RENTENBANK_PORTAL, source: { ...PALU_SRC, url: PALU_WINDOWS_SRC },
    docs: ['flurstuecke', 'kostenplan', 'thg', 'eigentum', 'nutzungsrecht', 'zustimmung', 'wasserrecht', 'umsetzung', 'hydro', 'monitoring', 'angebote'],
    obligations: ['Zweckbindung 20 Jahre ab Fertigstellung', 'Pflege und Unterhalt der Anlagen trägt der Betrieb'],
    effort: 'hoch',
  }),
  p({
    id: 'palu_3a', name: 'Palu Modul 3.A – Ausgleich für den Wertverlust der Flächen', provider: 'Bund', kind: 'ausgleich',
    summary: 'Festbetrag für den Wertverlust durch dauerhaft hohe Wasserstände, berechnet aus Bodenrichtwert und Vernässungsstufe. Bei Antrag bis 02.06.2027 erhöht sich der Betrag um 20 Prozentpunkte (Geschwindigkeitsbonus).',
    amountMode: 'extern', amountNote: 'Die Rentenbank berechnet den Betrag mit ihrem Kompensationsrechner aus dem Bodenrichtwert.',
    requires: { moor: true, minHa: 0.005, maxWlCm: 20, excludeCrops: ['moor_pv'] },
    windows: [{ from: '2026-09-28', to: '2026-12-31', label: 'Offene Interessenbekundung' }],
    authority: RENTENBANK, portal: RENTENBANK_PORTAL, source: { ...PALU_SRC, url: PALU_WINDOWS_SRC },
    docs: ['flurstuecke', 'eigentum', 'bodenrichtwert', 'nutzung5j', 'hydro', 'wasserstand', 'monitoring'],
    obligations: ['Bindefrist 20 Jahre ab erstem Wasserstandsnachweis', 'Pegelstände halbjährlich nachweisen', 'Nur Flächen mit mindestens 5 Jahren landwirtschaftlicher Nutzung', 'Nicht für Flächen, die für Photovoltaik wiedervernässt werden'],
    effort: 'mittel',
  }),
  p({
    id: 'palu_3b', name: 'Palu Modul 3.B – Ausgleich für Ertragsverluste', provider: 'Bund', kind: 'ausgleich',
    summary: 'Jährlicher Ausgleich des entgangenen Deckungsbeitrags (Standarddeckungsbeitrag der letzten 5 Jahre) für bis zu 7 Jahre, bei Pachtflächen höchstens bis zum Ende des laufenden Pachtvertrags. Bei Antrag bis 02.06.2027 plus 20 Prozentpunkte.',
    years: 7, amountMode: 'geschaetzt', group: 'ertragsausgleich',
    amountNote: 'Schätzung aus dem Deckungsbeitrag der heutigen Nutzung. Maßgeblich ist der Standarddeckungsbeitrag laut Kompensationsrechner.',
    requires: { moor: true, minHa: 0.005, maxWlCm: 20, excludeCrops: ['moor_pv'] },
    windows: [{ from: '2026-09-28', to: '2026-12-31', label: 'Offene Interessenbekundung' }],
    authority: RENTENBANK, portal: RENTENBANK_PORTAL, source: { ...PALU_SRC, url: PALU_WINDOWS_SRC },
    docs: ['flurstuecke', 'eigentum', 'nutzungsrecht', 'nutzung5j', 'hydro', 'wasserstand', 'monitoring'],
    obligations: ['Bindefrist bis Ende der Vorhabenlaufzeit (bis 7 Jahre)', 'Pegelstände halbjährlich nachweisen', 'Erster Wasserstandsnachweis spätestens 2 Jahre nach Vorhabenbeginn'],
    effort: 'mittel',
  }),
  p({
    id: 'palu_4', name: 'Palu Modul 4 – Etablierung von Paludikultur und Spezialtechnik', provider: 'Bund', kind: 'investition',
    summary: 'Nach erfolgreicher Wiedervernässung: Einrichtung der Paludikultur, Spezialtechnik, Lager und Aufbereitung, Beratung und Schulung. 70 % der förderfähigen Ausgaben, 80 %, wenn über die Hälfte der Fläche Vernässungsstufe 1 (≤ 10 cm) erreicht.',
    rate: 0.7, rateStufe1: 0.8, covers: ['establishment'], amountMode: 'berechnet', group: 'etablierung',
    requires: { moor: true, minHa: 5, maxWlCm: 20, excludeCrops: ['moor_pv'] },
    windows: [{ from: '2026-11-02', to: '2027-01-29', label: 'Offene Interessenbekundung' }],
    authority: RENTENBANK, portal: RENTENBANK_PORTAL, source: { ...PALU_SRC, url: PALU_WINDOWS_SRC },
    docs: ['flurstuecke', 'kostenplan', 'wasserstand', 'angebote', 'eigentum', 'nutzungsrecht'],
    obligations: ['Zweckbindung Maschinen 5 bzw. 8 Jahre, Bauten 12 Jahre', 'Nachweis des Wasserstands bei Antragstellung'],
    effort: 'mittel',
  }),

  /* ----- EU / GAP ----- */
  p({
    id: 'gap_eg', name: 'GAP-Direktzahlungen auf Paludikultur-Flächen', provider: 'EU', kind: 'info',
    summary: 'Bisher beihilfefähige Flächen bleiben nach § 11 Abs. 1 Nr. 3 b GAPDZV förderfähig, wenn sie im Rahmen einer Klimaschutzmaßnahme (z. B. Palu oder Agrarumweltmaßnahme) mit Paludikultur bewirtschaftet werden. Flächen mit Freiflächen-Photovoltaik sind nicht beihilfefähig.',
    amountMode: 'keiner', requires: {}, rolling: 'Jährlich über den Sammelantrag',
    authority: 'Landwirtschaftsverwaltung des Landes (Sammelantrag)', source: { label: '§ 11 GAPDZV (Fassung ab 01.01.2026)', url: 'https://www.buzer.de/11_GAPDZV.htm', stand: '01/2026' },
    docs: ['mehrfachantrag'], obligations: [], effort: 'niedrig',
  }),
  p({
    id: 'gloez2', name: 'GLÖZ 2 – Schutz von Feuchtgebieten und Mooren', provider: 'EU', kind: 'info',
    summary: 'Konditionalität: Auf Flächen der GLÖZ-2-Kulisse gelten Auflagen, u. a. Genehmigungspflicht für neue oder vertiefte Entwässerung. Wiedervernässung ist damit vereinbar.',
    amountMode: 'keiner', requires: { moor: true }, rolling: 'Gilt dauerhaft',
    authority: 'Landwirtschaftsverwaltung des Landes', source: { label: 'GAP-Konditionalitäten-Verordnung', url: 'https://www.gesetze-im-internet.de/gapkondv/', stand: '2026' },
    docs: [], obligations: [], effort: 'niedrig',
  }),

  /* ----- Länder ----- */
  p({
    id: 'by_m16', name: 'Bayern: Moorbauernprogramm – Paludikultur mit Stauziel (M16)', provider: 'Land', states: ['BY'], kind: 'flaeche',
    summary: 'Agrarumweltmaßnahme für den Anbau von Paludikulturen bei dauerhaft angehobenem Wasserstand (Stauziel). 2.200 € je ha und Jahr laut Maßnahmenübersicht KULAP/AUKM.',
    annualPerHa: 2200, years: 5, amountMode: 'geschaetzt', group: 'ertragsausgleich',
    amountNote: 'Satz laut Maßnahmenübersicht des StMELF (Verpflichtungszeitraum ab 2023). Laufzeit und aktueller Satz laut Merkblatt prüfen.',
    requires: { moor: true, maxWlCm: 20, crops: ['rohrkolben', 'schilf', 'torfmoos'] },
    rolling: 'Neuantrag jährlich im Februar über iBALIS (2026 bis 24.02.2026)',
    authority: 'Amt für Ernährung, Landwirtschaft und Forsten (AELF)', source: { label: 'StMELF Maßnahmenübersicht KULAP/AUKM', url: 'https://www.stmelf.bayern.de/foerderung/', stand: '2023–2027' },
    docs: ['flurstuecke', 'mehrfachantrag', 'wasserstand'], obligations: ['Stauziel ganzjährig halten'], effort: 'niedrig',
  }),
  p({
    id: 'by_m14', name: 'Bayern: Moorbauernprogramm – wiedervernässtes Grünland mit Stauziel (M14)', provider: 'Land', states: ['BY'], kind: 'flaeche',
    summary: 'Agrarumweltmaßnahme für die Bewirtschaftung von wiedervernässtem Grünland mit Stauziel höchstens 20 cm unter Flur. 900 € je ha und Jahr laut Maßnahmenübersicht.',
    annualPerHa: 900, years: 5, amountMode: 'geschaetzt', group: 'ertragsausgleich',
    amountNote: 'Satz laut Maßnahmenübersicht des StMELF. Verpflichtungsdauer laut Merkblatt (bis 12 Jahre) prüfen.',
    requires: { moor: true, maxWlCm: 20, crops: ['nassgruenland', 'buffel'] },
    rolling: 'Neuantrag jährlich im Februar über iBALIS (2026 bis 24.02.2026)',
    authority: 'Amt für Ernährung, Landwirtschaft und Forsten (AELF)', source: { label: 'StMELF Maßnahmenübersicht KULAP/AUKM', url: 'https://www.stmelf.bayern.de/foerderung/', stand: '2023–2027' },
    docs: ['flurstuecke', 'mehrfachantrag', 'wasserstand'], obligations: ['Stauziel ganzjährig ≤ 20 cm unter Flur halten'], effort: 'niedrig',
  }),
  p({
    id: 'bw_lpr', name: 'Baden-Württemberg: Landschaftspflegerichtlinie (LPR) – Vertragsnaturschutz', provider: 'Land', states: ['BW'], kind: 'flaeche',
    summary: 'Verträge für naturschutzgerechte Bewirtschaftung, z. B. extensive Nasswiesen und Beweidung. Die Höhe wird im Vertrag mit Landschaftserhaltungsverband bzw. unterer Naturschutzbehörde festgelegt.',
    amountMode: 'extern', amountNote: 'Höhe nach Vertrag, abhängig von Auflagen und Fläche.',
    requires: { moor: true, crops: ['nassgruenland', 'buffel'] },
    rolling: 'Laufend über Landschaftserhaltungsverband bzw. untere Naturschutzbehörde',
    authority: 'Landschaftserhaltungsverband / untere Naturschutzbehörde', source: { label: 'MLR Baden-Württemberg, Förderprogramme', url: 'https://mlr.baden-wuerttemberg.de/de/unsere-themen/laendlicher-raum/foerderung/gap-sp/foerderprogramme', stand: '2026' },
    docs: ['flurstuecke', 'eigentum', 'nutzungsrecht'], obligations: ['Bewirtschaftungsauflagen laut Vertrag'], effort: 'niedrig',
  }),
  p({
    id: 'bw_famoos', name: 'Baden-Württemberg: Fachstelle Moor und Natürlicher Klimaschutz (FaMooS)', provider: 'Land', states: ['BW'], kind: 'beratung',
    summary: 'Ansprechpartner des Landes für Moorschutzvorhaben: Beratung, Vernetzung und Arbeitshilfen, auch zur Bundesförderung Palu.',
    amountMode: 'keiner', requires: { moor: true }, rolling: 'Laufend',
    authority: 'Regierungspräsidien Baden-Württemberg', source: { label: 'RP BW Moormanagement', url: 'https://rp.baden-wuerttemberg.de/moormanagement/aktionsprogramm-natuerlicher-klimaschutz/', stand: '2026' },
    docs: [], obligations: [], effort: 'niedrig',
  }),
  p({
    id: 'bw_kcm', name: 'Baden-Württemberg: Klima Chance Moore (Modellprojekte)', provider: 'Privat', states: ['BW'], kind: 'info',
    summary: 'Von Mercedes-Benz bis 2028 finanziertes Projekt der Stiftung Naturschutz Pfrunger-Burgweiler Ried für Wiedervernässung und Paludikultur-Modellprojekte in Baden-Württemberg. Keine Antragsförderung, Kontakt über die Vernetzungsstelle.',
    amountMode: 'keiner', requires: { moor: true }, rolling: 'Projektlaufzeit bis 2028',
    authority: 'Stiftung Naturschutz Pfrunger-Burgweiler Ried', source: { label: 'klima-chance-moore.de', url: 'https://klima-chance-moore.de/', stand: '2026' },
    docs: [], obligations: [], effort: 'niedrig',
  }),
  p({
    id: 'ni_klimo', name: 'Niedersachsen: Klimaschutz durch Moorentwicklung (KliMo)', provider: 'Land', states: ['NI'], kind: 'info',
    summary: 'Landesförderrichtlinie für Maßnahmen zum Erhalt und zur Entwicklung von Hoch- und Niedermooren. Beratung zur Palu-Förderung bietet die Kompetenzstelle Paludikultur.',
    amountMode: 'extern', amountNote: 'Fördersatz und Antragsberechtigung laut Richtlinie beim NLWKN prüfen.',
    requires: { moor: true }, rolling: 'Siehe NLWKN',
    authority: 'NLWKN', source: { label: 'NLWKN: Förderrichtlinie KliMo', url: 'https://www.nlwkn.niedersachsen.de/klimo/klimaschutz-durch-moorentwicklung-169548.html', stand: '2026' },
    docs: ['flurstuecke'], obligations: [], effort: 'hoch',
  }),
  p({
    id: 'bb_moor', name: 'Brandenburg: Richtlinie Klima-/Moorschutz investiv', provider: 'Land', states: ['BB'], kind: 'info',
    summary: 'Investive Förderung u. a. für die Etablierung von Paludikultur, bis zu 80 % der förderfähigen Ausgaben. Mittel waren bis 2026 vorgesehen – Fortführung beim Land prüfen.',
    amountMode: 'extern', amountNote: 'Aktuelle Laufzeit und Mittelverfügbarkeit beim MLEUV prüfen.',
    requires: { moor: true }, rolling: 'Laufzeit bis 2026, Fortführung offen',
    authority: 'MLEUV Brandenburg / LELF', source: { label: 'FNR Themenportal Moorbodenschutz', url: 'https://moor.fnr.de/forschung-und-foerderung/weitere-foerderprogramme', stand: '2025' },
    docs: ['flurstuecke', 'kostenplan'], obligations: [], effort: 'mittel',
  }),
  p({
    id: 'mv_paludi', name: 'Mecklenburg-Vorpommern: Paludikultur und moorschonende Stauhaltung', provider: 'Land', states: ['MV'], kind: 'info',
    summary: 'Landesförderung für den Anbau von Paludikulturen bei hohem Wasserstand, laut FNR-Übersicht 450 € je ha und Jahr. Aktuelle Richtlinie beim Land prüfen.',
    amountMode: 'extern', amountNote: 'Satz laut FNR-Übersicht 2025, aktuelle Fassung prüfen.',
    requires: { moor: true }, rolling: 'Siehe Landesrichtlinie',
    authority: 'Staatliches Amt für Landwirtschaft und Umwelt (StALU)', source: { label: 'FNR Themenportal Moorbodenschutz', url: 'https://moor.fnr.de/forschung-und-foerderung/weitere-foerderprogramme', stand: '2025' },
    docs: ['flurstuecke'], obligations: [], effort: 'mittel',
  }),
  p({
    id: 'sh_moor', name: 'Schleswig-Holstein: Förderrichtlinie Moorschutz und Biologischer Klimaschutz', provider: 'Land', states: ['SH'], kind: 'info',
    summary: 'Landesrichtlinie für Moorschutzmaßnahmen. Sätze und Antragsberechtigung beim Land prüfen.',
    amountMode: 'extern', requires: { moor: true }, rolling: 'Siehe Landesrichtlinie',
    authority: 'Land Schleswig-Holstein', source: { label: 'FNR Themenportal Moorbodenschutz', url: 'https://moor.fnr.de/forschung-und-foerderung/weitere-foerderprogramme', stand: '2025' },
    docs: ['flurstuecke'], obligations: [], effort: 'mittel',
  }),

  /* ----- Bank / Energie ----- */
  p({
    id: 'rentenbank_kredit', name: 'Rentenbank Programmkredite (über die Hausbank)', provider: 'Bank', kind: 'kredit',
    summary: 'Zinsgünstige Programmkredite für landwirtschaftliche Investitionen, beantragt über die Hausbank. Mit Palu kumulierbar bis zur zulässigen Beihilfeintensität.',
    amountMode: 'extern', amountNote: 'Konditionen tagesaktuell bei der Hausbank.', requires: {}, rolling: 'Laufend über die Hausbank',
    authority: 'Hausbank / Landwirtschaftliche Rentenbank', source: { label: 'Förderrichtlinie Palu, Nr. 6.6 (Kumulierung)', url: PALU_SRC.url, stand: '04/2026' },
    docs: ['kostenplan'], obligations: [], effort: 'niedrig',
  }),
  p({
    id: 'eeg_moorpv', name: 'EEG: Moor-PV als besondere Solaranlage', provider: 'Bund', kind: 'info',
    summary: 'Solaranlagen auf zuvor entwässerten, landwirtschaftlich genutzten Moorböden, die mit dem Bau dauerhaft wiedervernässt werden. Kein Schutzgebiet, Bebauungsplan der Gemeinde und Zuschlag in der Ausschreibung nötig. Die EEG-2027-Novelle (Kabinettsbeschluss Juli 2026) sieht vor, die Sonderregeln für besondere Solaranlagen zu streichen.',
    amountMode: 'keiner', requires: { moor: true, crops: ['moor_pv'] }, rolling: 'Ausschreibungen der Bundesnetzagentur',
    authority: 'Bundesnetzagentur / Projektierer', source: { label: 'EEG § 37; Stellungnahmen zur EEG-Novelle 2026', url: 'https://www.bodensee-stiftung.org/wp-content/uploads/2026/06/Stellungnahme-EEG2026_MoorPV_Bodensee-Stiftung.pdf', stand: '07/2026' },
    docs: [], obligations: ['Wasserstand max. 10 cm unter Flur im Winter, 30 cm im Sommer (BNetzA-Festlegung)', 'Rückstandsloser Rückbau der Anlage'], effort: 'hoch',
  }),
];

export const programById = (id: string) => FUNDING_PROGRAMS.find((x) => x.id === id);

/* ---------- Antragsfenster ---------- */

export type WindowState = 'offen' | 'demnaechst' | 'geschlossen' | 'laufend';

export function windowStatus(prog: FundingProgram, today = new Date()): { state: WindowState; text: string; window?: FundingWindow } {
  const d = today.toISOString().slice(0, 10);
  const fmt = (s: string) => new Date(s).toLocaleDateString('de-DE');
  if (!prog.windows?.length) return { state: 'laufend', text: prog.rolling ?? 'Laufend' };
  const open = prog.windows.find((w) => w.from <= d && d <= w.to);
  if (open) {
    const days = Math.ceil((new Date(open.to).getTime() - today.getTime()) / 86400000);
    return { state: 'offen', text: `Antragsfenster offen bis ${fmt(open.to)} (noch ${days} Tage)`, window: open };
  }
  const next = prog.windows.filter((w) => w.from > d).sort((a, b) => a.from.localeCompare(b.from))[0];
  if (next) return { state: 'demnaechst', text: `Antragsfenster ${fmt(next.from)} bis ${fmt(next.to)}`, window: next };
  const last = prog.windows[prog.windows.length - 1];
  return { state: 'geschlossen', text: `Fenster am ${fmt(last.to)} geschlossen – weitere Aufrufe der Bewilligungsstelle abwarten`, window: last };
}

/* ---------- Bewertung ---------- */

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
  /** Deckungsbeitrag der heutigen Nutzung auf den Moorflächen (€/Jahr) */
  baselineDb: number;
}

export interface FundingMatch {
  program: FundingProgram;
  status: 'passt' | 'teilweise' | 'nicht';
  reasons: string[];
  oneTime: number;
  annual: number;
  years: number;
  /** Förderfähige Kosten, auf die sich der Zuschuss bezieht */
  eligibleCost: number;
  rate?: number;
}

const stufe = (wl: number) => (wl <= 10 ? 1 : wl <= 20 ? 2 : null);

export function evaluateProgram(prog: FundingProgram, ctx: FundingContext): FundingMatch {
  const reasons: string[] = [];
  let hard = false;
  const req = prog.requires;

  if (prog.states !== 'ALL' && !prog.states.some((s) => ctx.states.includes(s))) {
    hard = true;
    reasons.push(`Nur in ${prog.states.map((s) => BUNDESLAENDER[s].name).join(', ')}`);
  }
  if (req.moor && ctx.moorHa <= 0) {
    hard = true;
    reasons.push('Setzt Moorboden voraus');
  }
  if (req.minHa && ctx.moorHa < req.minHa) {
    hard = true;
    reasons.push(`Mindestens ${req.minHa >= 1 ? `${req.minHa} ha` : '50 m²'} Moorfläche nötig (Ihre: ${ctx.moorHa.toFixed(1)} ha) – ggf. gemeinsam mit Nachbarbetrieben`);
  }
  if (req.crops && !req.crops.includes(ctx.crop.id)) {
    hard = true;
    reasons.push(`Gilt nicht für ${ctx.crop.name}`);
  }
  if (req.excludeCrops?.includes(ctx.crop.id)) {
    hard = true;
    reasons.push(`Ausgeschlossen für ${ctx.crop.name}`);
  }
  if (req.maxWlCm !== undefined && ctx.targetWlCm > req.maxWlCm) {
    hard = true;
    reasons.push(`Zielwasserstand ${ctx.targetWlCm} cm liegt über ${req.maxWlCm} cm unter Flur – nicht förderfähig`);
  }

  let oneTime = 0;
  let annual = 0;
  let years = 0;
  let eligibleCost = 0;
  let rate = prog.rate;
  if (!hard) {
    if (prog.kind === 'investition' && prog.covers) {
      eligibleCost = prog.covers.reduce((a, c) => a + ctx.capex[c], 0);
      if (prog.rateStufe1 && stufe(ctx.targetWlCm) === 1) rate = prog.rateStufe1;
      oneTime = eligibleCost * (rate ?? 0);
    } else if (prog.id === 'palu_3b') {
      years = prog.years ?? 7;
      annual = ctx.baselineDb * (paluBonusActive() ? 1.2 : 1);
    } else if (prog.kind === 'flaeche' && prog.amountMode !== 'extern') {
      annual = (prog.annualPerHa ?? 0) * ctx.moorHa;
      years = prog.years ?? 5;
    }
    // Begründung, warum es passt
    if (req.maxWlCm !== undefined) {
      const s = stufe(ctx.targetWlCm);
      if (s) reasons.push(`Zielwasserstand ${ctx.targetWlCm} cm erfüllt Vernässungsstufe ${s}`);
    }
    if (req.minHa && req.minHa >= 1) reasons.push(`Mindestfläche ${req.minHa} ha erreicht (${ctx.moorHa.toFixed(1)} ha Moor)`);
    if (req.crops) reasons.push(`Passt zur Nutzung ${ctx.crop.name}`);
    if (prog.states !== 'ALL') reasons.push(`Flächen liegen in ${prog.states.map((s) => BUNDESLAENDER[s].name).join(', ')}`);
    if (prog.amountNote) reasons.push(prog.amountNote);
  }
  const status: FundingMatch['status'] = hard ? 'nicht' : prog.amountMode === 'extern' || prog.kind === 'info' ? 'teilweise' : 'passt';
  if (!reasons.length) reasons.push('Voraussetzungen nach Ihren Plandaten erfüllt');
  return { program: prog, status, reasons, oneTime, annual, years, eligibleCost, rate };
}

export interface FundingSummary {
  matches: FundingMatch[];
  oneTime: number;
  annual: number;
  annualYears: number;
  chosen: FundingMatch[];
}

/** Bestes Programm je Maßnahme (Gruppe); Programme für dieselbe Maßnahme sind nicht kumulierbar (Palu Nr. 6.6). */
export function summarizeFunding(ctx: FundingContext): FundingSummary {
  const matches = FUNDING_PROGRAMS.filter((x) => x.applicable).map((x) => evaluateProgram(x, ctx));
  const best = new Map<string, FundingMatch>();
  for (const m of matches) {
    if (m.status === 'nicht' || (m.oneTime <= 0 && m.annual <= 0)) continue;
    const g = m.program.group ?? m.program.id;
    const val = m.oneTime + m.annual * (m.years || 1);
    const cur = best.get(g);
    if (!cur || val > cur.oneTime + cur.annual * (cur.years || 1)) best.set(g, m);
  }
  const chosen = [...best.values()];
  const oneTime = Math.min(chosen.reduce((a, m) => a + m.oneTime, 0), ctx.capex.total);
  const annual = chosen.reduce((a, m) => a + m.annual, 0);
  const annualYears = Math.max(0, ...chosen.filter((m) => m.annual > 0).map((m) => m.years));
  const order = { passt: 0, teilweise: 1, nicht: 2 } as const;
  const kindOrder: Record<FundingKind, number> = { investition: 0, ausgleich: 1, flaeche: 2, beratung: 3, kredit: 4, info: 5 };
  matches.sort((a, b) =>
    order[a.status] - order[b.status]
    || kindOrder[a.program.kind] - kindOrder[b.program.kind]
    || (b.oneTime + b.annual * (b.years || 1)) - (a.oneTime + a.annual * (a.years || 1)));
  return { matches, oneTime, annual, annualYears, chosen };
}
