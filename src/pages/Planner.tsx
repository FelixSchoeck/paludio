import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { CROPS, cropById } from '../lib/crops';
import { analyze, emissionCurvePoints, emissionPerHa, recommendCrops, currentWl as wlNow, DEFAULT_LAND_USE, TYPICAL_WL } from '../lib/calc';
import { landUseLabel } from '../lib/parcels';
import { Badge, Empty, Field, PageHeader, eur, nf } from '../components/ui';
import { LineChart } from '../components/Charts';
import { estimateSummary, sourceLabel, sourcesOf } from '../components/ParcelFacts';
import { isEstimate } from '../lib/parcels';
import { CropIcon, MapPin, Globe2, AlertTriangle, Info, Save, Play, Check, ArrowRight, ChevronLeft } from '../components/Icons';

const moorLabel = { niedermoor: 'Niedermoor', hochmoor: 'Hochmoor', mineral: 'Mineralboden' } as const;

export default function Planner() {
  const { state, setDraft, savePlan, deletePlan, loadPlan, startProject, say } = useStore();
  const nav = useNavigate();
  const { draft } = state;
  const [planName, setPlanName] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(draft.parcelIds.length ? 2 : 1);
  const [showDetails, setShowDetails] = useState(false);

  const parcels = useMemo(
    () => state.myParcels.filter((p) => draft.parcelIds.includes(p.id)),
    [state.myParcels, draft.parcelIds],
  );
  const crop = cropById(draft.cropId) ?? CROPS[0];
  const res = useMemo(() => analyze(parcels, draft), [parcels, draft]);
  const options = useMemo(() => (parcels.length ? recommendCrops(parcels, draft) : []), [parcels, draft]);
  const est = estimateSummary(parcels);
  const best = options.find((o) => o.recommended);
  const selected = options.find((o) => o.crop.id === draft.cropId);
  const curve = useMemo(() => emissionCurvePoints(), []);

  const toggleParcel = (id: string) =>
    setDraft({ parcelIds: draft.parcelIds.includes(id) ? draft.parcelIds.filter((x) => x !== id) : [...draft.parcelIds, id] });

  if (state.myParcels.length === 0)
    return (
      <div className="page">
        <PageHeader title="Planer" sub="Nutzung, Wirtschaftlichkeit und Klimawirkung für Ihre Flächen berechnen." />
        <Empty icon={<MapPin size={36} />} title="Zuerst Flächen auswählen">
          Wählen Sie auf der Karte Ihre Flurstücke aus, um hier Szenarien zu berechnen.
          <div className="row gap center" style={{ marginTop: 14 }}>
            <Link className="btn primary" to="/karte">Zur Karte</Link>
          </div>
        </Empty>
      </div>
    );

  const targetWl = res.targetWl;
  const netInvest = res.capex.total - (draft.useFunding ? res.funding.oneTime : 0);
  const labels = res.rows.map((r) => `J${r.year}`);
  const currentWl = parcels.length ? parcels.reduce((a, p) => a + wlNow(p, draft.assumedLandUse) * p.areaHa, 0) / Math.max(0.01, parcels.reduce((a, p) => a + p.areaHa, 0)) : 0;
  const assumedUse = draft.assumedLandUse ?? DEFAULT_LAND_USE;

  const doSave = () => {
    if (!parcels.length) return say('Bitte zuerst Flächen auswählen');
    const id = savePlan(planName.trim() || `${crop.name} · ${nf(res.moorHa, 1)} ha`);
    setPlanName('');
    say('Plan gespeichert');
    return id;
  };
  const doStart = () => {
    if (!res.hasMoor) return say('Ohne Moorfläche kann kein Projekt gestartet werden');
    const id = savePlan(planName.trim() || `${crop.name} · ${nf(res.moorHa, 1)} ha`);
    startProject(id);
    say('Projekt gestartet – Begleitung unter „Betrieb“');
    nav('/betrieb');
  };

  // Höchstens ein Hinweis – der wichtigste zuerst
  const hint: { tone: 'bad' | 'warn' | ''; text: ReactNode } | null =
    !res.fit.ok ? { tone: 'bad', text: <>{crop.name} ist für diese Flächen nicht geeignet: {res.fit.reasons.join(', ')}.</> }
    : res.fit.level === 'bedingt' ? { tone: 'warn', text: <>{crop.name} ist nur bedingt geeignet: {res.fit.reasons.join(', ')}.</> }
    : res.deficitMm > 100 ? { tone: 'warn', text: <>Hohes Sommer-Wasserdefizit ({nf(res.deficitMm)} mm). Zuleitung und Speicher sind eingerechnet, Ertrag {nf(res.yieldFactor * 100)} %.</> }
    : best && best.crop.id !== crop.id
      ? { tone: '', text: <>Empfohlen ist <b>{best.crop.name}</b>: {best.pros[0] ?? 'beste Kombination aus Kapitalwert und Umsetzbarkeit'}. <button className="btn small" style={{ marginLeft: 6 }} onClick={() => setDraft({ cropId: best.crop.id, targetWlCm: null })}>Übernehmen</button></> }
      : null;

  const maxNpv = Math.max(1, ...options.filter((o) => o.fit.ok).map((o) => o.res.kpis.npv));
  const selHa = parcels.reduce((a, p) => a + p.areaHa, 0);
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  const stepItems = [
    { n: 1 as const, label: 'Flächen', sub: parcels.length ? `${parcels.length} Flurstück${parcels.length === 1 ? '' : 'e'} · ${nf(selHa, 1)} ha` : 'auswählen' },
    { n: 2 as const, label: 'Nutzung', sub: crop.name },
    { n: 3 as const, label: 'Annahmen', sub: `${draft.horizonYears} Jahre · ${nf(draft.discountRate * 100)} % Zins` },
  ];

  return (
    <div className="page">
      <PageHeader title="Planer" sub="Nutzung, Wirtschaftlichkeit und Klimawirkung für Ihre Flächen berechnen. Alle Werte sind Richtwerte." />

      {est.any && (
        <div className="note warn estimate-banner">
          <AlertTriangle size={16} style={{ flex: 'none', marginTop: 2 }} />
          <div>
            <b>Es fehlen Angaben zu Ihren Flächen.</b>{' '}
            {[est.landUse && `Nutzung bei ${est.landUse}`, est.water && `Wasserstand bei ${est.water}`, est.soil && `Boden oder Torf bei ${est.soil}`].filter(Boolean).join(', ')} von {est.total} Moor-Flurstücken.
            {' '}Gerechnet wird dort mit der Annahme „{landUseLabel(assumedUse)}, {TYPICAL_WL[assumedUse]} cm unter Flur“ (änderbar unter Annahmen).{' '}
            <Link to="/karte">Echte Werte unter „Meine Flächen“ eintragen →</Link>
          </div>
        </div>
      )}

      <div className="stepper" role="tablist" aria-label="Planungsschritte" style={{ marginTop: 0 }}>
        {stepItems.map((s) => (
          <button
            key={s.n}
            role="tab"
            aria-selected={step === s.n}
            className={`s ${step === s.n ? 'cur' : step > s.n ? 'done' : ''}`}
            onClick={() => setStep(s.n)}
          >
            <i>{step > s.n ? <Check size={13} strokeWidth={2.5} /> : s.n}</i>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
              <span>{s.label}</span>
              <small className="muted" style={{ fontWeight: 400 }}>{s.sub}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="grid-2-1">
        {/* Aktueller Schritt */}
        <section className="card stack" style={{ gap: 16 }}>
          {step === 1 && (
            <>
              <div>
                <h2 className="section-title">Welche Flächen sollen wiedervernässt werden?</h2>
                <span className="muted small">Mineralböden werden nicht in die Moor-Berechnung einbezogen.</span>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th /><th>Flurstück</th><th className="num">Fläche</th><th>Boden</th><th className="num">Wasser heute</th></tr></thead>
                  <tbody>
                    {state.myParcels.map((p) => (
                      <tr key={p.id} className={`click ${draft.parcelIds.includes(p.id) ? 'on' : ''}`} onClick={() => toggleParcel(p.id)}>
                        <td><input type="checkbox" checked={draft.parcelIds.includes(p.id)} onChange={() => toggleParcel(p.id)} onClick={(e) => e.stopPropagation()} aria-label={`${p.label} auswählen`} /></td>
                        <td><b>{p.label}</b><div className="muted" style={{ fontSize: 12 }}>{p.gemarkung}</div></td>
                        <td className="num">{nf(p.areaHa, 2)} ha</td>
                        <td><Badge tone={p.moorType === 'mineral' ? 'grau' : 'braun'}>{p.soilCategory ?? moorLabel[p.moorType]}{p.moorType !== 'mineral' && ` · ${p.peatClass ? p.peatClass.replace(/^TM\w+ \((.*)\)$/, '$1') : `${p.peatDepthCm} cm`}`}</Badge></td>
                        <td className="num" title={isEstimate(sourcesOf(p).water) ? 'Keine Angabe – gerechnet mit der Annahme' : `Quelle: ${sourceLabel(sourcesOf(p).water)}`}>{p.moorType === 'mineral' ? '–' : isEstimate(sourcesOf(p).water) ? <span className="muted">keine Angabe</span> : `${p.waterLevelCm} cm`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row between wrap gap">
                <Link to="/karte" className="small" style={{ fontWeight: 500 }}>Weitere Flächen auf der Karte wählen</Link>
                <button className="btn primary" onClick={() => setStep(2)} disabled={!parcels.length}>Weiter zur Nutzung <ArrowRight size={16} /></button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="section-title">Was soll auf den nassen Flächen wachsen?</h2>
                <span className="muted small">Sortiert nach Kapitalwert über {draft.horizonYears} Jahre, gewichtet mit der Umsetzbarkeit (Reifegrad, Absatzmarkt, Genehmigungshürden)</span>
              </div>
              <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Nutzung">
                {options.map((o) => {
                  const c = o.crop;
                  const r = o.res;
                  const on = draft.cropId === c.id;
                  return (
                    <button
                      key={c.id}
                      role="radio"
                      aria-checked={on}
                      className={`crop-row ${on ? 'on' : ''} ${o.fit.ok ? '' : 'off'}`}
                      onClick={() => setDraft({ cropId: c.id, targetWlCm: null })}
                    >
                      <span className="crop-radio" />
                      <span className="crop-ic"><CropIcon name={c.id} size={20} /></span>
                      <span className="crop-name">
                        <span className="row gap-s wrap">
                          <b>{c.name}</b>
                          {o.recommended && <span className="badge gruen">Empfohlen</span>}
                          {o.highestNpv && !o.recommended && <span className="badge grau">Höchster Kapitalwert</span>}
                        </span>
                        <span className="muted small">
                          {o.fit.ok ? `Umsetzbarkeit ${o.feasibilityLabel} · ${o.cons[0] ?? c.short}` : o.fit.reasons[0]}
                        </span>
                      </span>
                      <span className="crop-value">
                        {o.fit.ok ? (
                          <>
                            <span className={r.kpis.npv >= 0 ? '' : 'bad'}>{eur(r.kpis.npv)}</span>
                            <span className="crop-bar"><span style={{ width: `${Math.max(0, Math.round((r.kpis.npv / maxNpv) * 100))}%` }} /></span>
                          </>
                        ) : <span className="muted">ungeeignet</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selected && (
                <section className="why-box" aria-label={`Bewertung ${crop.name}`}>
                  <h3>{selected.recommended ? `Warum ${crop.name} empfohlen wird` : `Bewertung ${crop.name}`}</h3>
                  <div className="why-grid">
                    {selected.pros.length > 0 && (
                      <ul className="why-list pro">
                        {selected.pros.map((t) => <li key={t}><Check size={14} strokeWidth={2.5} /> {t}</li>)}
                      </ul>
                    )}
                    {selected.cons.length > 0 && (
                      <ul className="why-list con">
                        {selected.cons.map((t) => <li key={t}><AlertTriangle size={14} /> {t}</li>)}
                      </ul>
                    )}
                  </div>
                  {selected.fit.ok && (
                    <p className="muted small" style={{ margin: 0 }}>
                      Kapitalwert {eur(selected.res.kpis.npv)} × Umsetzbarkeit {Math.round(selected.feasibility * 100)} % = Bewertung {eur(selected.expected)}.
                      {best && !selected.recommended && ` Die Empfehlung ${best.crop.name} erreicht ${eur(best.expected)}.`}
                    </p>
                  )}
                </section>
              )}
              <details className="crop-detail">
                <summary><b>Steckbrief {crop.name}</b> <Badge tone={crop.maturity === 'etabliert' ? 'gruen' : crop.maturity === 'Pilot' ? 'gelb' : 'rot'}>{crop.maturity}</Badge></summary>
                <p style={{ marginTop: 8 }}>{crop.description}</p>
                <div className="kv wide">
                  <span>Zielwasserstand</span><b>{crop.waterLevelCm <= 0 ? 'bis Flur' : `${crop.waterLevelCm} cm unter Flur`}</b>
                  <span>Ertrag</span><b>{nf(crop.yieldPerHa, 1)} {crop.yieldUnit}/ha · {crop.pricePerUnit} {crop.priceUnit}</b>
                  <span>Erntefenster</span><b>{crop.harvestMonths.length ? crop.harvestMonths.map((m) => months[m - 1]).join(', ') : '–'}</b>
                  <span>Risiko</span><b>{crop.risks}</b>
                </div>
              </details>
              <div className="row between wrap gap">
                <button className="btn ghost" onClick={() => setStep(1)}><ChevronLeft size={16} /> Flächen</button>
                <button className="btn primary" onClick={() => setStep(3)}>Weiter zu den Annahmen <ArrowRight size={16} /></button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2 className="section-title">Mit welchen Annahmen rechnen wir?</h2>
                <span className="muted small">Voreinstellungen passen für die meisten Betriebe.</span>
              </div>
              <div className="form-grid">
                <Field label={`Ziel-Wasserstand: ${targetWl} cm unter Flur`} hint={`Optimum für ${crop.name}: ${crop.waterLevelCm} cm. Heute ca. ${nf(currentWl, 0)} cm.`}>
                  <input type="range" min={-10} max={60} step={1} value={targetWl} onChange={(e) => setDraft({ targetWlCm: Number(e.target.value) })} />
                </Field>
                <Field label={`CO₂-Preis Moor-Zertifikate: ${draft.co2Price} €/t`}>
                  <input type="range" min={20} max={140} step={5} value={draft.co2Price} onChange={(e) => setDraft({ co2Price: Number(e.target.value) })} />
                </Field>
                <Field label="Heutige Nutzung, wo nicht angegeben" hint={`Bestimmt entgangenen Deckungsbeitrag und heutigen Wasserstand (typisch ${TYPICAL_WL[assumedUse]} cm unter Flur).`}>
                  <select value={assumedUse} onChange={(e) => setDraft({ assumedLandUse: e.target.value as typeof assumedUse })}>
                    {(['acker', 'gruenland_intensiv', 'gruenland_extensiv', 'brache'] as const).map((u) => <option key={u} value={u}>{landUseLabel(u)}</option>)}
                  </select>
                </Field>
                <Field label="Betrachtungszeitraum">
                  <select value={draft.horizonYears} onChange={(e) => setDraft({ horizonYears: Number(e.target.value) })}>
                    <option value={10}>10 Jahre</option><option value={20}>20 Jahre</option><option value={30}>30 Jahre</option>
                  </select>
                </Field>
                <Field label="Kalkulationszins">
                  <select value={draft.discountRate} onChange={(e) => setDraft({ discountRate: Number(e.target.value) })}>
                    <option value={0.01}>1 %</option><option value={0.03}>3 %</option><option value={0.05}>5 %</option>
                  </select>
                </Field>
                <label className="check"><input type="checkbox" checked={draft.sellCertificates} onChange={(e) => setDraft({ sellCertificates: e.target.checked })} /> Moor-Klimazertifikate verkaufen</label>
                <label className="check"><input type="checkbox" checked={draft.useFunding} onChange={(e) => setDraft({ useFunding: e.target.checked })} /> Förderungen berücksichtigen</label>
              </div>
              {draft.targetWlCm !== null && <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => setDraft({ targetWlCm: null })}>Wasserstand auf Empfehlung zurücksetzen</button>}
              <div className="row between wrap gap">
                <button className="btn ghost" onClick={() => setStep(2)}><ChevronLeft size={16} /> Nutzung</button>
                <button className="btn primary" onClick={doStart} disabled={!res.hasMoor}><Play size={16} /> Projekt starten</button>
              </div>
            </>
          )}
        </section>

        {/* Ergebnis */}
        <aside className="card stack" aria-labelledby="erg-h" style={{ gap: 16 }}>
          {!res.hasMoor ? (
            <Empty icon={<Globe2 size={32} />} title="Keine Moorfläche ausgewählt">Wählen Sie mindestens ein Flurstück mit Moorboden aus.</Empty>
          ) : (
            <>
              <div>
                <span className="muted small">Ergebnis für</span>
                <h2 id="erg-h" className="section-title" style={{ fontSize: 20 }}>{crop.name} auf {nf(res.moorHa, 1)} ha</h2>
              </div>
              {hint && (
                <div className={`note ${hint.tone}`}>
                  {hint.tone ? <AlertTriangle size={15} className="icon-inline" /> : <Info size={15} className="icon-inline" />} {hint.text}
                </div>
              )}
              <div className="result-figures">
                <div>
                  <span className="kpi-label">Kapitalwert</span>
                  <span className={`kpi-value ${res.kpis.npv >= 0 ? '' : 'bad'}`}>{eur(res.kpis.npv)}</span>
                  <span className="kpi-hint">{res.kpis.payback ? `Amortisation nach ${nf(res.kpis.payback, 1)} Jahren` : 'keine Amortisation im Zeitraum'}</span>
                </div>
                <div>
                  <span className="kpi-label">Mehrertrag ggü. heute</span>
                  <span className={`kpi-value ${res.kpis.steadyDelta >= 0 ? '' : 'bad'}`}>{eur(res.kpis.steadyDelta)}<span className="kpi-unit"> /Jahr</span></span>
                  <span className="kpi-hint">im Regelbetrieb</span>
                </div>
                <div>
                  <span className="kpi-label">THG-Minderung</span>
                  <span className="kpi-value good">{nf(res.emissions.avoidedT)}<span className="kpi-unit"> t CO₂e/Jahr</span></span>
                  <span className="kpi-hint">{nf(res.emissions.baselinePerHa, 1)} → {nf(res.emissions.scenarioPerHa, 1)} t je ha</span>
                </div>
              </div>
              <div className="funding-line">
                <div>
                  <b>{eur(res.funding.oneTime)} Förderung</b>
                  <div className="muted small">+ {eur(res.funding.annual)} pro Jahr · {res.funding.chosen.length} passende Programme</div>
                </div>
                <Link className="btn small" to="/foerderung">Ansehen</Link>
              </div>
              <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} aria-expanded={showDetails} onClick={() => setShowDetails((v) => !v)}>
                {showDetails ? 'Details ausblenden' : 'Berechnung im Detail'}
              </button>
            </>
          )}
        </aside>
      </div>

      {res.hasMoor && showDetails && (
        <section aria-label="Berechnung im Detail" className="grid-2">
          <section className="card">
            <h3>Kumulierter Mehrertrag gegenüber heute</h3>
            <LineChart
              labels={labels}
              series={[
                { name: 'Gegenüber heute', color: '#2e6a3b', data: res.rows.map((r) => Math.round(r.cumDelta)), area: true },
                { name: 'Absoluter Cashflow', color: '#1d5e78', data: res.rows.map((r) => Math.round(r.cumNet)), dashed: true },
              ]}
              yFormat={(v) => `${nf(v / 1000)}k`} zeroLine unit=" €"
            />
          </section>
          <section className="card">
            <h3>Klimawirkung nach Wasserstand</h3>
            <LineChart
              labels={curve.map(([w]) => `${w}`)} xTickEvery={4} unit=" t"
              series={[{ name: 't CO₂e/ha·a', color: '#8a5300', data: curve.map(([, e]) => Math.round(e * 10) / 10), area: true }]}
              yFormat={(v) => nf(v)}
            />
            <p className="muted small">Wasserflurabstand in cm unter Gelände. Heute ca. {nf(currentWl, 0)} cm → {nf(emissionPerHa(currentWl), 1)} t, Ziel {targetWl} cm → {nf(emissionPerHa(targetWl), 1)} t CO₂e/ha·a. Vereinfachtes Modell nach dem GEST-Ansatz.</p>
          </section>
          <section className="card">
            <h3>Investition &amp; Wasserbau</h3>
            <table className="table compact">
              <tbody>
                <tr><td>Planung &amp; Genehmigung</td><td className="num">{eur(res.capex.planning)}</td></tr>
                <tr><td>Wasserbau (≈ {res.capex.weirs} Staue, {nf(res.capex.ditchLenM)} m Gräben{res.capex.dikeM ? `, ${nf(res.capex.dikeM)} m Verwallung` : ''})</td><td className="num">{eur(res.capex.waterworks)}</td></tr>
                <tr><td>Etablierung {crop.name}</td><td className="num">{eur(res.capex.establishment)}</td></tr>
                <tr className="total"><td>Investition brutto</td><td className="num">{eur(res.capex.total)}</td></tr>
                <tr><td>− Fördermittel (einmalig)</td><td className="num good">{draft.useFunding ? `− ${eur(res.funding.oneTime)}` : '–'}</td></tr>
                <tr className="total"><td>Eigenanteil</td><td className="num">{eur(netInvest)}</td></tr>
              </tbody>
            </table>
          </section>
          <section className="card">
            <h3>Jahresergebnis im Regelbetrieb</h3>
            <table className="table compact">
              <tbody>
                <tr><td>Erlöse {crop.name}</td><td className="num">{eur(res.kpis.fullRevenue)}</td></tr>
                <tr><td>− Variable Kosten</td><td className="num">− {eur(res.kpis.fullVarCost)}</td></tr>
                <tr><td>+ Moor-Zertifikate (netto)</td><td className="num">{eur(res.kpis.fullCertNet)}</td></tr>
                <tr><td>+ Flächenprämien</td><td className="num">{draft.useFunding ? eur(res.funding.annual) : '–'}</td></tr>
                <tr><td>− Entfallender Deckungsbeitrag heute</td><td className="num">− {eur(res.baselineDb)}</td></tr>
                <tr className="total"><td>Ergebnis ggü. heute</td><td className="num">{eur(res.kpis.steadyDelta)}</td></tr>
              </tbody>
            </table>
            <p className="muted small">Die GAP-Basisprämie bleibt bei Paludikultur bestehen und ist daher nicht enthalten. Arbeitszeit ca. {nf(res.kpis.labourHours)} h/Jahr.</p>
          </section>
        </section>
      )}

      <section className="card action-bar">
        <div className="row gap wrap grow">
          <label className="vh" htmlFor="plan-name">Name des Plans</label>
          <input id="plan-name" type="text" className="grow" placeholder={`Name des Plans, z. B. ${crop.name} · ${nf(res.moorHa, 1)} ha`} value={planName} onChange={(e) => setPlanName(e.target.value)} />
          <button className="btn" onClick={doSave}><Save size={16} /> Speichern</button>
          <button className="btn primary" onClick={doStart} disabled={!res.hasMoor}><Play size={16} /> Projekt starten</button>
        </div>
      </section>

      {state.plans.length > 0 && (
        <details className="card">
          <summary><h3 style={{ margin: 0, fontSize: 16 }}>Gespeicherte Pläne ({state.plans.length})</h3></summary>
          <div className="list" style={{ marginTop: 8 }}>
            {state.plans.map((p) => {
              const hasProject = state.projects.some((x) => x.planId === p.id);
              return (
                <div key={p.id} className="row between wrap fund-line">
                  <div>
                    <b>{p.name}</b>
                    <div className="muted small">{cropById(p.draft.cropId)?.name} · {p.draft.parcelIds.length} Flurstück(e) · {new Date(p.createdAt).toLocaleDateString('de-DE')}</div>
                  </div>
                  <div className="row gap-s">
                    {hasProject && <Badge tone="gruen">Projekt aktiv</Badge>}
                    <button className="btn small" onClick={() => { loadPlan(p.id); say('Plan geladen'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Laden</button>
                    {!hasProject && <button className="btn small" onClick={() => { startProject(p.id); nav('/betrieb'); }}>Projekt starten</button>}
                    <button className="btn small ghost" onClick={() => deletePlan(p.id)}>Löschen</button>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

