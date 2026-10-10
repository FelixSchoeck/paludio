import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { applicationStage, useNow, useStore } from '../lib/store';
import { analyze } from '../lib/calc';
import { PHASES, TASKS, phaseAt } from '../lib/monitoring';
import { Badge, Empty, eur, nf } from '../components/ui';
import {
  Layers,
  Leaf,
  ChartLine,
  Euro,
  Droplet,
  Tractor,
  Sparkles,
  Info,
  Check,
  ArrowRight,
  Search,
  Plus,
  FileText,
  CheckCircle2,
} from '../components/Icons';

export default function Dashboard() {
  const { state, loadBwDemo } = useStore();
  const now = useNow(5000);
  const [params] = useSearchParams();

  const [parcelFilter, setParcelFilter] = useState<'alle' | 'alkis' | 'moor'>('alle');
  const [searchQuery, setSearchQuery] = useState(params.get('q') ?? '');

  // Suche aus der Kopfzeile übernehmen
  useEffect(() => setSearchQuery(params.get('q') ?? ''), [params]);

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
  const sources = [...new Set(state.myParcels.map((p) => p.alkis?.katasteramt).filter(Boolean))];

  // Projektphase & offene Aufgaben
  const month = activeProject?.simMonth ?? 0;
  const phase = activeProject ? phaseAt(month) : null;
  // Offene Aufgaben der aktuellen Phase – sind alle erledigt, die der nächsten Phase
  const openTasks = useMemo(() => {
    if (!activeProject || !phase) return [];
    const from = PHASES.findIndex((p) => p.id === phase.id);
    for (const ph of PHASES.slice(from)) {
      const open = TASKS.filter((t) => t.phase === ph.id && !activeProject.tasks[t.id]);
      if (open.length) return open.map((t) => ({ ...t, phaseLabel: ph.label }));
    }
    return [];
  }, [activeProject, phase]);
  const draftApps = state.applications.filter((a) => a.status === 'entwurf');

  const farm = state.farm;
  const meta = [
    farm.legalForm && farm.owner ? `${farm.legalForm} · ${farm.owner}` : farm.owner || farm.legalForm,
    farm.locationName,
    farm.farmingType ? (farm.farmingType === 'oekologisch' ? `Öko (${farm.organicAssociation || 'Bio'})` : 'Konventionell') : null,
  ].filter(Boolean) as string[];

  const npv = calcRes?.kpis.npv ?? 0;

  return (
    <div className="page">
      {/* Kopf */}
      <section className="cockpit-head">
        <div className="stack" style={{ gap: 8, flex: '1 1 420px' }}>
          <h1 style={{ margin: 0 }}>{farm.name || 'Ihr Betrieb'}</h1>
          <div className="cockpit-meta">
            {meta.map((m) => <span key={m}>{m}</span>)}
            {farm.betriebsnummer && <span className="mono" style={{ fontSize: 12 }}>VVVO {farm.betriebsnummer}</span>}
            {totalAreaHa > 0 && <span>{nf(totalAreaHa, 2)} ha im System</span>}
          </div>
        </div>
        <div className="row gap wrap">
          <Link className="btn" to="/planer">Szenario berechnen</Link>
          <Link className="btn primary" to="/karte"><Plus size={16} /> Fläche hinzufügen</Link>
        </div>
      </section>

      {state.myParcels.length === 0 && (
        <section className="card row between wrap gap" style={{ marginBottom: 24 }}>
          <div className="row gap" style={{ alignItems: 'flex-start' }}>
            <span className="icon-tile water"><Info size={16} /></span>
            <div>
              <b>Noch keine Flurstücke</b>
              <div className="muted small">Wählen Sie auf der Karte Ihre Flächen aus oder laden Sie den Musterbetrieb, um THG-Einsparung, Kultur-Eignung und Förderung zu berechnen.</div>
            </div>
          </div>
          <div className="row gap-s wrap">
            <button className="btn" onClick={loadBwDemo}><Sparkles size={16} /> Musterbetrieb laden</button>
            <Link className="btn primary" to="/karte">Zur Karte</Link>
          </div>
        </section>
      )}

      {/* Laufendes Vorhaben */}
      {activeProject && phase ? (
        <section className="card project-card" aria-labelledby="proj-h">
          <div className="row between wrap gap" style={{ alignItems: 'flex-start' }}>
            <div className="stack" style={{ gap: 4 }}>
              <span className="muted small">Laufendes Vorhaben · Start {new Date(activeProject.startDate).toLocaleDateString('de-DE')}</span>
              <h2 id="proj-h" style={{ margin: 0, fontSize: 20 }}>{activeProject.name}</h2>
              {calcRes && (
                <span>{calcRes.crop.name} auf {nf(calcRes.moorHa, 1)} ha {calcRes.moorHa > 0 ? 'Moorfläche' : 'Fläche'}</span>
              )}
            </div>
            <Link className="next-step" to="/betrieb">
              <span className="icon-tile water"><Droplet size={18} /></span>
              <span className="next-step-text">
                <span className="muted" style={{ fontSize: 12 }}>Nächster Schritt</span>
                <b style={{ fontWeight: 600 }}>{openTasks[0]?.label ?? 'Alle Aufgaben erledigt'}</b>
              </span>
              <ArrowRight size={18} className="text-gruen" />
            </Link>
          </div>

          <ol className="phase-track">
            {PHASES.map((p, i) => {
              const next = PHASES[i + 1]?.startMonth;
              const isDone = next !== undefined && month >= next;
              const isCur = p.id === phase.id;
              const pct = isCur && next !== undefined ? Math.max(8, Math.round(((month - p.startMonth) / (next - p.startMonth)) * 100)) : isCur ? 100 : 0;
              const range = next !== undefined ? `Monat ${p.startMonth}–${next - 1}` : `ab Monat ${p.startMonth}`;
              return (
                <li key={p.id} className={isDone ? 'done' : isCur ? 'cur' : ''} aria-current={isCur ? 'step' : undefined}>
                  <span className="phase-bar">{isCur && <span style={{ width: `${pct}%` }} />}</span>
                  <span className="phase-name">
                    {isDone && <Check size={14} strokeWidth={2.5} className="text-gruen" />}
                    {p.label}
                  </span>
                  <span className="phase-sub">{isCur ? `Monat ${month} · läuft` : range}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : state.myParcels.length > 0 ? (
        <section className="card row between wrap gap" style={{ marginBottom: 24 }}>
          <div>
            <b>Noch kein Projekt gestartet</b>
            <div className="muted small">Berechnen Sie im Planer ein Szenario und starten Sie das Projekt. Paludio begleitet Sie dann von der Genehmigung bis zum Regelbetrieb.</div>
          </div>
          <Link className="btn primary" to="/planer">Zum Planer</Link>
        </section>
      ) : null}

      {/* Kennzahlen */}
      {calcRes && calcRes.hasMoor && (
        <section className="kpi-grid" aria-label="Kennzahlen">
          <div className="kpi">
            <span className="kpi-label"><Layers size={16} /> Moorfläche</span>
            <span className="kpi-value">{nf(calcRes.moorHa, 1)} <span className="kpi-unit">ha</span></span>
            <span className="kpi-hint">{activeParcels.length} {activeParcels.length === 1 ? 'Flurstück' : 'Flurstücke'}{alkisCount > 0 ? ' · amtlich erfasst' : ''}</span>
          </div>
          <div className="kpi good">
            <span className="kpi-label"><Leaf size={16} /> THG-Minderung</span>
            <span className="kpi-value">−{nf(calcRes.emissions.avoidedT, 0)} <span className="kpi-unit">t CO₂e/a</span></span>
            <span className="kpi-hint">{nf(calcRes.emissions.baselinePerHa, 1)} → {nf(calcRes.emissions.scenarioPerHa, 1)} t je ha und Jahr</span>
          </div>
          <div className="kpi">
            <span className="kpi-label"><ChartLine size={16} /> Kapitalwert</span>
            <span className="kpi-value">
              {Math.abs(npv) >= 1e6 ? <>{nf(npv / 1e6, 2)} <span className="kpi-unit">Mio. €</span></> : eur(npv)}
            </span>
            <span className="kpi-hint">
              {calcRes.kpis.payback != null ? `Amortisation nach ${nf(calcRes.kpis.payback, 1)} Jahren` : 'Keine Amortisation im Zeitraum'}
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-label"><Euro size={16} /> Förderpotenzial</span>
            <span className="kpi-value">{nf(calcRes.funding.oneTime, 0)} <span className="kpi-unit">€</span></span>
            <span className="kpi-hint">+ {eur(calcRes.funding.annual)} jährliche Flächenprämie</span>
          </div>
        </section>
      )}

      <div className="row wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
        {/* Flurstücke */}
        <section className="card" aria-labelledby="fl-h" style={{ flex: '999 1 520px', minWidth: 0, padding: 0, overflow: 'hidden' }}>
          <div className="card-head">
            <div>
              <h2 id="fl-h" className="section-title">Flurstücke</h2>
              <span className="muted small">Liegenschaftsdaten mit Boden- und Pegelwerten</span>
            </div>
            <div className="seg" role="group" aria-label="Filter">
              <button className={parcelFilter === 'alle' ? 'on' : ''} aria-pressed={parcelFilter === 'alle'} onClick={() => setParcelFilter('alle')}>
                Alle {state.myParcels.length}
              </button>
              <button className={parcelFilter === 'alkis' ? 'on' : ''} aria-pressed={parcelFilter === 'alkis'} onClick={() => setParcelFilter('alkis')}>
                Amtlich {alkisCount}
              </button>
              <button className={parcelFilter === 'moor' ? 'on' : ''} aria-pressed={parcelFilter === 'moor'} onClick={() => setParcelFilter('moor')}>
                Moorböden {moorCount}
              </button>
            </div>
          </div>

          {state.myParcels.length > 3 || searchQuery ? (
            <div style={{ padding: '0 20px 12px' }}>
              <label className="filter-bar" style={{ margin: 0 }}>
                <Search size={16} className="muted" />
                <span className="vh">Flurstücke filtern</span>
                <input
                  className="filter-input"
                  placeholder="Flurstück, Kennzeichen oder Gemarkung"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && <button className="btn small ghost" onClick={() => setSearchQuery('')}>Zurücksetzen</button>}
              </label>
            </div>
          ) : null}

          {filteredParcels.length > 0 ? (
            <div className="table-wrap">
              <table className="enterprise-table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>Flurstück</th>
                    <th className="num">Fläche</th>
                    <th>Boden</th>
                    <th>Wasserstand{calcRes ? ` → Ziel ${calcRes.targetWl} cm` : ''}</th>
                    <th>Nutzung</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParcels.map((p) => {
                    const dry = p.waterLevelCm >= 60;
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link to="/karte" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.label}</Link>
                          <div className="code-cell">{p.alkis?.flurstueckskennzeichen || p.gemarkung}</div>
                        </td>
                        <td className="num" style={{ fontWeight: 500 }}>{nf(p.areaHa, 2)} ha</td>
                        <td>
                          <Badge tone={p.moorType === 'mineral' ? 'grau' : 'braun'}>
                            {p.moorType === 'niedermoor' ? 'Niedermoor' : p.moorType === 'hochmoor' ? 'Hochmoor' : 'Mineralboden'}
                            {p.moorType !== 'mineral' && ` · ${p.peatDepthCm} cm`}
                          </Badge>
                        </td>
                        <td>
                          <div className="wl-cell">
                            <span className={dry ? 'wl-track dry' : 'wl-track'}>
                              <span style={{ width: `${Math.min(100, Math.round((p.waterLevelCm / 80) * 100))}%` }} />
                            </span>
                            <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: dry ? 'var(--bog-red)' : undefined, fontWeight: dry ? 500 : undefined }}>
                              {p.waterLevelCm} cm u. Flur
                            </span>
                          </div>
                        </td>
                        <td>{p.tenure === 'pacht' ? 'Pacht' : 'Eigentum'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '0 20px 20px' }}>
              <Empty icon={<Layers size={32} />} title={state.myParcels.length ? 'Keine Flurstücke gefunden' : 'Noch keine Flurstücke'}>
                {state.myParcels.length ? 'Für die gewählten Filter liegen keine Flurstücke vor.' : 'Wählen Sie Ihre Flächen auf der Karte aus.'}
              </Empty>
            </div>
          )}

          {state.myParcels.length > 0 && (
            <div className="card-foot">
              <span>Gesamt {nf(totalAreaHa, 2)} ha{sources.length ? ` · Quelle: ${sources.join(', ')}` : ''}</span>
              <Link to="/karte" style={{ fontWeight: 500 }}>Auf der Karte zeigen</Link>
            </div>
          )}
        </section>

        {/* Rechte Spalte */}
        <div className="stack" style={{ flex: '1 1 280px', minWidth: 0, gap: 24 }}>
          <section className="card stack" aria-labelledby="todo-h" style={{ gap: 14 }}>
            <h2 id="todo-h" className="section-title">Zu erledigen</h2>
            {openTasks.length === 0 && draftApps.length === 0 && (
              <div className="todo">
                <span className="icon-tile"><CheckCircle2 size={16} /></span>
                <div className="todo-text">
                  <b style={{ fontWeight: 600 }}>Alles erledigt</b>
                  <span className="muted small">{activeProject ? 'Keine offenen Aufgaben im Projekt.' : 'Starten Sie ein Projekt, um Aufgaben zu erhalten.'}</span>
                </div>
              </div>
            )}
            {draftApps.map((a) => (
              <Link key={a.id} to="/foerderung" className="todo" style={{ color: 'inherit', textDecoration: 'none' }}>
                <span className="icon-tile warn"><FileText size={16} /></span>
                <span className="todo-text">
                  <b style={{ fontWeight: 600 }}>Förderantrag fertigstellen</b>
                  <span className="muted small">{a.programName} · Entwurf</span>
                </span>
              </Link>
            ))}
            {openTasks.slice(0, 3).map((t) => (
              <Link key={t.id} to="/betrieb" className="todo" style={{ color: 'inherit', textDecoration: 'none' }}>
                <span className="icon-tile water">{t.phase === 'bau' ? <Tractor size={16} /> : <Droplet size={16} />}</span>
                <span className="todo-text">
                  <b style={{ fontWeight: 600 }}>{t.label}</b>
                  <span className="muted small">{t.phaseLabel}</span>
                </span>
              </Link>
            ))}
          </section>

          <section className="card" aria-labelledby="gen-h">
            <h2 id="gen-h" className="section-title" style={{ marginBottom: 8 }}>Genehmigungen &amp; Förderung</h2>
            <div className="list-row">
              <div>
                <div style={{ fontWeight: 500 }}>Plangenehmigung § 68 WHG</div>
                <div className="muted" style={{ fontSize: 12 }}>Untere Wasserbehörde</div>
              </div>
              <Badge tone="gelb">In Vorbereitung</Badge>
            </div>
            <div className="list-row">
              <div>
                <div style={{ fontWeight: 500 }}>ANK-Förderbescheid</div>
                <div className="muted" style={{ fontSize: 12 }}>BfN / Bund · Wasserbau &amp; Pflanzgut</div>
              </div>
              <Badge tone="blau">Eingereicht</Badge>
            </div>
            <div className="list-row">
              <div>
                <div style={{ fontWeight: 500 }}>FFH-Verträglichkeit</div>
                <div className="muted" style={{ fontSize: 12 }}>Naturschutzbehörde</div>
              </div>
              <Badge tone="gruen">Geprüft</Badge>
            </div>
            <div className="list-row">
              <div>
                <div style={{ fontWeight: 500 }}>GAP GLÖZ 2</div>
                <div className="muted" style={{ fontSize: 12 }}>Erhalt von Moorböden</div>
              </div>
              <Badge tone="gruen">Konform</Badge>
            </div>
            {state.applications.filter((a) => a.status !== 'entwurf').map((a) => {
              const stage = applicationStage(a, now);
              return (
                <div key={a.id} className="list-row">
                  <div>
                    <div style={{ fontWeight: 500 }}>{a.programName}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{eur(a.amountRequested)} beantragt</div>
                  </div>
                  <Badge tone={stage.tone}>{stage.label}</Badge>
                </div>
              );
            })}
          </section>

          {state.bookings.length > 0 && (
            <section className="card" aria-labelledby="book-h">
              <h2 id="book-h" className="section-title" style={{ marginBottom: 8 }}>Maschinenbuchungen</h2>
              {state.bookings.map((b) => (
                <div key={b.id} className="list-row">
                  <div>
                    <div style={{ fontWeight: 500 }}>{b.machineName}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{b.from} bis {b.to}</div>
                  </div>
                  <b style={{ fontWeight: 600 }}>{eur(b.total)}</b>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
