import type { MoorType } from './types';

export interface Crop {
  id: string;
  name: string;
  latin?: string;
  icon: string;
  short: string;
  description: string;
  moor: MoorType[];
  /** Ziel-Wasserflurabstand in cm unter Gelände (negativ = Überstau) */
  waterLevelCm: number;
  yieldPerHa: number;
  yieldUnit: string;
  pricePerUnit: number;
  priceUnit: string;
  /** variable Kosten pro ha und Jahr bei Vollertrag (Ernte, Pflege, Logistik) */
  varCostPerHa: number;
  /** Etablierungskosten (Pflanzung, Einrichtung) pro ha, einmalig */
  establishmentPerHa: number;
  /** Anteil des Vollertrags je Jahr (Jahr 1, 2, 3 …; letzter Wert gilt fortlaufend) */
  ramp: number[];
  minPeatCm: number;
  minAreaHa: number;
  harvestMonths: number[];
  machineCategories: string[];
  productCategory: string;
  maturity: 'etabliert' | 'Pilot' | 'Forschung';
  marketRisk: 1 | 2 | 3;
  risks: string;
  labourHoursPerHa: number;
  /** Maschinen mit niedrigem Bodendruck zwingend? */
  fundingTags: string[];
}

export const CROPS: Crop[] = [
  {
    id: 'rohrkolben', name: 'Rohrkolben', latin: 'Typha spp.', icon: 'rohrkolben',
    short: 'Dämmstoffe & Baumaterial',
    description: 'Schnellwüchsige Sumpfpflanze für Dämmplatten, Leichtlehm und Verpackung. Winterliche Ernte bei Frost oder trockenen Bedingungen mit Spezialfahrzeugen.',
    moor: ['niedermoor'], waterLevelCm: 0,
    yieldPerHa: 10, yieldUnit: 't TM', pricePerUnit: 150, priceUnit: '€/t TM',
    varCostPerHa: 650, establishmentPerHa: 7500, ramp: [0, 0.25, 0.7, 1],
    minPeatCm: 40, minAreaHa: 1, harvestMonths: [12, 1, 2],
    machineCategories: ['raupe-maehen', 'ballenpresse', 'transport'], productCategory: 'baustoff',
    maturity: 'Pilot', marketRisk: 2, risks: 'Abnehmerstruktur im Aufbau; Ernte nur mit Spezialtechnik.',
    labourHoursPerHa: 14, fundingTags: ['paludi'],
  },
  {
    id: 'schilf', name: 'Schilf / Reet', latin: 'Phragmites australis', icon: 'schilf',
    short: 'Reet, Einstreu, Brennstoff',
    description: 'Robuste Dauerkultur, meist über natürliche Etablierung. Qualitäts-Reet für Dachdeckung erzielt höhere Preise, Restmengen als Einstreu oder Pellet.',
    moor: ['niedermoor'], waterLevelCm: 0,
    yieldPerHa: 8, yieldUnit: 't TM', pricePerUnit: 190, priceUnit: '€/t TM (Mischpreis)',
    varCostPerHa: 480, establishmentPerHa: 2000, ramp: [0.1, 0.5, 0.9, 1],
    minPeatCm: 30, minAreaHa: 1, harvestMonths: [12, 1, 2, 3],
    machineCategories: ['raupe-maehen', 'ballenpresse', 'transport'], productCategory: 'reet',
    maturity: 'etabliert', marketRisk: 1, risks: 'Qualitätsanforderungen für Dachreet; Importkonkurrenz.',
    labourHoursPerHa: 10, fundingTags: ['paludi'],
  },
  {
    id: 'nassgruenland', name: 'Nassgrünland (Seggen, Rohrglanzgras)', latin: 'Carex, Phalaris', icon: 'nassgruenland',
    short: 'Heu, Einstreu, Biomasse',
    description: 'Extensive Nutzung nasser Wiesen mit angepassten Beständen. Schnellster Einstieg, geringste Investition, Mahd mit Breitreifen- oder Raupentechnik.',
    moor: ['niedermoor', 'hochmoor'], waterLevelCm: 25,
    yieldPerHa: 6, yieldUnit: 't TM', pricePerUnit: 105, priceUnit: '€/t TM',
    varCostPerHa: 340, establishmentPerHa: 600, ramp: [0.7, 1],
    minPeatCm: 30, minAreaHa: 0.5, harvestMonths: [6, 7, 8, 9],
    machineCategories: ['breitreifen', 'raupe-maehen', 'ballenpresse'], productCategory: 'biomasse',
    maturity: 'etabliert', marketRisk: 1, risks: 'Futterwert gering; Absatz als Einstreu/Biomasse regional unterschiedlich.',
    labourHoursPerHa: 8, fundingTags: ['extensiv', 'paludi'],
  },
  {
    id: 'buffel', name: 'Wasserbüffel-Beweidung', latin: 'Bubalus bubalis', icon: 'buffel',
    short: 'Fleisch & Landschaftspflege',
    description: 'Extensive Beweidung nasser Flächen mit Wasserbüffeln. Gute Direktvermarktung und hohe Akzeptanz im Naturschutz, aber tierhaltungsintensiv.',
    moor: ['niedermoor'], waterLevelCm: 20,
    yieldPerHa: 120, yieldUnit: 'kg SG', pricePerUnit: 9.5, priceUnit: '€/kg Schlachtgewicht',
    varCostPerHa: 560, establishmentPerHa: 2800, ramp: [0.4, 0.9, 1],
    minPeatCm: 30, minAreaHa: 5, harvestMonths: [9, 10, 11],
    machineCategories: ['transport'], productCategory: 'fleisch',
    maturity: 'etabliert', marketRisk: 1, risks: 'Tierhaltung, Winterfutter, Schlachtlogistik.',
    labourHoursPerHa: 22, fundingTags: ['extensiv', 'tier'],
  },
  {
    id: 'erle', name: 'Schwarzerle (Paludi-Forst)', latin: 'Alnus glutinosa', icon: 'erle',
    short: 'Wertholz, Brennholz',
    description: 'Langfristige Nasswald-Option für Moorstandorte mit Wasserständen nahe Flur. Erlös erst nach einigen Jahren, dafür geringe laufende Kosten und hohe Klimawirkung.',
    moor: ['niedermoor'], waterLevelCm: 10,
    yieldPerHa: 3.2, yieldUnit: 'Fm', pricePerUnit: 120, priceUnit: '€/Fm',
    varCostPerHa: 80, establishmentPerHa: 3600, ramp: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.3, 0.3, 0.6, 0.6, 1],
    minPeatCm: 40, minAreaHa: 1, harvestMonths: [11, 12, 1, 2],
    machineCategories: ['breitreifen', 'transport'], productCategory: 'holz',
    maturity: 'etabliert', marketRisk: 2, risks: 'Sehr langer Kapitalrückfluss; Wildverbiss; Waldumwandlungsrecht prüfen.',
    labourHoursPerHa: 4, fundingTags: ['wald'],
  },
  {
    id: 'torfmoos', name: 'Torfmoose (Sphagnum-Farming)', latin: 'Sphagnum spp.', icon: 'torfmoos',
    short: 'Torfersatz für Substrate',
    description: 'Anbau von Torfmoosen als nachwachsender Rohstoff für Gartenbausubstrate. Technisch aufwendig (Polder, Bewässerung), aktuell vor allem auf Hochmoor in Pilotprojekten.',
    moor: ['hochmoor'], waterLevelCm: 3,
    yieldPerHa: 4, yieldUnit: 't TM', pricePerUnit: 650, priceUnit: '€/t TM',
    varCostPerHa: 1400, establishmentPerHa: 26000, ramp: [0, 0.1, 0.5, 1],
    minPeatCm: 80, minAreaHa: 2, harvestMonths: [8, 9, 10],
    machineCategories: ['raupe-maehen', 'transport'], productCategory: 'substrat',
    maturity: 'Forschung', marketRisk: 3, risks: 'Hohe Investition, Wasserzufuhr in Trockenjahren, Marktpreis noch nicht etabliert.',
    labourHoursPerHa: 30, fundingTags: ['paludi', 'innovation'],
  },
  {
    id: 'moor_pv', name: 'Moor-PV (Freiflächen)', icon: 'moor_pv',
    short: 'Pachterlös aus Solarpark',
    description: 'Photovoltaik auf dauerhaft wiedervernässten Moorböden. Landwirt verpachtet die Fläche an einen Projektierer, Wasserstände werden dauerhaft hoch gehalten. Genehmigung und Rechtsrahmen sind aufwendig.',
    moor: ['niedermoor', 'hochmoor'], waterLevelCm: 10,
    yieldPerHa: 1, yieldUnit: 'ha Pacht', pricePerUnit: 2500, priceUnit: '€/ha Pacht (Orientierungswert Freiflächen-PV)',
    varCostPerHa: 150, establishmentPerHa: 1500, ramp: [0, 0, 0, 1],
    minPeatCm: 30, minAreaHa: 10, harvestMonths: [],
    machineCategories: [], productCategory: 'energie',
    maturity: 'Pilot', marketRisk: 2, risks: 'Bebauungsplan, Netzanschluss und EEG-Zuschlag nötig; keine Schutzgebiete; Moor-PV-Sonderregeln sollen mit dem EEG 2027 entfallen.',
    labourHoursPerHa: 1, fundingTags: ['pv'],
  },
];

export const cropById = (id: string) => CROPS.find((c) => c.id === id);

export const cropSuitable = (c: Crop, moor: MoorType, peatCm: number, areaHa: number) =>
  c.moor.includes(moor) && peatCm >= c.minPeatCm && areaHa >= c.minAreaHa;
