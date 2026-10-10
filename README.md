# Paludio – Plattform für Moor-Wiedervernässung & Paludikultur

**Paludio** ist ein lauffähiger Prototyp einer modernen Web-Plattform, die Landwirte in ganz Deutschland dabei unterstützt, entwässerte Moorflächen zu identifizieren, Wiedervernässungs- und Anbauszenarien (Paludikultur) zu berechnen, Fördermittel zu sichern, den laufenden Betrieb mit Sensor-Monitoring zu begleiten sowie Maschinen und Produkte über integrierte Marktplätze zu handeln.

Live auf GitHub Pages: **https://felixschoeck.github.io/paludio/**

---

## Kernfunktionen im Überblick

### 1. Deutschlandweite Kartierung & Flurstücksauswahl (`/karte`)
- **Abdeckung ganz Deutschland**: Interaktive Karte mit Leaflet, OpenStreetMap- und hochauflösendem Luftbild-Modus.
- **Moorboden-Layer**: Thünen-Kulisse organischer Böden (2023), als Kartenebene direkt vom WMS des Thünen-Atlas; für Berechnungen als Vektorkacheln mit Bodenkategorie und Torfmächtigkeitsklasse mitgeliefert.
- **Flurstücksebene (Kataster)**: Bei Hineinzoomen (Zoom 14+) werden einzelne Flurstücke mit Kennzeichen, Gemarkung, Flächengröße (ha), aktuellem Wasserflurabstand, Torfmächtigkeit und Entwässerungsart angezeigt und können per Klick ausgewählt werden.
- **Eigene Flächen zeichnen**: Polygon-Zeichenmodus für benutzerdefinierte Flächengrenzen.
- **Ort- & Moorregionssuche**: Schnellsprung zu bekannten Moorgebieten (z. B. Teufelsmoor, Donaumoos, Peenetal, Emsland, Drömling, Rhinluch) oder Volltextsuche via Nominatim/OSM.

### 2. Wissenschaftlicher Planer & Wirtschaftlichkeitsrechner (`/planer`)
- **Kulturen-Katalog**: Rohrkolben (*Typha*), Schilf/Reet (*Phragmites*), Nassgrünland, Torfmoose (*Sphagnum*), Schwarzerle, Wasserbüffel-Beweidung, Moor-PV.
- **Standort-Eignungsprüfung**: Automatische Prüfung auf Moortyp (Nieder- vs. Hochmoor), minimale Torftiefe und Flächengröße.
- **THG-Emissionsmodell (GEST-Ansatz)**: Berechnung der vermiedenen Treibhausgasemissionen (t CO₂-Äq./ha·a) basierend auf dem Anheben des Wasserflurabstands.
- **Investitions- und Wasserbaukosten**: Differenzierte Kalkulation für Planung, Genehmigung, Grabenverschlüsse, Stauanlagen, Verwallungen und Pflanzgut.
- **Multi-Perioden-Cashflow & DCF-Modell**: 10–30 Jahre Prognose mit Hochlaufkurven (Ramp-up), CO₂-Zertifikatserlösen, laufenden variablen Kosten, Opportunitätskosten (entgangener Deckungsbeitrag bisheriger Acker-/Grünlandnutzung), Kapitalwert (NPV) und Amortisationsdauer.
- **Szenarien-Vergleich**: Ranking aller Optionen auf einen Blick mit "Beste Option"-Kennzeichnung.

### 3. Förderfinder & digitaler Antragsassistent (`/foerderung`)
- **Bundes- & Landesprogramme**: Automatische Filterung und Zuordnung für alle 16 Bundesländer (z. B. Bundesprogramm Natürlicher Klimaschutz ANK, GAK-Moorschutz, Moorbauernprogramm Bayern, Richtlinien MV, NI, SH, BB, etc.) sowie EU-GAP (Basisprämie bleibt bei Paludikultur erhalten) und Rentenbank-Kredite.
- **Interaktiver 5-Schritte-Antragsassistent**:
  1. Flächenauswahl
  2. Betriebsdaten & Stammdaten
  3. Vorhabenbeschreibung & Kosten
  4. Dokumente & Nachweise (Flurstücksnachweis, Wasserbauplan etc.)
  5. Verbindliche Einreichung mit simulierter Statusverfolgung (Eingegangen ➔ In Prüfung ➔ Bewilligt).

### 4. Betriebs-Cockpit & Sensor-Monitoring (`/betrieb`)
- **Interaktiver Zeitraffer**: Über einen Schieberegler kann das Projekt vom Startmonat über Genehmigung (Monat 2), Bau (Monat 7) und Etablierung (Monat 9) bis in den langjährigen Regelbetrieb (bis Monat 96) durchgespielt werden.
- **Pegeldaten & Wasserstandskorridor**: 12-Monats-Wasserstandsganglinie mit Zielkorridor (±10 cm), Niederschlagsverteilung und Export als CSV-Wasserstandsprotokoll für Behörden.
- **Intelligente Empfehlungs-Engine**: Kontextbezogene Warnungen und Handlungsempfehlungen (z. B. "Wasserstand 18 cm unter Ziel – Stauklappe schließen", "Erntefenster in 40 Tagen – Mähraupe reservieren", "Verwendungsnachweis fällig").
- **Phasen-Aufgabenliste**: Vordefinierte Checklisten für alle Projektphasen.

### 5. Digitaler Maschinenmarkt (`/maschinen`)
- **Spezialtechnik mit niedrigem Bodendruck**: Mähraupen (Bodendruck bis unter 15 kPa), Breitreifentraktoren mit Reifendruckregelanlage, Wasserbaubagger mit Moorketten, Grabenfräsen, Rhizompflanzmaschinen und Messdrohnen.
- **Filter**: Kategorie, maximaler Bodendruck (kPa), Umkreis (km) ab Betriebsstandort, mit/ohne Fahrer.
- **Verfügbarkeitskalender & Buchungsrechner**: Prüfung auf Überschneidungen, automatische Frachtkostenberechnung nach Entfernung und verbindliche Buchungsanfrage.
- **Eigenes Inserat**: Landwirte und Lohnunternehmer können freie Kapazitäten einstellen.

### 6. Paludi-Produktmarkt (`/produkte`)
- **Rohstoff- & Produkthandel**: Angebote und Gesuche für Baustoffe (Rohrkolben), Reet & Dachschilf, Biomasse/Einstreu, Torfmoos-Substrate, Wertholz, Wasserbüffelfleisch und validierte Moor-Klimazertifikate.
- **Automatisches Ernte-Matching**: Erkennt automatisch die Kultur des Landwirts und hebt passende Abnehmer-Gesuche hervor.
- **Marktpreis-Richtwerte**: Orientierung an realen Benchmark-Preisen.
- **Direktanfragen**: Integriertes Anfragemodal zur Vereinbarung von Liefermengen und Konditionen.

---

## Datengrundlagen

| Wert | Quelle | Hinweis |
|---|---|---|
| Flurstücke BW (Grenzen, Kennzeichen, amtliche Fläche, Gemarkung) | LGL Baden-Württemberg, INSPIRE-WFS ALKIS (dl-de/by-2-0) | live ab Zoomstufe 15, im Browser 90 Tage zwischengespeichert |
| Flurstücke übrige Länder | Katastermodell | keine amtlichen Daten |
| Moor ja/nein, Bodenkategorie, Torfmächtigkeitsklasse | Thünen-Institut, Kulisse organischer Böden 2023 (CC BY 4.0, Working Paper 212) | Vektorkacheln (auf ca. 2 m vereinfacht); Flurstück gilt als Moor, wenn ≥ 50 % der Fläche organisch sind; Torf als Klassenmitte |
| Wasserstand, heutige Nutzung | Angabe des Betriebs (Messung, Gutachten, Sammelantrag) | ohne Angabe rechnet der Planer mit einer sichtbaren, änderbaren Annahme (Standard: Grünland intensiv, 50 cm unter Flur) |
| Förderprogramme | Förderrichtlinie Palu u. a., mit Quelle und Stand je Programm | Anträge werden nur lokal vorbereitet, nie übertragen |

Die Vektorkacheln werden mit `python scripts/build_kulisse.py public/data/kulisse` aus dem WFS des Thünen-Atlas neu erzeugt (ca. 15 MB, 2.643 Kacheln).

## Technische Architektur

- **Frontend-Framework**: React 19 + TypeScript
- **Bundler & Dev Server**: Vite 7
- **Routing**: React Router 7
- **Karten-Engine**: Leaflet 1.9 mit benutzerdefinierten GridLayer-Canvas-Renderern für extrem performante Vektordarstellung von Moorkulisse und Flurstücken ohne externe Serverabhängigkeit
- **Diagramme**: SVG-Diagramme (`LineChart`, `BarChart`) für Bandbreiten, Zeitreihen und Cashflow ohne aufgeblähte Chart-Bibliotheken
- **State Management & Persistenz**: React Context + Custom Hook mit automatischer Synchronisation in den `localStorage`

---

## Installation & Start

1. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```

2. **Entwicklungsserver starten:**
   ```bash
   npm run dev
   ```
   Die Anwendung läuft anschließend unter `http://localhost:5173`.

3. **Produktions-Build erstellen:**
   ```bash
   npm run build
   ```

---

## Schnelleinstieg für die Präsentation

In der linken Seitenleiste befindet sich der Button **„Demobetrieb laden“**:
- Lädt den Betrieb *Moorhof Eickhorst* im **Teufelsmoor (Niedersachsen)**.
- Enthält 4 verknüpfte Flurstücke (Eigentum & Pacht) auf Niedermoor mit 220 cm Torfmächtigkeit.
- Lädt einen fertigen Plan für **Rohrkolben-Paludikultur (11,4 ha)**.
- Startet ein aktives Vorhaben in **Monat 13 (Regelbetrieb)** mit gefüllten Pegelständen, Empfehlungen und einem eingereichten Förderantrag.
- Zeigt im Maschinen- und Produktmarkt passende Treffer für die Erntelogistik.
