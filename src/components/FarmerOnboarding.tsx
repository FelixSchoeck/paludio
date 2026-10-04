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
} from './Icons';
import { Badge, nf } from './ui';

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

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal card enterprise-box">
        {/* Enterprise Modal Header */}
        <div className="onboarding-header">
          <div className="row between align-center">
            <div className="row align-center gap-s">
              <span className="badge dunkel enterprise-badge">
                <Database size={13} /> PALUDIO ENTERPRISE
              </span>
              <span className="badge gruen enterprise-badge">
                <ShieldCheck size={13} /> KATASTER-INITIATIVE 2026
              </span>
            </div>
            {state.onboarded && onClose && (
              <button className="btn small ghost" onClick={onClose}>
                Schließen
              </button>
            )}
          </div>
          <h2 style={{ marginTop: 10, marginBottom: 4 }}>
            Betriebs-Setup & Kataster-Onboarding
          </h2>
          <p className="muted small" style={{ margin: 0 }}>
            Erfassen Sie Ihre Betriebsdaten, prüfen Sie amtliche Flurstücke und definieren Sie Ihre Ziele für die Wiedervernässung.
          </p>

          {/* Stepper Bar */}
          <div className="stepper-bar" style={{ marginTop: 16 }}>
            <div
              className={`step-item ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}
              onClick={() => setStep(1)}
            >
              <span className="step-num">{step > 1 ? <CheckCircle2 size={14} /> : '1'}</span>
              <span className="step-label">1. Betrieb & Kataster</span>
            </div>
            <div
              className={`step-item ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}
              onClick={() => setStep(2)}
            >
              <span className="step-num">{step > 2 ? <CheckCircle2 size={14} /> : '2'}</span>
              <span className="step-label">2. Moor-Ausgangslage</span>
            </div>
            <div
              className={`step-item ${step === 3 ? 'active' : step > 3 ? 'done' : ''}`}
              onClick={() => setStep(3)}
            >
              <span className="step-num">{step > 3 ? <CheckCircle2 size={14} /> : '3'}</span>
              <span className="step-label">3. Ziele & Förderung</span>
            </div>
            <div
              className={`step-item ${step === 4 ? 'active' : ''}`}
              onClick={() => setStep(4)}
            >
              <span className="step-num">4</span>
              <span className="step-label">4. Flurstücke & Setup</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="onboarding-content">
          {/* STEP 1: Betrieb & Kataster */}
          {step === 1 && (
            <div className="stack gap">
              <div className="enterprise-callout info">
                <Info size={18} className="icon-inline" />
                <div>
                  <b>Offizielle Katasteranbindung für Baden-Württemberg</b>
                  <p>
                    Paludio greift in Baden-Württemberg direkt auf den amtlichen WFS-Katasterdienst des
                    <b> Landesamts für Geoinformation und Landentwicklung (LGL BW)</b> zu. Für die weiteren 15 Bundesländer wird ein hochauflösendes Katastermodell simuliert.
                  </p>
                </div>
              </div>

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
                    <b>Amtliches Liegenschaftskataster Baden-Württemberg aktiv:</b>
                    <p>
                      Flurstücke werden im amtlichen Referenzsystem ETRS89 / EPSG:4258 mit bundesweit einheitlichem 20-stelligem Flurstückskennzeichen, amtlicher Fläche (m²) und Gemarkungsschlüssel geladen.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="enterprise-callout neutral">
                  <Layers size={18} className="icon-inline" />
                  <div>
                    <b>Deterministische Kataster-Simulation aktiv:</b>
                    <p>
                      Für {BUNDESLAENDER[bundesland]?.name} werden Flurstücke auf Basis von Schlagstrukturen und der Bodenkarte der organischen Böden (Thünen-Institut) abgebildet.
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
                      Nach Abschluss des Onboardings gelangen Sie direkt in das Dashboard und können über das Modul „Karte & Flächen“ beliebige Flurstücke in ganz Deutschland auswählen.
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

        {/* Modal Footer Controls */}
        <div className="onboarding-footer">
          <div className="row between align-center wrap gap">
            <div className="row gap-s">
              <button
                className="btn ghost small"
                onClick={() => {
                  loadBwDemo();
                  if (onClose) onClose();
                }}
                title="Lädt den baden-württembergischen Musterbetrieb mit amtlichen Flurstücken"
              >
                <Sparkles size={14} /> Musterbetrieb Baden-Württemberg laden
              </button>
              <button
                className="btn ghost small"
                onClick={() => {
                  loadDemo();
                  if (onClose) onClose();
                }}
                title="Lädt den niedersächsischen Musterbetrieb Teufelsmoor"
              >
                Musterbetrieb Teufelsmoor (NI)
              </button>
            </div>

            <div className="row gap">
              {step > 1 && (
                <button
                  className="btn"
                  onClick={() => setStep((s) => (s - 1) as typeof step)}
                >
                  <ChevronLeft size={16} /> Zurück
                </button>
              )}
              {step < 4 ? (
                <button
                  className="btn primary"
                  onClick={() => setStep((s) => (s + 1) as typeof step)}
                >
                  Weiter zu Schritt {step + 1} <ChevronRight size={16} />
                </button>
              ) : (
                <button className="btn primary" onClick={handleFinish}>
                  <CheckCircle2 size={16} /> Betriebs-Setup abschließen & Cockpit öffnen
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
