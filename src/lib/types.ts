export type BL =
  | 'SH' | 'HH' | 'NI' | 'HB' | 'NW' | 'HE' | 'RP' | 'SL'
  | 'BW' | 'BY' | 'BE' | 'BB' | 'MV' | 'SN' | 'ST' | 'TH';

export type LandUse = 'acker' | 'gruenland_intensiv' | 'gruenland_extensiv' | 'brache';
export type MoorType = 'niedermoor' | 'hochmoor' | 'mineral';
export type Tenure = 'eigentum' | 'pacht';
export type LatLng = [number, number];

export interface AlkisMeta {
  flurstueckskennzeichen: string;
  flurstuecksnummer: string;
  gemarkungSchluessel: string;
  amtlicheFlaecheQm: number;
  katasteramt: string;
  aktualitaet: string;
  source: 'LGL_BW_ALKIS_WFS' | 'LGL_BW_ALKIS_OPEN';
}

export interface Parcel {
  /** interner, stabiler Schlüssel */
  id: string;
  /** Flurstückskennzeichen (Anzeige) */
  label: string;
  ring: LatLng[];
  areaHa: number;
  centroid: LatLng;
  bundesland: BL;
  gemarkung: string;
  moorType: MoorType;
  peatDepthCm: number;
  landUse: LandUse;
  /** mittlerer Wasserflurabstand in cm unter Gelände (positiv = unter Flur) */
  waterLevelCm: number;
  drainage: 'drainage' | 'graeben' | 'keine';
  regionId?: string;
  custom?: boolean;
  tenure?: Tenure;
  /** Ob das Flurstück aus amtlichem ALKIS-Kataster stammt (Baden-Württemberg) */
  isAlkis?: boolean;
  alkis?: AlkisMeta;
}

export interface Farm {
  name: string;
  owner: string;
  betriebsnummer: string;
  email: string;
  phone: string;
  iban: string;
  legalForm: string;
  /** Anschrift des Betriebssitzes (Straße, PLZ, Ort) */
  address?: string;
  /** Standort des Betriebs für Entfernungsberechnung (Maschinenmarkt) */
  location: LatLng;
  locationName: string;
  farmingType?: 'konventionell' | 'oekologisch';
  focus?: 'milchvieh' | 'ackerbau' | 'mutterkuh' | 'sonderkulturen' | 'nebenerwerb';
  organicAssociation?: string;
}

export interface PlanDraft {
  parcelIds: string[];
  cropId: string;
  /** optional: abweichender Ziel-Wasserstand (cm unter Flur) */
  targetWlCm: number | null;
  co2Price: number;
  sellCertificates: boolean;
  useFunding: boolean;
  horizonYears: number;
  discountRate: number;
}

export interface SavedPlan {
  id: string;
  name: string;
  createdAt: string;
  draft: PlanDraft;
}

export interface Project {
  id: string;
  planId: string;
  name: string;
  /** ISO-Datum des Projektstarts */
  startDate: string;
  /** simulierter Monat seit Start (Zeitraffer im Prototyp) */
  simMonth: number;
  tasks: Record<string, boolean>;
}

export type AppStatus = 'entwurf' | 'eingereicht' | 'bewilligt' | 'abgelehnt';

export interface ApplicationParcelInfo {
  /** Ende des laufenden Pachtvertrags (bestimmt bei Palu 3.B die Laufzeit) */
  leaseEnd?: string;
  /** seit mindestens 5 Jahren landwirtschaftlich genutzt (Palu 3.A/3.B) */
  agriUse5y?: boolean;
}

export interface ApplicationDeclarations {
  /** keine andere öffentliche Förderung für dieselbe Maßnahme (Palu Nr. 6.6) */
  noDoubleFunding: boolean;
  /** Maßnahme wurde noch nicht begonnen */
  notStarted: boolean;
  /** Unternehmen ist ein KMU */
  kmu: boolean;
  /** De-minimis-Beihilfen der letzten drei Jahre in € */
  deminimisEur: number | null;
}

export interface Application {
  id: string;
  programId: string;
  programName: string;
  parcelIds: string[];
  createdAt: string;
  submittedAt?: string;
  status: AppStatus;
  amountRequested: number;
  data: {
    measure: string;
    totalCost: number;
    startDate: string;
    note: string;
    docs: Record<string, boolean>;
    confirmed: boolean;
    /** förderfähige Kosten nach Kostenteil */
    costs?: { planning: number; waterworks: number; establishment: number };
    targetWlCm?: number;
    cropId?: string;
    bodenrichtwert?: number | null;
    parcelInfo?: Record<string, ApplicationParcelInfo>;
    declarations?: ApplicationDeclarations;
    /** Aktenzeichen bzw. Vorgangsnummer im Portal der Bewilligungsstelle */
    portalRef?: string;
  };
}

export interface Booking {
  id: string;
  machineId: string;
  machineName: string;
  from: string;
  to: string;
  withOperator: boolean;
  total: number;
  createdAt: string;
  note: string;
}

export interface Machine {
  id: string;
  name: string;
  category: string;
  owner: string;
  ownerType: 'Lohnunternehmer' | 'Maschinenring' | 'Landwirt' | 'Naturschutzverband';
  location: LatLng;
  place: string;
  pricePerDay: number;
  operatorPerDay: number | null;
  transportPerKm: number;
  groundPressureKpa: number;
  widthM: number;
  description: string;
  features: string[];
  rating: number;
  reviews: number;
  blocked: { from: string; to: string }[];
  own?: boolean;
  icon: string;
}

export type ListingType = 'angebot' | 'gesuch';

export interface Listing {
  id: string;
  type: ListingType;
  title: string;
  category: string;
  /** Verknüpfung zur Paludi-Kultur (für Matching) */
  cropId?: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  region: string;
  location: LatLng;
  availableFrom: string;
  quality: string;
  description: string;
  owner: string;
  own?: boolean;
  createdAt: string;
}

export interface Inquiry {
  id: string;
  listingId: string;
  listingTitle: string;
  quantity: number;
  message: string;
  createdAt: string;
}
