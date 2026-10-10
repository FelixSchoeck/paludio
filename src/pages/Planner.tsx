import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { CROPS, cropById } from '../lib/crops';
import { analyze, cropFit, emissionCurvePoints, emissionPerHa, rankCrops } from '../lib/calc';
import { BUNDESLAENDER } from '../lib/geo';
import { Badge, Empty, Field, Kpi, PageHeader, eur, nf } from '../components/ui';
import { LineChart } from '../components/Charts';
import { CropIcon, MapPin, Globe2, AlertTriangle, Info, Save, Euro, Play, Plus } from '../components/Icons';

const moorLabel = { niedermoor: 'Niedermoor', hochmoor: 'Hochmoor', mineral: 'Mineralboden' } as const;

export default function Planner() {
  const { state, setDraft, savePlan, deletePlan, loadPlan, startProject, say } = useStore();
  const nav = useNavigate();
  const { draft } = state;
  const [planName, setPlanName] = useState('');

  const parcels = useMemo(
    () => state.myParcels.filter((p) => draft.parcelIds.includes(p.id)),
    [state.myParcels, draft.parcelIds],
  );
  const crop = cropById(draft.cropId) ?? CROPS[0];
  const res = useMemo(() => analyze(parcels, draft), [parcels, draft]);
  const ranking = useMemo(() => (parcels.length ? rankCrops(parcels, draft) : []), [parcels, draft]);
  const best = ranking.find((r) => r.fit.ok);
  const curve = useMemo(() => emissionCurvePoints(), []);

  const toggleParcel = (id: string) =>
    setDraft({ parcelIds: draft.parcelIds.includes(id) ? draft.parcelIds.filter((x) => x !== id) : [...draft.parcelIds, id] });

  if (state.myParcels.length === 0)
    return (
      <div className="page">
        <PageHeader title="Planer" sub="Wiedervernässung, Kultur, Wirtschaftlichkeit und Förderung für Ihre Flächen berechnen." />
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
  const currentWl = parcels.length ? parcels.reduce((a, p) => a + p.waterLevelCm * p.areaHa, 0) / Math.max(0.01, parcels.reduce((a, p) => a + p.areaHa, 0)) : 0;

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
    say('Projekt gestartet – Begleitung unter „Betrieb & Pegel“');
    nav('/betrieb');
  };

  return (
    <div className="page">
      <PageHeader
        title="Planer"
        sub="Wiedervernässungskonzept, Kultur, Wirtschaftlichkeit und Förderung für Ihre Flächen – alle Werte sind Richtwerte aus dem Prototyp-Modell."
        actions={<Link className="btn" to="/karte"><Plus size={16} /> Flächen ändern</Link>}
      />

      <div className="grid-2-1">
        <div className="stack">
          <section className="card">
            <h3>1 · Flächen</h3>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th /><th>Flurstück</th><th className="num">Fläche</th><th>Boden</th><th className="num">Torf</th><th className="num">Wasser heute</th></tr></thead>
                <tbody>
                  {state.myParcels.map((p) => (
                    <tr key={p.id} className={draft.parcelIds.includes(p.id) ? 'on' : ''}>
                      <td><input type="checkbox" checked={draft.parcelIds.includes(p.id)} onChange={() => toggleParcel(p.id)} aria-label={`${p.label} auswählen`} /></td>
                      <td><b>{p.label}</b><div className="muted" style={{ fontSize: 12 }}>{p.gemarkung}, {p.bundesland}</div></td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>{nf(p.areaHa, 2)} ha</td>
                      <td><Badge tone={p.moorType === 'niedermoor' ? 'braun' : p.moorType === 'hochmoor' ? 'rot' : 'grau'}>{moorLabel[p.moorType]}</Badge></td>
                      <td className="num">{p.moorType === 'mineral' ? '–' : `${p.peatDepthCm} cm`}</td>
                      <td className="num">{p.moorType === 'mineral' ? '–' : `${p.waterLevelCm} cm`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {res.mineralHa > 0 && <div className="note warn">{nf(res.mineralHa, 1)} ha Mineralboden in der Auswahl werden nicht in die Moor-Berechnung einbezogen.</div>}
          </section>

          <section className="card">
            <h3>2 · Nutzung nach der Wiedervernässung</h3>
            <div className="crop-grid">
              {CROPS.map((c) => {
                const fit = cropFit(c, parcels);
                const r = ranking.find((x) => x.crop.id === c.id);
                return (
                  <button
                    key={c.id}
                    className={`crop-card ${draft.cropId === c.id ? 'on' : ''} ${fit.ok ? '' : 'off'}`}
                    onClick={() => setDraft({ cropId: c.id, targetWlCm: null })}
                  >
                    <div className="row between">
                      <span className="crop-ic"><CropIcon name={c.id} size={22} /></span>
                      <Badge tone={fit.level === 'gut' ? 'gruen' : fit.level === 'bedingt' ? 'gelb' : 'rot'}>
                        {fit.level === 'gut' ? 'geeignet' : fit.level === 'bedingt' ? 'bedingt' : 'ungeeignet'}
                      </Badge>
                    </div>
                    <b>{c.name}</b>
                    <span className="muted">{c.short}</span>
                    {r && fit.ok && <span className={`npv ${r.kpis.npv >= 0 ? 'good' : 'bad'}`}>Kapitalwert {eur(r.kpis.npv)}</span>}
                    {!fit.ok && <span className="muted small">{fit.reasons[0]}</span>}
                    {best?.crop.id === c.id && <span className="ribbon">Beste Option</span>}
                  </button>
                );
              })}
            </div>
            <div className="crop-detail">
              <b><CropIcon name={crop.id} size={18} className="icon-inline" /> {crop.name}</b> <Badge tone={crop.maturity === 'etabliert' ? 'gruen' : crop.maturity === 'Pilot' ? 'gelb' : 'rot'}>{crop.maturity}</Badge>
              <p>{crop.description}</p>
              <div className="kv wide">
                <span>Zielwasserstand</span><b>{crop.waterLevelCm <= 0 ? 'bis Flur' : `${crop.waterLevelCm} cm unter Flur`}</b>
                <span>Ertrag (Vollertrag)</span><b>{nf(crop.yieldPerHa, 1)} {crop.yieldUnit}/ha · {crop.pricePerUnit} {crop.priceUnit}</b>
                <span>Erntefenster</span><b>{crop.harvestMonths.length ? crop.harvestMonths.map((m) => ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][m - 1]).join(', ') : '–'}</b>
                <span>Risiko</span><b>{crop.risks}</b>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>3 · Annahmen</h3>
            <div className="form-grid">
              <Field label={`Ziel-Wasserstand: ${targetWl} cm unter Flur`} hint={`Optimum für ${crop.name}: ${crop.waterLevelCm} cm. Heute ca. ${nf(currentWl, 0)} cm.`}>
                <input type="range" min={-10} max={60} step={1} value={targetWl} onChange={(e) => setDraft({ targetWlCm: Number(e.target.value) })} />
              </Field>
              <Field label={`CO₂-Preis Moor-Zertifikate: ${draft.co2Price} €/t`}>
                <input type="range" min={20} max={140} step={5} value={draft.co2Price} onChange={(e) => setDraft({ co2Price: Number(e.target.value) })} />
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
            {draft.targetWlCm !== null && <button className="btn ghost small" onClick={() => setDraft({ targetWlCm: null })}>Wasserstand auf Empfehlung zurücksetzen</button>}
          </section>
        </div>

        <div className="stack sticky">
          {!res.hasMoor ? (
            <div className="card"><Empty icon={<Globe2 size={36} />} title="Keine Moorfläche ausgewählt">Wählen Sie mindestens ein Flurstück mit Moorboden aus.</Empty></div>
          ) : (
            <>
              {!res.fit.ok && <div className="note bad"><AlertTriangle size={16} className="icon-inline" /> {crop.name} ist für diese Auswahl nicht geeignet: {res.fit.reasons.join(', ')}.</div>}
              {res.fit.ok && res.fit.level === 'bedingt' && <div className="note warn"><AlertTriangle size={16} className="icon-inline" /> {crop.name} ist nur bedingt geeignet: {res.fit.reasons.join(', ')}.</div>}
              {res.deficitMm > 100 && <div className="note warn">Hohes sommerliches Wasserdefizit ({nf(res.deficitMm)} mm): Wasserbau enthält Zuleitung/Speicher, Ertragsfaktor {nf(res.yieldFactor * 100)} %.</div>}
              {best && best.crop.id !== crop.id && best.kpis.npv > res.kpis.npv + 1000 && (
                <div className="note"><Info size={16} className="icon-inline" /> Mit <b>{best.crop.name}</b> erzielen Sie auf diesen Flächen einen um {eur(best.kpis.npv - res.kpis.npv)} höheren Kapitalwert.
                  <button className="btn small" style={{ marginLeft: 8 }} onClick={() => setDraft({ cropId: best.crop.id, targetWlCm: null })}>Übernehmen</button>
                </div>
              )}

              <div className="kpi-grid">
                <Kpi label="Moorfläche" value={`${nf(res.moorHa, 1)} ha`} hint={`${parcels.length} Flurstück(e)`} />
                <Kpi label="THG-Minderung" value={`${nf(res.emissions.avoidedT)} t/a`} hint={`von ${nf(res.emissions.baselinePerHa, 1)} auf ${nf(res.emissions.scenarioPerHa, 1)} t CO₂e/ha`} tone="good" />
                <Kpi label="Investition (netto)" value={eur(netInvest)} hint={`brutto ${eur(res.capex.total)} · ${nf(res.capex.perHa)} €/ha`} />
                <Kpi label="Umsatz p. a. (Vollertrag)" value={eur(res.kpis.fullRevenue)} hint={`${nf(res.moorHa * crop.yieldPerHa * res.yieldFactor, 0)} ${crop.yieldUnit}`} tone="water" />
                <Kpi label="Ergebnis ggü. heute p. a." value={eur(res.kpis.steadyDelta)} hint="inkl. Prämien & Zertifikate, abzgl. entgangenem DB" tone={res.kpis.steadyDelta >= 0 ? 'good' : 'bad'} />
                <Kpi label="Kapitalwert" value={eur(res.kpis.npv)} hint={res.kpis.payback ? `Amortisation nach ${nf(res.kpis.payback, 1)} Jahren` : 'keine Amortisation im Zeitraum'} tone={res.kpis.npv >= 0 ? 'good' : 'bad'} />
              </div>

              <section className="card">
                <h3>Kumulierter Mehrertrag gegenüber heutiger Nutzung</h3>
                <LineChart
                  labels={labels}
                  series={[
                    { name: 'Gegenüber heute', color: '#1d5e78', data: res.rows.map((r) => Math.round(r.cumDelta)), area: true },
                    { name: 'Absoluter Cashflow', color: '#2e6a3b', data: res.rows.map((r) => Math.round(r.cumNet)), dashed: true },
                  ]}
                  yFormat={(v) => `${nf(v / 1000)}k`} zeroLine unit=" €"
                />
              </section>

              <section className="card">
                <h3>Investition & Wasserbau</h3>
                <table className="table compact">
                  <tbody>
                    <tr><td>Planung & Genehmigung</td><td className="num">{eur(res.capex.planning)}</td></tr>
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
                    <tr><td>− Entfallender Deckungsbeitrag heutige Nutzung</td><td className="num">− {eur(res.baselineDb)}</td></tr>
                    <tr className="total"><td>Ergebnis ggü. heute</td><td className="num">{eur(res.kpis.steadyDelta)}</td></tr>
                  </tbody>
                </table>
                <p className="muted small">Die GAP-Basisprämie bleibt bei Paludikultur bestehen und ist in beiden Varianten gleich – daher nicht enthalten. Arbeitszeit: ca. {nf(res.kpis.labourHours)} h/Jahr.</p>
              </section>
            </>
          )}
        </div>
      </div>

      {res.hasMoor && (
        <div className="grid-2">
          <section className="card">
            <h3>Klimawirkung: Emission nach Wasserstand</h3>
            <LineChart
              labels={curve.map(([w]) => `${w}`)} xTickEvery={4} unit=" t"
              series={[{ name: 't CO₂e/ha·a', color: '#8a5300', data: curve.map(([, e]) => Math.round(e * 10) / 10), area: true }]}
              yFormat={(v) => nf(v)}
            />
            <p className="muted small">Wasserflurabstand in cm unter Gelände (negativ: Überstau). Heute ca. {nf(currentWl, 0)} cm → {nf(emissionPerHa(currentWl), 1)} t CO₂e/ha·a. Ziel {targetWl} cm → {nf(emissionPerHa(targetWl), 1)} t. Vereinfachtes Modell nach dem GEST-Ansatz.</p>
          </section>

          <section className="card">
            <h3>Förderungen, die zu diesem Plan passen</h3>
            {res.funding.chosen.length === 0 ? <p className="muted">Keine passende Förderung gefunden.</p> : (
              <div className="stack gap-s">
                {res.funding.chosen.map((m) => (
                  <div key={m.program.id} className="row between wrap fund-line">
                    <div>
                      <b>{m.program.name}</b>
                      <div className="muted small">{m.program.provider === 'Land' && m.program.states !== 'ALL' ? m.program.states.map((s) => BUNDESLAENDER[s].name).join(', ') : m.program.provider}</div>
                    </div>
                    <div className="num">
                      {m.oneTime > 0 && <div>{eur(m.oneTime)} <span className="muted small">einmalig</span></div>}
                      {m.annual > 0 && <div>{eur(m.annual)} <span className="muted small">/ Jahr × {m.years}</span></div>}
                    </div>
                  </div>
                ))}
                <Link className="btn" to="/foerderung">Alle Programme & Antrag →</Link>
              </div>
            )}
          </section>
        </div>
      )}

      {res.hasMoor && ranking.length > 0 && (
        <section className="card">
          <h3>Vergleich aller Optionen</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Option</th><th>Eignung</th><th className="num">Investition €/ha</th><th className="num">Umsatz €/ha·a</th><th className="num">THG-Minderung t/a</th><th className="num">Kapitalwert</th><th className="num">Amortisation</th></tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.crop.id} className={`click ${r.crop.id === crop.id ? 'on' : ''}`} onClick={() => setDraft({ cropId: r.crop.id, targetWlCm: null })}>
                    <td><b><CropIcon name={r.crop.id} size={16} className="icon-inline" /> {r.crop.name}</b></td>
                    <td><Badge tone={r.fit.level === 'gut' ? 'gruen' : r.fit.level === 'bedingt' ? 'gelb' : 'rot'}>{r.fit.level}</Badge></td>
                    <td className="num">{nf(r.capex.perHa)}</td>
                    <td className="num">{nf(r.moorHa ? r.kpis.fullRevenue / r.moorHa : 0)}</td>
                    <td className="num">{nf(r.emissions.avoidedT)}</td>
                    <td className={`num ${r.kpis.npv >= 0 ? 'good' : 'bad'}`}>{eur(r.kpis.npv)}</td>
                    <td className="num">{r.kpis.payback ? `${nf(r.kpis.payback, 1)} J.` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card action-bar">
        <div className="row gap wrap grow">
          <input className="grow" placeholder="Name des Plans (optional)" value={planName} onChange={(e) => setPlanName(e.target.value)} />
          <button className="btn" onClick={doSave}><Save size={16} /> Plan speichern</button>
          <button className="btn" onClick={() => nav('/foerderung')} disabled={!res.hasMoor}><Euro size={16} /> Förderung beantragen</button>
          <button className="btn primary" onClick={doStart} disabled={!res.hasMoor}><Play size={16} /> Projekt starten & begleiten lassen</button>
        </div>
      </section>

      {state.plans.length > 0 && (
        <section className="card">
          <h3>Gespeicherte Pläne</h3>
          <div className="list">
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
        </section>
      )}
    </div>
  );
}
