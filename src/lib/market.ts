import type { Listing, Machine } from './types';

export const MACHINE_CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'raupe-maehen', label: 'Raupen-Mähfahrzeuge', icon: 'raupe-maehen' },
  { id: 'breitreifen', label: 'Breitreifen-Traktoren', icon: 'breitreifen' },
  { id: 'ballenpresse', label: 'Pressen & Bergetechnik', icon: 'ballenpresse' },
  { id: 'wasserbau', label: 'Wasserbau & Bagger', icon: 'wasserbau' },
  { id: 'pflanzung', label: 'Pflanzung & Etablierung', icon: 'pflanzung' },
  { id: 'transport', label: 'Transport & Logistik', icon: 'transport' },
  { id: 'monitoring', label: 'Monitoring & Drohnen', icon: 'monitoring' },
];

export const machineCategory = (id: string) => MACHINE_CATEGORIES.find((c) => c.id === id);

export const SEED_MACHINES: Machine[] = [
  {
    id: 'm1', name: 'Mähraupe Moorcat 7.2 mit Seitenmähwerk', category: 'raupe-maehen', owner: 'Lohnunternehmen Moorkante', ownerType: 'Lohnunternehmer',
    location: [53.27, 8.92], place: 'Worpswede (NI)', pricePerDay: 520, operatorPerDay: 380, transportPerKm: 2.4, groundPressureKpa: 14, widthM: 2.4,
    description: 'Leichte Raupe mit extrem geringem Bodendruck für Mahd von Nassgrünland, Schilf und Rohrkolben. Auch bei Überstau einsetzbar.',
    features: ['Schwimmfähige Ketten', 'Seitenmähwerk 3 m', 'GPS-Dokumentation'], rating: 4.8, reviews: 31, blocked: [{ from: '2026-12-08', to: '2026-12-18' }], icon: 'raupe-maehen',
  },
  {
    id: 'm2', name: 'Rohrkolben-Erntesystem (Schneid-/Ballenkombination)', category: 'ballenpresse', owner: 'Paludi-Kooperative Peenetal', ownerType: 'Maschinenring',
    location: [53.92, 13.3], place: 'Demmin (MV)', pricePerDay: 890, operatorPerDay: 420, transportPerKm: 3.1, groundPressureKpa: 18, widthM: 3.0,
    description: 'Spezialtechnik aus MV-Pilotprojekten zur Ernte und Bündelung von Rohrkolben und Schilf in einem Arbeitsgang.',
    features: ['Mähen + Ballenpressen', 'Raupenfahrwerk', 'Bis 25 t/Tag'], rating: 4.6, reviews: 18, blocked: [{ from: '2026-12-15', to: '2027-01-10' }], icon: 'ballenpresse',
  },
  {
    id: 'm3', name: 'Mähraupe Seiga mit Schwadablage', category: 'raupe-maehen', owner: 'Maschinenring Donau-Moos', ownerType: 'Maschinenring',
    location: [48.7, 11.18], place: 'Karlshuld (BY)', pricePerDay: 460, operatorPerDay: 360, transportPerKm: 2.2, groundPressureKpa: 12, widthM: 2.1,
    description: 'Wendige Raupe für kleinparzellige Flächen im Donaumoos. Mit Schwadablage oder Ladewagenaufsatz.',
    features: ['Bodendruck 12 kPa', 'Wendig', 'Schwadablage'], rating: 4.7, reviews: 24, blocked: [], icon: 'raupe-maehen',
  },
  {
    id: 'm4', name: 'Breitreifen-Traktor 180 PS mit Terra-Bereifung', category: 'breitreifen', owner: 'Hof Meyer-Brockmann', ownerType: 'Landwirt',
    location: [52.62, 8.42], place: 'Diepholz (NI)', pricePerDay: 310, operatorPerDay: 280, transportPerKm: 1.8, groundPressureKpa: 35, widthM: 3.2,
    description: 'Schlepper mit Niederdruckreifen und Reifendruckregelanlage. Geeignet für Nassgrünland bei tragfähigen Verhältnissen.',
    features: ['RDA', 'Zwillingsbereifung', 'Hydraulik für Mähwerk'], rating: 4.4, reviews: 12, blocked: [{ from: '2026-11-02', to: '2026-11-06' }], icon: 'breitreifen',
  },
  {
    id: 'm5', name: 'Raupenbagger 14 t mit Breitkette (Grabenanstau)', category: 'wasserbau', owner: 'Tiefbau Wasserwerk Nord GmbH', ownerType: 'Lohnunternehmer',
    location: [54.31, 9.18], place: 'Erfde (SH)', pricePerDay: 680, operatorPerDay: 450, transportPerKm: 3.5, groundPressureKpa: 22, widthM: 2.5,
    description: 'Bagger mit Moorketten zum Bau von Staubauwerken, Grabenverschlüssen und Verwallungen.',
    features: ['Moorketten 900 mm', 'Grabenlöffel', 'Laser-Planiersystem'], rating: 4.9, reviews: 44, blocked: [{ from: '2026-10-20', to: '2026-11-05' }], icon: 'wasserbau',
  },
  {
    id: 'm6', name: 'Grabenfräse / Grabenräumer für Staubauwerke', category: 'wasserbau', owner: 'Naturschutzstation Eider-Treene', ownerType: 'Naturschutzverband',
    location: [54.28, 9.3], place: 'Bergenhusen (SH)', pricePerDay: 340, operatorPerDay: null, transportPerKm: 1.5, groundPressureKpa: 28, widthM: 2.2,
    description: 'Anbaugerät für Traktoren: Räumen, Profilieren und Verschließen von Gräben. Nur ohne Fahrer, Schulung vor Ort.',
    features: ['Anbaugerät', 'Einweisung inklusive'], rating: 4.5, reviews: 9, blocked: [], icon: 'wasserbau',
  },
  {
    id: 'm7', name: 'Pflanzmaschine für Rhizome (Schilf/Rohrkolben)', category: 'pflanzung', owner: 'Paludi-Pflanzservice Brandenburg', ownerType: 'Lohnunternehmer',
    location: [52.77, 12.8], place: 'Fehrbellin (BB)', pricePerDay: 640, operatorPerDay: 390, transportPerKm: 2.6, groundPressureKpa: 20, widthM: 2.8,
    description: 'Mechanisierte Pflanzung von Rhizomen und Jungpflanzen auf nassen Flächen – deutlich schneller als Handpflanzung.',
    features: ['Pflanzleistung ca. 1,5 ha/Tag', 'GPS-Reihenführung', 'Vliesauflage optional'], rating: 4.3, reviews: 15, blocked: [{ from: '2027-04-10', to: '2027-04-25' }], icon: 'pflanzung',
  },
  {
    id: 'm8', name: 'Torfmoos-Erntemaschine (Sphagnum, Pilot)', category: 'raupe-maehen', owner: 'Moorkultur Emsland eG', ownerType: 'Maschinenring',
    location: [52.85, 7.42], place: 'Meppen (NI)', pricePerDay: 1100, operatorPerDay: 480, transportPerKm: 4.0, groundPressureKpa: 9, widthM: 3.4,
    description: 'Prototyp-Erntetechnik für Torfmoose mit sehr geringem Bodendruck. Nur für Pilotflächen auf Hochmoor.',
    features: ['9 kPa', 'Saugernte', 'Pilotstatus'], rating: 4.2, reviews: 5, blocked: [], icon: 'raupe-maehen',
  },
  {
    id: 'm9', name: 'Transportraupe mit Ladefläche (3 t)', category: 'transport', owner: 'Lohnunternehmen Moorkante', ownerType: 'Lohnunternehmer',
    location: [53.2, 8.95], place: 'Grasberg (NI)', pricePerDay: 290, operatorPerDay: 340, transportPerKm: 2.0, groundPressureKpa: 15, widthM: 2.0,
    description: 'Bringt Ballen und Material von der Fläche zum befestigten Weg. Ideal in Kombination mit Mähraupe.',
    features: ['3 t Nutzlast', 'Kippmulde', 'Greifer optional'], rating: 4.6, reviews: 20, blocked: [], icon: 'transport',
  },
  {
    id: 'm10', name: 'Messdrohne + Wasserstandslogger-Set (Monitoring)', category: 'monitoring', owner: 'Geo-Service Moorwacht', ownerType: 'Lohnunternehmer',
    location: [51.95, 13.95], place: 'Lübben (BB)', pricePerDay: 180, operatorPerDay: 260, transportPerKm: 0.9, groundPressureKpa: 0, widthM: 0,
    description: 'Multispektraldrohne und 10 Pegellogger für Nachweis von Wasserständen gegenüber Fördergebern.',
    features: ['Orthofoto 3 cm', 'Wasserstandsprofil', 'Förderkonformer Bericht'], rating: 4.7, reviews: 27, blocked: [], icon: 'monitoring',
  },
  {
    id: 'm11', name: 'Ballenpresse für nasse Biomasse (Rundballen, Raupenfahrwerk)', category: 'ballenpresse', owner: 'Agrar GmbH Rhinluch', ownerType: 'Lohnunternehmer',
    location: [52.7, 12.62], place: 'Kremmen (BB)', pricePerDay: 470, operatorPerDay: 360, transportPerKm: 2.2, groundPressureKpa: 16, widthM: 2.6,
    description: 'Presse mit Raupenunterbau für Heu und Schilf auf nassen Standorten.',
    features: ['Rundballen 1,2 m', 'Raupenfahrwerk', 'Wickelgerät'], rating: 4.4, reviews: 14, blocked: [{ from: '2026-11-10', to: '2026-11-24' }], icon: 'ballenpresse',
  },
  {
    id: 'm12', name: 'Breitreifen-Traktor mit Mähwerk-Kombination', category: 'breitreifen', owner: 'Hof Reiter', ownerType: 'Landwirt',
    location: [47.8, 12.1], place: 'Bad Aibling (BY)', pricePerDay: 270, operatorPerDay: 260, transportPerKm: 1.7, groundPressureKpa: 32, widthM: 3.0,
    description: 'Traktor mit Terra-Reifen und Front-/Heckmähwerk, vor allem für Streuwiesen und Nassgrünland.',
    features: ['Front-/Heckmähwerk', 'Terra-Bereifung'], rating: 4.5, reviews: 11, blocked: [], icon: 'breitreifen',
  },
];

export const PRODUCT_CATEGORIES: { id: string; label: string; icon: string; unit: string }[] = [
  { id: 'baustoff', label: 'Baustoffe (Rohrkolben)', icon: 'baustoff', unit: 't' },
  { id: 'reet', label: 'Reet & Schilf', icon: 'reet', unit: 'Bund' },
  { id: 'biomasse', label: 'Biomasse, Einstreu, Heu', icon: 'biomasse', unit: 't' },
  { id: 'substrat', label: 'Torfersatz-Substrate', icon: 'substrat', unit: 'm³' },
  { id: 'holz', label: 'Erlenholz', icon: 'holz', unit: 'Fm' },
  { id: 'fleisch', label: 'Fleisch & Lebensmittel', icon: 'fleisch', unit: 'kg' },
  { id: 'zertifikat', label: 'Moor-Klimazertifikate', icon: 'zertifikat', unit: 't CO₂' },
  { id: 'energie', label: 'Energie (Pellets, PV-Fläche)', icon: 'energie', unit: 't' },
];

export const productCategory = (id: string) => PRODUCT_CATEGORIES.find((c) => c.id === id);

/** Referenzpreise je Kategorie (für den Preisvergleich) */
export const PRICE_BENCHMARK: Record<string, number> = {
  baustoff: 150, reet: 1.9, biomasse: 105, substrat: 55, holz: 120, fleisch: 9.5, zertifikat: 65, energie: 190,
};

export const SEED_LISTINGS: Listing[] = [
  { id: 'l1', type: 'angebot', title: 'Rohrkolben-Häcksel, gepresste Ballen', category: 'baustoff', cropId: 'rohrkolben', quantity: 45, unit: 't', pricePerUnit: 165, region: 'Demmin (MV)', location: [53.9, 13.03], availableFrom: '2027-02-01', quality: 'Trockenmasse >85 %, Ernte Winter 2026/27', description: 'Aus Paludi-Pilotfläche im Peenetal, geeignet für Dämmplatten und Leichtlehm.', owner: 'Agrar Peenetal GbR', createdAt: '2026-09-18' },
  { id: 'l2', type: 'gesuch', title: 'Suche Rohrkolben-Biomasse für Dämmplattenwerk', category: 'baustoff', cropId: 'rohrkolben', quantity: 120, unit: 't', pricePerUnit: 175, region: 'Norddeutschland', location: [53.55, 12.1], availableFrom: '2027-01-15', quality: 'Trockenmasse >80 %, Fremdstoffe <2 %', description: 'Hersteller sucht regionale Lieferanten für Paludi-Dämmstoffe, langfristige Abnahmevereinbarung möglich.', owner: 'ÖkoDämm Mecklenburg GmbH', createdAt: '2026-09-28' },
  { id: 'l3', type: 'angebot', title: 'Dachreet, Qualität A, Bund à 1,15 m Umfang', category: 'reet', cropId: 'schilf', quantity: 3500, unit: 'Bund', pricePerUnit: 2.1, region: 'Rostock (MV)', location: [54.0, 12.3], availableFrom: '2027-03-01', quality: 'Qualität A, sortiert, getrocknet', description: 'Heimisches Reet aus Moorpolder, Lieferung ab Hof oder frei Baustelle.', owner: 'Reetwirtschaft Recknitz', createdAt: '2026-09-02' },
  { id: 'l4', type: 'gesuch', title: 'Schilfhäcksel als Einstreu / Pellets', category: 'reet', cropId: 'schilf', quantity: 80, unit: 't', pricePerUnit: 150, region: 'Brandenburg', location: [52.5, 13.0], availableFrom: '2027-02-15', quality: 'trocken, gehäckselt', description: 'Pelletwerk sucht Schilfbiomasse aus Paludikultur.', owner: 'BrandPellet GmbH', createdAt: '2026-10-01' },
  { id: 'l5', type: 'angebot', title: 'Heu aus Nasswiesen, Rundballen (Einstreuqualität)', category: 'biomasse', cropId: 'nassgruenland', quantity: 60, unit: 't', pricePerUnit: 95, region: 'Worpswede (NI)', location: [53.22, 8.95], availableFrom: '2026-11-01', quality: 'Einstreu / Pferdehaltung', description: 'Spätschnitt von Moorweiden, keine Düngung, geringe Futterqualität.', owner: 'Moorhof Eickhorst', createdAt: '2026-08-21' },
  { id: 'l6', type: 'gesuch', title: 'Nassgrünland-Biomasse für Biogas / Festbrennstoff', category: 'biomasse', cropId: 'nassgruenland', quantity: 300, unit: 't', pricePerUnit: 100, region: 'Niedersachsen', location: [52.9, 8.8], availableFrom: '2026-12-01', quality: 'TM >75 %', description: 'Biomasseheizwerk nimmt extensive Moorbiomasse zu festem Preis ab.', owner: 'Heizwerk Wesermarsch', createdAt: '2026-09-24' },
  { id: 'l7', type: 'angebot', title: 'Torfmoos-Frischmasse (Sphagnum) für Substratversuch', category: 'substrat', cropId: 'torfmoos', quantity: 25, unit: 'm³', pricePerUnit: 60, region: 'Meppen (NI)', location: [52.85, 7.4], availableFrom: '2026-11-15', quality: 'Pilotfläche, sortenrein', description: 'Frisch geerntet, für Versuche und Kleinmengen in Gartenbau-Substraten.', owner: 'Moorkultur Emsland eG', createdAt: '2026-09-10' },
  { id: 'l8', type: 'gesuch', title: 'Torfmoos für Gartenbausubstrat (Jahresvertrag)', category: 'substrat', cropId: 'torfmoos', quantity: 500, unit: 'm³', pricePerUnit: 62, region: 'Niedersachsen', location: [52.8, 8.0], availableFrom: '2027-03-01', quality: 'Frisch oder vorgetrocknet', description: 'Substrathersteller sucht torffreie Rohstoffe für Premium-Substrat.', owner: 'Erdenwerk Weser-Ems', createdAt: '2026-09-30' },
  { id: 'l9', type: 'angebot', title: 'Schwarzerle Stammholz, Brennholz-Qualität', category: 'holz', cropId: 'erle', quantity: 40, unit: 'Fm', pricePerUnit: 95, region: 'Eider-Treene (SH)', location: [54.3, 9.2], availableFrom: '2027-01-15', quality: 'Meterholz, trocken', description: 'Pflegehiebe aus Erlenbruch.', owner: 'Forstbetrieb Treene', createdAt: '2026-08-30' },
  { id: 'l10', type: 'angebot', title: 'Wasserbüffel-Fleisch, Direktvermarktung (Mischpaket)', category: 'fleisch', cropId: 'buffel', quantity: 400, unit: 'kg', pricePerUnit: 18, region: 'Havelland (BB)', location: [52.7, 12.5], availableFrom: '2026-11-10', quality: 'Bio-zertifiziert, Weidehaltung', description: 'Rind- und Büffelfleisch aus extensiver Nassweide im Havelländischen Luch.', owner: 'Büffelhof Havelluch', createdAt: '2026-09-12' },
  { id: 'l11', type: 'gesuch', title: 'Wasserbüffel-Fleisch für Gastronomie', category: 'fleisch', cropId: 'buffel', quantity: 200, unit: 'kg', pricePerUnit: 20, region: 'Berlin/Brandenburg', location: [52.5, 13.3], availableFrom: '2026-11-20', quality: 'regional, Bio bevorzugt', description: 'Restaurantgruppe sucht regionale Lieferanten für Saisonmenü.', owner: 'Landküche Berlin', createdAt: '2026-10-02' },
  { id: 'l12', type: 'angebot', title: 'Moor-Klimazertifikate (regional, validiert)', category: 'zertifikat', quantity: 800, unit: 't CO₂', pricePerUnit: 72, region: 'Mecklenburg-Vorpommern', location: [53.7, 12.7], availableFrom: '2026-11-01', quality: 'Moor-Standard, validiert', description: 'Zertifikate aus wiedervernässten Niedermoorflächen.', owner: 'Moorstiftung MV', createdAt: '2026-09-05' },
  { id: 'l13', type: 'gesuch', title: 'Regionale Moorzertifikate für Unternehmensflotte', category: 'zertifikat', quantity: 1500, unit: 't CO₂', pricePerUnit: 68, region: 'bundesweit', location: [51.3, 10.4], availableFrom: '2026-12-01', quality: 'regional, mit Projektbezug', description: 'Mittelständisches Unternehmen sucht Klimaschutzprojekte in der Region zur Kompensation von Restemissionen.', owner: 'Regio-Logistik AG', createdAt: '2026-09-29' },
  { id: 'l14', type: 'gesuch', title: 'Fläche für Moor-PV (Verpachtung, ab 10 ha)', category: 'energie', cropId: 'moor_pv', quantity: 60, unit: 'ha', pricePerUnit: 2300, region: 'Brandenburg / MV', location: [53.0, 13.2], availableFrom: '2027-06-01', quality: 'Niedermoor, wiedervernässbar', description: 'Projektierer sucht Flächen zur Entwicklung wiedervernässter Moor-PV-Projekte.', owner: 'SolarMoor Energie GmbH', createdAt: '2026-09-27' },
];
