import { useState, useMemo } from 'react';
import { useStore } from '../lib/store';
import { BUNDESLAENDER } from '../lib/geo';
import { BW_ALKIS_PARCELS } from '../lib/alkis_bw';
import { findMoorParcels } from '../lib/parcels';
import type { Farm, Parcel, BL, Tenure } from '../lib/types';
import {
  Building2,
  MapPin,
  Database,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Layers,
  Sprout,
  Wheat,
  Leaf,
  Sun,
  Activity,
  Euro,
  Info,
  Sparkles,
  Check,
  X,
} from './Icons';
import { Badge, nf } from './ui';
import { Logo } from './Logo';

interface Props {
  onClose?: () => void;
}

export default function FarmerOnboarding({ onClose }: Props) {
  const { state, completeOnboarding, loadBwDemo, loadDemo } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [farmName, setFarmName] = useState(state.farm.name || 'Hofgut Federsee');
  const [owner, setOwner] = useState(state.farm.owner || 'Johannes Maier');
  const [betriebsnummer, setBetriebsnummer] = useState(state.farm.betriebsnummer || '08 426 001 0492');
  const [legalForm, setLegalForm] = useState(state.farm.legalForm || 'GbR');
  const [bundesland, setBundesland] = useState<BL>((state.farm.locationName?.includes('NI') ? 'NI' : 'BW') as BL);
  const [locationName, setLocationName] = useState(state.farm.locationName || 'Bad Buchau (BW)');
  const [email, setEmail] = useState(state.farm.email || 'johannes.maier@hofgut-federsee.example');
  const [phone, setPhone] = useState(state.farm.phone || '07582 938210');

  // Step 2: Ausgangslage
  const [farmingType, setFarmingType] = useState<'konventionell' | 'oekologisch'>(state.farm.farmingType || 'konventionell');
  const [organicAssociation, setOrganicAssociation] = useState(state.farm.organicAssociation || 'Bioland');
  const [focus, setFocus] = useState<'milchvieh' | 'ackerbau' | 'mutterkuh' | 'sonderkulturen' | 'nebenerwerb'>(state.farm.focus || 'milchvieh');
  const [landUsage, setLandUsage] = useState<'gruenland_intensiv' | 'acker' | 'gruenland_extensiv' | 'brache'>('gruenland_intensiv');
  const [drainageType, setDrainageType] = useState<'graeben' | 'drainage' | 'keine'>('graeben');
  const [mainMotivation, setMainMotivation] = useState<'sackung' | 'gloe2' | 'ertrag' | 'kosten'>('sackung');

  // Step 3: Ziele & Förderung
  const [targetCrop, setTargetCrop] = useState<'rohrkolben' | 'nassgruenland' | 'torfmoos' | 'moor_pv'>('rohrkolben');
  const [fundingPrograms, setFundingPrograms] = useState<string[]>(['ank_bund', 'bw_moorbauern']);

  // Step 4: Flurstücks-Vorauswahl
  const [parcelOption, setParcelOption] = useState<'alkis_bw' | 'teufelsmoor' | 'leer'>('alkis_bw');

  const selectedParcels = useMemo<Parcel[]>(() => {
    if (parcelOption === 'alkis_bw') {
      return BW_ALKIS_PARCELS.slice(0, 3).map((p, idx) => ({
        ...p,
        tenure: (idx === 2 ? 'pacht' : 'eigentum') as Tenure,
      }));
    }
    if (parcelOption === 'teufelsmoor') {
      return findMoorParcels([53.24, 8.98], 4, 3).map((p, idx) => ({
        ...p,
        tenure: (idx === 3 ? 'pacht' : 'eigentum') as Tenure,
      }));
    }
    return [];
  }, [parcelOption]);

  const toggleFunding = (p: string) => {
    setFundingPrograms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const handleFinish = () => {
    const farmPatch: Partial<Farm> = {
      name: farmName.trim() || 'Landwirtschaftlicher Betrieb',
      owner: owner.trim() || 'Betriebsleitung',
      betriebsnummer: betriebsnummer.trim() || '08 000 000 0000',
      legalForm,
      locationName,
      location: bundesland === 'BW' ? [48.053, 9.585] : [53.22, 8.95],
      email,
      phone,
      farmingType,
      focus,
      organicAssociation: farmingType === 'oekologisch' ? organicAssociation : undefined,
    };

    completeOnboarding(farmPatch, selectedParcels);
    if (onClose) onClose();
  };

  const STEPS = [
    { n: 1 as const, label: 'Betrieb & Kataster', sub: 'Stammdaten und Bundesland' },
    { n: 2 as const, label: 'Moor-Ausgangslage', sub: 'Flächen, Torf und Wasserstand' },
    { n: 3 as const, label: 'Ziele & Förderung', sub: 'Was Sie erreichen wollen' },
    { n: 4 as const, label: 'Flurstücke & Start', sub: 'Flächen prüfen und loslegen' },
  ];
  const current = STEPS[step - 1];

  return (
    <div className="onboarding-screen" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      {/* Seitenspalte mit Schritten */}
      <aside className="onboarding-side">
        <div className="brand">
          <Logo />
          <span>
            <div className="brand-name">Paludio</div>
            <div className="brand-sub">Moor &amp; Paludikultur</div>
          </span>
        </div>

        <div className="onboarding-intro">
          <h2>Betrieb einrichten</h2>
          <p>In vier kurzen Schritten zu Ihrem Moor-Kataster und den ersten Berechnungen.</p>
        </div>

        <ol className="onboarding-steps">
          {STEPS.map((s) => (
            <li key={s.n} className={step === s.n ? 'cur' : step > s.n ? 'done' : ''}>
              <button type="button" onClick={() => setStep(s.n)} aria-current={step === s.n ? 'step' : undefined}>
                <span className="journey-dot">{step > s.n ? <Check size={14} strokeWidth={2.5} /> : s.n}</span>
                <span className="journey-text">
                  <span className="journey-label">{s.label}</span>
                  <span className="journey-detail">{s.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="onboarding-demo">
          <span className="muted small">Erst einmal ausprobieren?</span>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              loadBwDemo();
              if (onClose) onClose();
            }}
          >
            <Sparkles size={14} /> Musterbetrieb Baden-Württemberg
          </button>
          <button
            type="button"
            className="btn small ghost"
            onClick={() => {
              loadDemo();
              if (onClose) onClose();
            }}
          >
            Musterbetrieb Teufelsmoor (NI)
          </button>
        </div>
      </aside>

      {/* Inhalt */}
      <main className="onboarding-main">
        <header className="onboarding-main-head">
          <div>
            <span className="muted small">Schritt {step} von 4</span>
            <h1 id="onb-title">{current.label}</h1>
          </div>
          {state.onboarded && onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Onboarding schließen">
              <X size={20} />
            </button>
          )}
        </header>

        <div className="onboarding-content">
          {/* STEP 1: Betrieb & Kataster */}
          {step === 1 && (
            <div className="stack gap">
              <div className="grid-2">
                <div>
                  <label className="field-label">Betriebsname *</label>
                  <input
                    className="enterprise-input"
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    placeholder="z. B. Hofgut Federsee"
                  />
                </div>
                <div>
                  <label className="field-label">Betriebsleiter / Inhaber *</label>
                  <input
                    className="enterprise-input"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="z. B. Johannes Maier"
                  />
                </div>
              </div>

              <div className="grid-3">
                <div>
                  <label className="field-label">VVVO- / Betriebsnummer (BALIS/InVeKoS)</label>
                  <input
                    className="enterprise-input"
                    value={betriebsnummer}
                    onChange={(e) => setBetriebsnummer(e.target.value)}
                    placeholder="z. B. 08 426 001 0492"
                  />
                </div>
                <div>
                  <label className="field-label">Rechtsform</label>
                  <select
                    className="enterprise-select"
                    value={legalForm}
                    onChange={(e) => setLegalForm(e.target.value)}
                  >
                    <option value="Einzelunternehmen">Einzelunternehmen</option>
                    <option value="GbR">GbR (Gesellschaft bürgerlichen Rechts)</option>
                    <option value="GmbH & Co. KG">GmbH & Co. KG</option>
                    <option value="eG">eingetragene Genossenschaft (eG)</option>
                    <option value="GmbH">GmbH</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Bundesland *</label>
                  <select
                    className="enterprise-select"
                    value={bundesland}
                    onChange={(e) => {
                      const bl = e.target.value as BL;
                      setBundesland(bl);
                      if (bl === 'BW') {
                        setLocationName('Bad Buchau (BW)');
                        setParcelOption('alkis_bw');
                      } else {
                        setLocationName(`${BUNDESLAENDER[bl]?.name || bl} (${bl})`);
                        setParcelOption('teufelsmoor');
                      }
                    }}
                  >
                    {Object.entries(BUNDESLAENDER).map(([code, b]) => (
                      <option key={code} value={code}>
                        {b.name} {code === 'BW' ? '★ (Amtliche Flurstücke)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {bundesland === 'BW' ? (
                <div className="enterprise-callout success">
                  <Database size={18} className="icon-inline" />
                  <div>
                    <b>Amtliche Flurstücke verfügbar</b>
                    <p>
                      Für Baden-Württemberg lädt Paludio Ihre Flurstücke direkt vom Landesamt für Geoinformation (LGL BW), mit amtlichem Kennzeichen und amtlicher Fläche.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="enterprise-callout neutral">
                  <Layers size={18} className="icon-inline" />
                  <div>
                    <b>Katastermodell</b>
                    <p>
                      Für {BUNDESLAENDER[bundesland]?.name} bildet Paludio Flurstücke aus einem Modell auf Basis der Moorbodenkarte des Thünen-Instituts ab. Amtliche Daten gibt es bisher nur für Baden-Württemberg.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid-3">
                <div>
                  <label className="field-label">Standort / Gemeinde</label>
                  <input
                    className="enterprise-input"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="z. B. Bad Buchau (BW)"
                  />
                </div>
                <div>
                  <label className="field-label">E-Mail (Betriebskontakt)</label>
                  <input
                    className="enterprise-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="betrieb@beispiel.de"
                  />
                </div>
                <div>
                  <label className="field-label">Telefon</label>
                  <input
                    className="enterprise-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07582 12345"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Moor-Ausgangslage */}
          {step === 2 && (
            <div className="stack gap">
              <div>
                <label className="field-label">Bewirtschaftungsform</label>
                <div className="grid-2">
                  <div
                    className={`enterprise-select-card ${farmingType === 'konventionell' ? 'selected' : ''}`}
                    onClick={() => setFarmingType('konventionell')}
                  >
                    <Building2 size={20} />
                    <div>
                      <b>Konventionelle Landwirtschaft</b>
                      <div className="muted small">Standard-GAP-Förderung, GLÖZ-Konditionalität</div>
                    </div>
                  </div>
                  <div
                    className={`enterprise-select-card ${farmingType === 'oekologisch' ? 'selected' : ''}`}
                    onClick={() => setFarmingType('oekologisch')}
                  >
                    <Sprout size={20} />
                    <div>
                      <b>Ökologischer Landbau (Bio)</b>
                      <div className="muted small">Öko-Prämie, Bio-Zertifizierung für Paludiprodukte</div>
                    </div>
                  </div>
                </div>
              </div>

              {farmingType === 'oekologisch' && (
                <div>
                  <label className="field-label">Anbauverband</label>
                  <select
                    className="enterprise-select"
                    value={organicAssociation}
                    onChange={(e) => setOrganicAssociation(e.target.value)}
                  >
                    <option value="Bioland">Bioland</option>
                    <option value="Demeter">Demeter</option>
                    <option value="Naturland">Naturland</option>
                    <option value="Biopark">Biopark</option>
                    <option value="EU-Bio">EU-Öko-Verordnung</option>
                  </select>
                </div>
              )}

              <div className="grid-2">
                <div>
                  <label className="field-label">Betrieblicher Schwerpunkt</label>
                  <select
                    className="enterprise-select"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value as typeof focus)}
                  >
                    <option value="milchvieh">Milchviehhaltung (Grünlandbetrieb)</option>
                    <option value="mutterkuh">Mutterkuhhaltung & Fleischrinder</option>
                    <option value="ackerbau">Ackerbau & Futterbau</option>
                    <option value="sonderkulturen">Sonderkulturen / Dauerkulturen</option>
                    <option value="nebenerwerb">Nebenerwerb & Grünlandpflege</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Derzeitige Nutzung der Moorflächen</label>
                  <select
                    className="enterprise-select"
                    value={landUsage}
                    onChange={(e) => setLandUsage(e.target.value as typeof landUsage)}
                  >
                    <option value="gruenland_intensiv">Intensivgrünland (3–5 Schnitte / Silage)</option>
                    <option value="gruenland_extensiv">Extensivgrünland / Mähweide</option>
                    <option value="acker">Ackerbau (Silomais / Getreide auf Moorboden)</option>
                    <option value="brache">Brache / vernässte Restfläche</option>
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div>
                  <label className="field-label">Bestehendes Entwässerungssystem</label>
                  <select
                    className="enterprise-select"
                    value={drainageType}
                    onChange={(e) => setDrainageType(e.target.value as typeof drainageType)}
                  >
                    <option value="graeben">Offenes Grabensystem (Meliorationsgräben)</option>
                    <option value="drainage">Unterflur-Rohrdrainage (Ton/Kunststoff)</option>
                    <option value="keine">Keine aktive künstliche Dränung</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Hauptmotivation für Wiedervernässung</label>
                  <select
                    className="enterprise-select"
                    value={mainMotivation}
                    onChange={(e) => setMainMotivation(e.target.value as typeof mainMotivation)}
                  >
                    <option value="sackung">Moorsackung & Bodenschwund stoppen (langfristiger Werterhalt)</option>
                    <option value="gloe2">GAP-Konditionalität GLÖZ 2 & Wasserrecht rechtssicher erfüllen</option>
                    <option value="ertrag">Neue Erlösquelle durch Paludikultur & CO₂-Zertifikate erschließen</option>
                    <option value="kosten">Hohe Kosten der Grabenunterhaltung & Schöpfwerke senken</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Ziele & Förderung */}
          {step === 3 && (
            <div className="stack gap">
              <div>
                <label className="field-label">Bevorzugte Zielnutzung / Paludikultur</label>
                <div className="grid-2">
                  <div
                    className={`enterprise-select-card ${targetCrop === 'rohrkolben' ? 'selected' : ''}`}
                    onClick={() => setTargetCrop('rohrkolben')}
                  >
                    <Wheat size={22} />
                    <div>
                      <b>Rohrkolben (Typha latifolia)</b>
                      <div className="muted small">
                        Hervorragend für Dämm- & Bauplatten, Einblasdämmung. Ertrag bis zu 15 t TS/ha.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`enterprise-select-card ${targetCrop === 'nassgruenland' ? 'selected' : ''}`}
                    onClick={() => setTargetCrop('nassgruenland')}
                  >
                    <Sprout size={22} />
                    <div>
                      <b>Nassgrünland & Wasserbüffel</b>
                      <div className="muted small">
                        Robuste Weidetiere auf staunassen Flächen. Qualitätsfleisch & Landschaftspflege.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`enterprise-select-card ${targetCrop === 'torfmoos' ? 'selected' : ''}`}
                    onClick={() => setTargetCrop('torfmoos')}
                  >
                    <Leaf size={22} />
                    <div>
                      <b>Torfmoos-Kultivierung (Sphagnum)</b>
                      <div className="muted small">
                        Nachhaltiger Torfersatz für Erdenwerke und Gartenbau. Hoher Rohstoffpreis je m³.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`enterprise-select-card ${targetCrop === 'moor_pv' ? 'selected' : ''}`}
                    onClick={() => setTargetCrop('moor_pv')}
                  >
                    <Sun size={22} />
                    <div>
                      <b>Moor-Photovoltaik (Agri-PV)</b>
                      <div className="muted small">
                        Aufgeständerte PV-Module über vernässtem Moor. Hohe Energieeinspeiseerlöse.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="field-label">Relevante Förderprogramme</label>
                <div className="stack gap-s">
                  <label className="enterprise-checkbox-row">
                    <input
                      type="checkbox"
                      checked={fundingPrograms.includes('ank_bund')}
                      onChange={() => toggleFunding('ank_bund')}
                    />
                    <div>
                      <b>Aktionsprogramm Natürlicher Klimaschutz (ANK Bund)</b>
                      <div className="muted small">
                        Bis zu 90 % Zuschuss für Wasserbau-Investitionen, Stauanlagen und Kultur-Etablierung.
                      </div>
                    </div>
                  </label>

                  <label className="enterprise-checkbox-row">
                    <input
                      type="checkbox"
                      checked={fundingPrograms.includes('bw_moorbauern')}
                      onChange={() => toggleFunding('bw_moorbauern')}
                    />
                    <div>
                      <b>Moorbauernprogramm Baden-Württemberg / Länder-Förderrichtlinie</b>
                      <div className="muted small">
                        Flächenausgleichszahlung für angehobene Wasserstände und Ertragsanpassung.
                      </div>
                    </div>
                  </label>

                  <label className="enterprise-checkbox-row">
                    <input
                      type="checkbox"
                      checked={fundingPrograms.includes('co2_zertifikate')}
                      onChange={() => toggleFunding('co2_zertifikate')}
                    />
                    <div>
                      <b>Freiwilliger CO₂-Zertifikatemarkt (Moorfutures / Paludi-Credits)</b>
                      <div className="muted small">
                        Zusätzliche Vermarktung nachgewiesener THG-Minderungen an Unternehmen (35–65 €/t CO₂e).
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Flurstücke & Setup */}
          {step === 4 && (
            <div className="stack gap">
              <div>
                <label className="field-label">Initialer Kataster-Bestand</label>
                <div className="grid-3">
                  <div
                    className={`enterprise-select-card ${parcelOption === 'alkis_bw' ? 'selected' : ''}`}
                    onClick={() => setParcelOption('alkis_bw')}
                  >
                    <Database size={20} />
                    <div>
                      <b>Federseemoor (Amtlich BW)</b>
                      <div className="muted small">3 amtliche Flurstücke aus Bad Buchau (166 ha)</div>
                    </div>
                  </div>

                  <div
                    className={`enterprise-select-card ${parcelOption === 'teufelsmoor' ? 'selected' : ''}`}
                    onClick={() => setParcelOption('teufelsmoor')}
                  >
                    <Layers size={20} />
                    <div>
                      <b>Teufelsmoor (NI)</b>
                      <div className="muted small">4 Flurstücke Worpswede (18 ha Niedermoor)</div>
                    </div>
                  </div>

                  <div
                    className={`enterprise-select-card ${parcelOption === 'leer' ? 'selected' : ''}`}
                    onClick={() => setParcelOption('leer')}
                  >
                    <MapPin size={20} />
                    <div>
                      <b>Eigenes Portfolio</b>
                      <div className="muted small">Start mit 0 Flächen (freie Auswahl auf der Karte)</div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedParcels.length > 0 ? (
                <div>
                  <div className="row between align-center" style={{ marginBottom: 6 }}>
                    <label className="field-label" style={{ margin: 0 }}>
                      Vorschau der Flurstücke ({selectedParcels.length} Flurstücke · {nf(selectedParcels.reduce((a, p) => a + p.areaHa, 0), 1)} ha)
                    </label>
                    {parcelOption === 'alkis_bw' && (
                      <span className="badge gruen enterprise-badge">
                        <Database size={11} /> 100% AMTLICHE KATASTERDATEN
                      </span>
                    )}
                  </div>
                  <div className="enterprise-table-wrap">
                    <table className="enterprise-table">
                      <thead>
                        <tr>
                          <th>Flurstücksnummer</th>
                          <th>Kataster-Kennzeichen (20-stellig)</th>
                          <th>Gemarkung</th>
                          <th>Amtliche Fläche</th>
                          <th>Moorboden</th>
                          <th>Ist-Wasserstand</th>
                          <th>Quelle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedParcels.map((p) => (
                          <tr key={p.id}>
                            <td><b>{p.label}</b></td>
                            <td className="code-cell">{p.alkis?.flurstueckskennzeichen || p.id}</td>
                            <td>{p.gemarkung}</td>
                            <td className="num"><b>{nf(p.areaHa, 2)} ha</b></td>
                            <td>
                              <Badge tone={p.moorType === 'niedermoor' ? 'braun' : 'rot'}>
                                {p.moorType === 'niedermoor' ? 'Niedermoor' : 'Hochmoor'} ({p.peatDepthCm} cm)
                              </Badge>
                            </td>
                            <td className="num">{p.waterLevelCm} cm u. Flur</td>
                            <td>
                              {p.isAlkis ? (
                                <span className="badge gruen small enterprise-badge">Amtlich erfasst (BW)</span>
                              ) : (
                                <span className="badge grau small enterprise-badge">Simuliert</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="enterprise-callout neutral">
                  <MapPin size={18} className="icon-inline" />
                  <div>
                    <b>Keine initialen Flächen vorgeladen</b>
                    <p>
                      Nach der Einrichtung können Sie unter „Flächen“ beliebige Flurstücke in ganz Deutschland auswählen.
                    </p>
                  </div>
                </div>
              )}

              <div className="enterprise-callout success">
                <ShieldCheck size={18} className="icon-inline" />
                <div>
                  <b>Bereit zur Aktivierung:</b>
                  <p>
                    Betriebsprofil „<b>{farmName}</b>“ ({legalForm}) wird im Bundesland <b>{BUNDESLAENDER[bundesland]?.name}</b> initialisiert.
                    Sämtliche Berechnungen zu THG-Bilanzen, Erträgen und Fördermitteln stehen anschließend sofort zur Verfügung.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="onboarding-footer">
          <div className="onboarding-footer-inner">
            {step > 1 ? (
              <button className="btn" onClick={() => setStep((s) => (s - 1) as typeof step)}>
                <ChevronLeft size={16} /> Zurück
              </button>
            ) : <span />}
            {step < 4 ? (
              <button className="btn primary" onClick={() => setStep((s) => (s + 1) as typeof step)}>
                Weiter: {STEPS[step].label} <ChevronRight size={16} />
              </button>
            ) : (
              <button className="btn primary" onClick={handleFinish}>
                <CheckCircle2 size={16} /> Einrichtung abschließen
              </button>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}
