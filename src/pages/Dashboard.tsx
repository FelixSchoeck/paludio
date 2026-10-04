import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationStage, useNow, useStore } from '../lib/store';
import { analyze } from '../lib/calc';
import { phaseAt } from '../lib/monitoring';
import { Badge, Empty, eur, nf } from '../components/ui';
import {
  Database,
  ShieldCheck,
  Layers,
  MapPin,
  DraftingCompass,
  Euro,
  Activity,
  Tractor,
  ShoppingBag,
  Sparkles,
  Info,
  Sprout,
  Wheat,
  CheckCircle2,
  ArrowRight,
  Search,
  Building2,
  Check,
} from '../components/Icons';

export default function Dashboard() {
  const { state, loadBwDemo, loadDemo, resetOnboarding } = useStore();
  const nav = useNavigate();
  const now = useNow(5000);

  const [parcelFilter, setParcelFilter] = useState<'alle' | 'alkis' | 'moor'>('alle');
  const [searchQuery, setSearchQuery] = useState('');

  const activeProject = state.projects[0];
  const activePlan = useMemo(() => {
    if (activeProject) return state.plans.find((p) => p.id === activeProject.planId);
    return state.plans[0];
  }, [activeProject, state.plans]);

  const activeParcels = useMemo(() => {
    if (activePlan) return state.myParcels.filter((p) => activePlan.draft.parcelIds.includes(p.id));
    return state.myParcels;
  }, [activePlan, state.myParcels]);

  const calcRes = useMemo(() => {
    if (!activeParcels.length) return null;
    return analyze(activeParcels, activePlan ? activePlan.draft : state.draft);
  }, [activeParcels, activePlan, state.draft]);

  const projectPhase = activeProject ? phaseAt(activeProject.simMonth) : null;

  // Filtered parcels for Enterprise Data Table
  const filteredParcels = useMemo(() => {
    return state.myParcels.filter((p) => {
      if (parcelFilter === 'alkis' && !p.isAlkis) return false;
      if (parcelFilter === 'moor' && p.moorType === 'mineral') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLabel = p.label.toLowerCase().includes(q);
        const matchGmk = p.gemarkung.toLowerCase().includes(q);
        const matchRef = p.alkis?.flurstueckskennzeichen.toLowerCase().includes(q) || false;
        if (!matchLabel && !matchGmk && !matchRef) return false;
      }
      return true;
    });
  }, [state.myParcels, parcelFilter, searchQuery]);

  const alkisCount = state.myParcels.filter((p) => p.isAlkis).length;
  const moorCount = state.myParcels.filter((p) => p.moorType !== 'mineral').length;
  const totalAreaHa = state.myParcels.reduce((a, p) => a + p.areaHa, 0);
  const avgWaterLevel = state.myParcels.length
    ? Math.round(state.myParcels.reduce((a, p) => a + p.waterLevelCm, 0) / state.myParcels.length)
    : 0;

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      {/* 1. Enterprise System Status Ribbon */}
      <div className="enterprise-system-bar">
        <div className="enterprise-system-item">
          <span className="status-dot pulsing" />
          <span>KATASTER-SCHNITTSTELLE: <b>LANDESVERMESSUNG BADEN-WÜRTTEMBERG (ONLINE)</b></span>
        </div>
        <div className="enterprise-system-item">
          <span>REFERENZ: <b>EPSG:4258 (ETRS89) / INSPIRE</b></span>
        </div>
        <div className="enterprise-system-item">
          <span>INVEKOS/BALIS: <b>SYNCHRONISIERT</b></span>
        </div>
        <div className="enterprise-system-item">
          <span>KATASTERAKTUALITÄT: <b>Q1/2026</b></span>
        </div>
      </div>

      {/* 2. Operations Header */}
      <div className="enterprise-cockpit-header">
        <div className="row between align-center wrap gap">
          <div>
            <div className="row align-center gap-s" style={{ marginBottom: 6 }}>
              <span className="badge dunkel enterprise-badge">
                <Building2 size={12} /> {state.farm.legalForm || 'Einzelunternehmen'}
              </span>
              {state.farm.betriebsnummer && (
                <span className="badge grau enterprise-badge code-cell">
                  VVVO: {state.farm.betriebsnummer}
                </span>
              )}
              {state.farm.farmingType && (
                <span className="badge gruen enterprise-badge">
                  {state.farm.farmingType === 'oekologisch'
                    ? `Öko-Betrieb (${state.farm.organicAssociation || 'Bio'})`
                    : 'Konventionell'}
                </span>
              )}
              {alkisCount > 0 && (
                <span className="badge gruen enterprise-badge">
                  <Database size={12} /> {alkisCount} AMTLICHE FLURSTÜCKE
                </span>
              )}
            </div>
            <h1>{state.farm.name || 'Betriebsübersicht & Moor-Kataster'}</h1>
            <p className="muted small" style={{ margin: '4px 0 0 0' }}>
              Betriebsleitung: <b>{state.farm.owner || 'Nicht erfasst'}</b> · Standort: <b>{state.farm.locationName || 'Deutschland'}</b> · Gesamtfläche im System: <b>{nf(totalAreaHa, 2)} ha</b>
            </p>
          </div>

          <div className="row gap wrap">
            <Link className="btn small primary" to="/karte">
              <MapPin size={14} /> Flurstücke kartieren
            </Link>
            <Link className="btn small" to="/planer">
              <DraftingCompass size={14} /> Szenario berechnen
            </Link>
            <button className="btn small ghost" onClick={resetOnboarding} title="Onboarding-Assistenten erneut aufrufen">
              Betriebs-Setup anpassen
            </button>
            {state.myParcels.length === 0 && (
              <button className="btn small" onClick={loadBwDemo} style={{ background: '#eef5ed', borderColor: '#b8dcaf', color: '#2c5e26' }}>
                <Sparkles size={14} /> Musterbetrieb Baden-Württemberg laden
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Dense rectangular Enterprise KPI Matrix */}
      {calcRes && calcRes.hasMoor ? (
        <div className="enterprise-kpi-grid">
          <div className="enterprise-kpi-tile">
            <span className="enterprise-kpi-label">Erfasste Moorfläche</span>
            <div className="enterprise-kpi-val">{nf(calcRes.moorHa, 1)} ha</div>
            <span className="enterprise-kpi-sub">
              {activeParcels.length} Flurstück(e) · {alkisCount > 0 ? `${alkisCount} Amtlich erfasst (BW)` : 'Kataster-Modell'}
            </span>
          </div>

          <div className="enterprise-kpi-tile">
            <span className="enterprise-kpi-label">THG-Minderungspotenzial</span>
            <div className="enterprise-kpi-val" style={{ color: 'var(--moss-green)' }}>
              −{nf(calcRes.emissions.avoidedT, 0)} t/a
            </div>
            <span className="enterprise-kpi-sub">
              von {nf(calcRes.emissions.baselinePerHa, 1)} auf {nf(calcRes.emissions.scenarioPerHa, 1)} t CO₂e/ha/a
            </span>
          </div>

          <div className="enterprise-kpi-tile">
            <span className="enterprise-kpi-label">Vollertrag Rohstoff / Umsatz</span>
            <div className="enterprise-kpi-val">{eur(calcRes.kpis.fullRevenue)}</div>
            <span className="enterprise-kpi-sub">
              Kultur: {calcRes.crop.name} ({nf(calcRes.moorHa * calcRes.crop.yieldPerHa * calcRes.yieldFactor, 0)} {calcRes.crop.yieldUnit})
            </span>
          </div>

          <div className="enterprise-kpi-tile">
            <span className="enterprise-kpi-label">Fördermittel-Potenzial</span>
            <div className="enterprise-kpi-val" style={{ color: 'var(--moss-green)' }}>
              {eur(calcRes.funding.oneTime)}
            </div>
            <span className="enterprise-kpi-sub">
              + {eur(calcRes.funding.annual)}/a laufende Flächenprämie
            </span>
          </div>

          <div className="enterprise-kpi-tile">
            <span className="enterprise-kpi-label">Wasserflurabstand (Ist → Ziel)</span>
            <div className="enterprise-kpi-val">
              {avgWaterLevel} cm → 5 cm
            </div>
            <span className="enterprise-kpi-sub">
              Ziel: Ganzjährige oberflächennahe Einstauung
            </span>
          </div>

          <div className="enterprise-kpi-tile">
            <span className="enterprise-kpi-label">Regulatorischer Status</span>
            <div className="enterprise-kpi-val" style={{ fontSize: '1.25rem', color: '#164e6b' }}>
              GLÖZ 2 Konform
            </div>
            <span className="enterprise-kpi-sub">
              Wasserrecht: § 68 WHG Plangenehmigung erforderlich
            </span>
          </div>
        </div>
      ) : (
        <div className="enterprise-callout info" style={{ marginBottom: 20 }}>
          <Info size={20} />
          <div>
            <b>Keine aktiven Moor-Flurstücke geladen:</b>
            <p>
              Wählen Sie auf der Karte Ihre Flurstücke aus oder laden Sie einen Musterbetrieb, um automatische Berechnungen zu THG-Einsparung, Kultur-Eignung und Fördersätzen zu erhalten.
            </p>
          </div>
        </div>
      )}

      {/* 4. Amtliches Flurstücksverzeichnis (ALKIS & Liegenschaftskataster Data Table) */}
      <section className="card" style={{ marginBottom: 20, padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="row between align-center wrap gap">
            <div>
              <h3 style={{ margin: 0 }}>Amtliches Liegenschafts- & Flurstücksverzeichnis</h3>
              <p className="muted small" style={{ margin: '4px 0 0 0' }}>
                Verzeichnis aller dem Betrieb zugeordneten Flurstücke inklusive amtlicher Flurstückskennungen, Katasteramt und Bodenkenndaten.
              </p>
            </div>
            <div className="row gap-s align-center">
              <span className="muted small">Filter:</span>
              <div className="seg">
                <button
                  className={parcelFilter === 'alle' ? 'on' : ''}
                  onClick={() => setParcelFilter('alle')}
                >
                  Alle ({state.myParcels.length})
                </button>
                <button
                  className={parcelFilter === 'alkis' ? 'on' : ''}
                  onClick={() => setParcelFilter('alkis')}
                >
                  Amtlich erfasst ({alkisCount})
                </button>
                <button
                  className={parcelFilter === 'moor' ? 'on' : ''}
                  onClick={() => setParcelFilter('moor')}
                >
                  Moorböden ({moorCount})
                </button>
              </div>
            </div>
          </div>

          {/* Search Filter Bar */}
          <div className="filter-bar" style={{ marginTop: 12 }}>
            <Search size={16} className="muted" />
            <input
              className="filter-input"
              placeholder="Flurstück, Kennzeichen (20-stellig) oder Gemarkung filtern …"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="btn small ghost" onClick={() => setSearchQuery('')}>Zurücksetzen</button>
            )}
          </div>
        </div>

        {filteredParcels.length > 0 ? (
          <div className="enterprise-table-wrap" style={{ border: 'none', margin: 0 }}>
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Flurstücks-Nr.</th>
                  <th>Kataster-Kennzeichen (20-stellig)</th>
                  <th>Gemarkung & Katasteramt</th>
                  <th>Kataster-Quelle</th>
                  <th className="num">Amtliche Fläche</th>
                  <th>Moorboden & Torf</th>
                  <th className="num">Ist-Wasserstand</th>
                  <th>Rechtstitel</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredParcels.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.label}</b></td>
                    <td className="code-cell">
                      {p.alkis?.flurstueckskennzeichen || p.id}
                    </td>
                    <td>
                      <div><b>{p.gemarkung}</b></div>
                      <div className="muted small">{p.alkis?.katasteramt || 'Vermessungsverwaltung'}</div>
                    </td>
                    <td>
                      {p.isAlkis ? (
                        <span className="badge gruen enterprise-badge">
                          <Database size={10} /> Amtlich erfasst (BW)
                        </span>
                      ) : (
                        <span className="badge grau enterprise-badge">
                          Simuliert (Modell)
                        </span>
                      )}
                    </td>
                    <td className="num">
                      <b>{nf(p.areaHa, 2)} ha</b>
                      {p.alkis?.amtlicheFlaecheQm && (
                        <div className="muted small">{nf(p.alkis.amtlicheFlaecheQm, 0)} m²</div>
                      )}
                    </td>
                    <td>
                      <Badge tone={p.moorType === 'niedermoor' ? 'braun' : p.moorType === 'hochmoor' ? 'rot' : 'grau'}>
                        {p.moorType === 'niedermoor' ? 'Niedermoor' : p.moorType === 'hochmoor' ? 'Hochmoor' : 'Mineral'}
                        {p.moorType !== 'mineral' && ` (${p.peatDepthCm} cm)`}
                      </Badge>
                    </td>
                    <td className="num">
                      <b>{p.waterLevelCm} cm</b> u. Flur
                    </td>
                    <td>
                      <span className="badge grau enterprise-badge">
                        {p.tenure === 'pacht' ? 'Pachtfläche' : 'Eigentum'}
                      </span>
                    </td>
                    <td>
                      <div className="row gap-s">
                        <Link className="btn small ghost" to="/karte" title="Auf Karte zentrieren">
                          Karte
                        </Link>
                        <Link className="btn small ghost" to="/planer" title="In Planer übernehmen">
                          Planen
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 24 }}>
            <Empty icon={<Layers size={32} />} title="Keine Flurstücke gefunden">
              Für die gewählten Filterkriterien liegen keine Flurstücke vor.
            </Empty>
          </div>
        )}
      </section>

      {/* 5. Rechts- und Projekt-Pipeline */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <section className="card">
          <div className="row between align-center" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Wasserrechtliche & Förder-Compliance</h3>
            <span className="badge gruen enterprise-badge">Status: In Bearbeitung</span>
          </div>

          <div className="stack gap-s">
            <div className="row between align-center" style={{ padding: '8px 10px', background: '#f8f6f0', border: '1px solid var(--border)' }}>
              <div>
                <b>1. Wasserrechtliche Plangenehmigung (§ 68 WHG)</b>
                <div className="muted small">Untere Wasserbehörde · Anstau der Hauptgräben</div>
              </div>
              <Badge tone="gelb">Vorbereitung</Badge>
            </div>

            <div className="row between align-center" style={{ padding: '8px 10px', background: '#f8f6f0', border: '1px solid var(--border)' }}>
              <div>
                <b>2. ANK-Förderbescheid (BfN / Bund)</b>
                <div className="muted small">Investitionszuschuss Wasserbau & Pflanzgut</div>
              </div>
              <Badge tone="blau">Eingereicht</Badge>
            </div>

            <div className="row between align-center" style={{ padding: '8px 10px', background: '#f8f6f0', border: '1px solid var(--border)' }}>
              <div>
                <b>3. FFH- & Naturschutzverträglichkeit</b>
                <div className="muted small">Erhalt der Schutzgüter im Feuchtgebietsbiotop</div>
              </div>
              <Badge tone="gruen">Geprüft</Badge>
            </div>

            <div className="row between align-center" style={{ padding: '8px 10px', background: '#f8f6f0', border: '1px solid var(--border)' }}>
              <div>
                <b>4. GAP GLÖZ 2 Konditionalität</b>
                <div className="muted small">Erhalt von Moorböden und Mindestwasserständen</div>
              </div>
              <Badge tone="gruen">Konform</Badge>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="row between align-center" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Laufendes Vorhaben</h3>
            {projectPhase && <Badge tone="blau">{projectPhase.label}</Badge>}
          </div>

          {activeProject && activePlan ? (
            <div className="stack gap">
              <div>
                <b style={{ fontSize: '1.05rem' }}>{activeProject.name}</b>
                <div className="muted small">Startdatum: {activeProject.startDate} · Simulierter Projektmonat: {activeProject.simMonth}</div>
              </div>

              <div className="enterprise-callout success" style={{ margin: 0 }}>
                <CheckCircle2 size={18} />
                <div>
                  <b>Projektfortschritt regulär:</b>
                  <p>Kultur: <b>{calcRes?.crop.name}</b> auf {nf(calcRes?.moorHa ?? 0, 1)} ha Moorfläche. Pegelsensoren aktiv.</p>
                </div>
              </div>

              <div className="row gap">
                <Link className="btn small primary" to="/betrieb">
                  <Activity size={14} /> Monitoring-Cockpit öffnen
                </Link>
                <Link className="btn small" to="/planer">
                  Szenario bearbeiten
                </Link>
              </div>
            </div>
          ) : (
            <Empty icon={<Sprout size={32} />} title="Kein aktives Projekt gestartet">
              Erstellen Sie im Planer ein Szenario und starten Sie ein Projekt, um den Wasserstand zu überwachen und Handlungsempfehlungen zu erhalten.
            </Empty>
          )}
        </section>
      </div>

      {/* 6. Zentrale Fachmodule der Plattform */}
      <h3 style={{ marginTop: 24, marginBottom: 12 }}>Fachmodule der Paludio-Plattform</h3>
      <div className="module-grid">
        <div className="card module-card" onClick={() => nav('/karte')}>
          <div className="module-icon" style={{ borderRadius: 0 }}><MapPin size={22} /></div>
          <h4>1. Kartierung & Liegenschaftskataster</h4>
          <p className="muted small">
            Vollständige Abdeckung Deutschlands mit amtlichen Flurstücksdaten in Baden-Württemberg und präzisen Moorboden-Layern.
          </p>
          <span className="module-link">Karte öffnen <ArrowRight size={13} className="icon-inline" /></span>
        </div>

        <div className="card module-card" onClick={() => nav('/planer')}>
          <div className="module-icon" style={{ borderRadius: 0 }}><DraftingCompass size={22} /></div>
          <h4>2. Planer, Wasserbau & Cashflow</h4>
          <p className="muted small">
            Kulturen kalkulieren (Rohrkolben, Schilf, Nassgrünland, Torfmoos, Moor-PV), Wasserbaukosten berechnen und CO₂-Zertifikate simulieren.
          </p>
          <span className="module-link">Planer öffnen <ArrowRight size={13} className="icon-inline" /></span>
        </div>

        <div className="card module-card" onClick={() => nav('/foerderung')}>
          <div className="module-icon" style={{ borderRadius: 0 }}><Euro size={22} /></div>
          <h4>3. Förderfinder & Antragsassistent</h4>
          <p className="muted small">
            Automatischer Check für Bundes- (ANK) und Landesprogramme (z. B. Moorbauern BW, GAK). Anträge direkt digital vorbereiten.
          </p>
          <span className="module-link">Förderungen prüfen <ArrowRight size={13} className="icon-inline" /></span>
        </div>

        <div className="card module-card" onClick={() => nav('/betrieb')}>
          <div className="module-icon" style={{ borderRadius: 0 }}><Activity size={22} /></div>
          <h4>4. Monitoring & Betriebsunterstützung</h4>
          <p className="muted small">
            Pegelsensoren der Wiedervernässung visualisieren, Aufgaben entlang der Projektphasen abhaken und automatisierte Empfehlungen erhalten.
          </p>
          <span className="module-link">Betriebsdaten ansehen <ArrowRight size={13} className="icon-inline" /></span>
        </div>

        <div className="card module-card" onClick={() => nav('/maschinen')}>
          <div className="module-icon" style={{ borderRadius: 0 }}><Tractor size={22} /></div>
          <h4>5. Digitaler Maschinenmarkt</h4>
          <p className="muted small">
            Spezialtechnik mit geringem Bodendruck (Mähraupen, Breitreifentraktoren, Bagger) im Umkreis mieten oder eigene Maschinen anbieten.
          </p>
          <span className="module-link">Maschinenmarkt ansehen <ArrowRight size={13} className="icon-inline" /></span>
        </div>

        <div className="card module-card" onClick={() => nav('/produkte')}>
          <div className="module-icon" style={{ borderRadius: 0 }}><ShoppingBag size={22} /></div>
          <h4>6. Paludi-Produktmarkt</h4>
          <p className="muted small">
            Erntegüter und Halbfabrikate (Rohrkolben-Häcksel, Dachreet, Torfersatz, Moor-Zertifikate) vermarkten oder Abnehmerverträge finden.
          </p>
          <span className="module-link">Produktmarkt öffnen <ArrowRight size={13} className="icon-inline" /></span>
        </div>
      </div>

      {/* 7. Laufende Anträge & Buchungen */}
      {(state.applications.length > 0 || state.bookings.length > 0) && (
        <div className="grid-2" style={{ marginTop: 24 }}>
          {state.applications.length > 0 && (
            <section className="card">
              <h4>Laufende Förderanträge</h4>
              <div className="stack gap-s" style={{ marginTop: 10 }}>
                {state.applications.map((a) => {
                  const stage = applicationStage(a, now);
                  return (
                    <div key={a.id} className="row between align-center" style={{ padding: '8px 10px', background: '#f8f6f0', border: '1px solid var(--border)' }}>
                      <div>
                        <b>{a.programName}</b>
                        <div className="muted small">{eur(a.amountRequested)} beantragt</div>
                      </div>
                      <Badge tone={stage.tone}>{stage.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {state.bookings.length > 0 && (
            <section className="card">
              <h4>Maschinenbuchungen</h4>
              <div className="stack gap-s" style={{ marginTop: 10 }}>
                {state.bookings.map((b) => (
                  <div key={b.id} className="row between align-center" style={{ padding: '8px 10px', background: '#f8f6f0', border: '1px solid var(--border)' }}>
                    <div>
                      <b><Tractor size={14} className="icon-inline" /> {b.machineName}</b>
                      <div className="muted small">{b.from} bis {b.to}</div>
                    </div>
                    <b>{eur(b.total)}</b>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
