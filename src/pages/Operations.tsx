import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationStage, bookingStage, useNow, useStore } from '../lib/store';
import { analyze } from '../lib/calc';
import {
  BUILD_END_MONTH, PHASES, TASKS, dateAtMonth, monthlyStats, phaseAt, recommend, simParams, simulate, yieldByYear, type RecoLevel,
} from '../lib/monitoring';
import { Badge, Empty, Kpi, PageHeader, eur, fdate, nf } from '../components/ui';
import { BarChart, LineChart } from '../components/Charts';
import {
  Activity,
  AlertTriangle,
  ShieldAlert,
  Info,
  CheckCircle2,
  Download,
  CropIcon,
  Tractor,
  ShoppingBag,
  RotateCcw,
  Check,
} from '../components/Icons';

const levelTone: Record<RecoLevel, 'rot' | 'gelb' | 'blau' | 'gruen'> = { kritisch: 'rot', wichtig: 'gelb', hinweis: 'blau', positiv: 'gruen' };

function RecoLevelIcon({ level }: { level: RecoLevel }) {
  switch (level) {
    case 'kritisch': return <AlertTriangle size={18} className="text-rot icon-inline" />;
    case 'wichtig': return <ShieldAlert size={18} className="text-gelb icon-inline" />;
    case 'hinweis': return <Info size={18} className="text-blau icon-inline" />;
    case 'positiv': return <CheckCircle2 size={18} className="text-gruen icon-inline" />;
  }
}

export default function Operations() {
  const { state, loadDemo } = useStore();
  const [projectId, setProjectId] = useState<string | null>(null);

  const project = state.projects.find((p) => p.id === projectId) ?? state.projects[0];

  if (!project)
    return (
      <div className="page">
        <PageHeader title="Mein Betrieb" sub="Laufende Begleitung während Wiedervernässung und Betrieb: Monitoring, Empfehlungen, Statistiken." />
        <Empty icon={<Activity size={36} />} title="Noch kein aktives Projekt">
          Starten Sie im Planer ein Projekt – Paludio begleitet Sie dann von der Genehmigung über den Bau bis zum Regelbetrieb.
          <div className="row gap center" style={{ marginTop: 14 }}>
            <Link className="btn primary" to="/planer">Zum Planer</Link>
            <button className="btn" onClick={loadDemo}>Demobetrieb laden</button>
          </div>
        </Empty>
      </div>
    );

  return <ProjectView key={project.id} projectId={project.id} setProjectId={setProjectId} />;
}

function ProjectView({ projectId: pid, setProjectId: setPid }: { projectId: string; setProjectId: (id: string) => void }) {
  {
    const { state, patchProject, toggleTask, machines, say } = useStore();
    const now = useNow(2000);
    const pr = state.projects.find((p) => p.id === pid)!;
    const plan = state.plans.find((p) => p.id === pr.planId);
    const parcels = useMemo(() => (plan ? state.myParcels.filter((p) => plan.draft.parcelIds.includes(p.id)) : []), [plan]);
    const res = useMemo(() => (plan ? analyze(parcels, plan.draft) : null), [plan, parcels]);

    const month = pr.simMonth;
    const date = dateAtMonth(pr.startDate, month);
    const phase = phaseAt(month);

    const sim = useMemo(() => {
      if (!res) return null;
      const sp = simParams(pr, res);
      const day = Math.round(month * 30.4);
      const from = Math.max(0, day - 364);
      const days = simulate(sp, from, day);
      const last7 = days.slice(-7);
      const last30 = days.slice(-30);
      const wlNow = last7.reduce((a, d) => a + d.wl, 0) / Math.max(1, last7.length);
      const afterBuild = month > BUILD_END_MONTH + 3;
      const inBand = afterBuild ? last30.filter((d) => Math.abs(d.wl - res.targetWl) <= 10).length / Math.max(1, last30.length) : 0;
      return { days, wlNow, inBand, afterBuild };
    }, [res, pr, month]);

    const monthly = useMemo(() => (res && plan ? monthlyStats(pr, res, plan.draft.sellCertificates, month) : []), [res, plan, pr, month]);
    const yields = useMemo(() => (res ? yieldByYear(pr, res, month) : []), [res, pr, month]);

    if (!plan || !res || !sim)
      return (
        <div className="page">
          <PageHeader title="Mein Betrieb" />
          <Empty icon={<AlertTriangle size={36} />} title="Plan oder Flächen nicht mehr vorhanden">Dieses Projekt basiert auf einem gelöschten Plan.</Empty>
        </div>
      );

    const recos = recommend({
      project: pr, plan: res, month, date, wlNow: sim.wlNow, inBandShare: sim.inBand, applications: state.applications,
      machines, listings: state.listings, farmLocation: state.farm.location,
    });

    // Auswertungen
    const cum = (pick: (m: (typeof monthly)[number]) => number) => {
      let s = 0;
      return monthly.map((m) => (s += pick(m)));
    };
    const cumT = cum((m) => m.avoidedT);
    const cumNet = cum((m) => m.net);
    const sumRev = monthly.reduce((a, m) => a + m.revenue + m.certificates, 0);
    const sumGrants = monthly.reduce((a, m) => a + m.grants, 0);
    const sumCost = monthly.reduce((a, m) => a + m.cost, 0);
    const lastYear = monthly.slice(-12);
    const planAvoidPerMonth = res.emissions.avoidedT / 12;

    const wlLabels = sim.days.map((d) => d.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));
    const mLabels = monthly.map((m) => m.date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }));
    const wlTone = !sim.afterBuild ? undefined : Math.abs(sim.wlNow - res.targetWl) <= 10 ? 'good' : Math.abs(sim.wlNow - res.targetWl) <= 20 ? 'warn' : 'bad';

    const exportCsv = () => {
      const rows = ['Datum;Wasserstand_cm_unter_Flur;Niederschlag_mm;Zielwert_cm', ...sim.days.map((d) => `${d.date.toISOString().slice(0, 10)};${d.wl.toFixed(1).replace('.', ',')};${d.rain.toFixed(1).replace('.', ',')};${res.targetWl}`)];
      const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `wasserstandsprotokoll_${pr.name.replace(/\W+/g, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      say('Wasserstandsprotokoll exportiert');
    };

    const sensors = [
      { name: 'Pegel Nord', off: -4, batt: 87 },
      { name: 'Pegel Mitte', off: 0, batt: 64 },
      { name: 'Pegel Süd', off: 5, batt: 92 },
    ];

    const myBookings = state.bookings;
    const myInq = state.inquiries;

    return (
      <div className="page">
        <PageHeader
          title="Mein Betrieb"
          sub={<>Projekt <b>{pr.name}</b> · {nf(res.moorHa, 1)} ha · <CropIcon name={res.crop.id} size={16} className="icon-inline" /> {res.crop.name} · Start {fdate(pr.startDate)}</>}
          actions={
            <>
              {state.projects.length > 1 && (
                <select value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Projekt wählen">
                  {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <button className="btn" onClick={exportCsv}><Download size={15} /> Wasserstandsprotokoll (CSV)</button>
            </>
          }
        />

        <section className="card timeline">
          <div className="row between wrap">
            <div>
              <h3 style={{ margin: 0 }}>Projektverlauf · {phase.label}</h3>
              <div className="muted small">Simulierter Stand: <b>{date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</b> (Monat {month})</div>
            </div>
            <div className="row gap-s wrap">
              <button className="btn small" onClick={() => patchProject(pr.id, { simMonth: Math.min(96, month + 1) })}>+1 Monat</button>
              <button className="btn small" onClick={() => patchProject(pr.id, { simMonth: Math.min(96, month + 6) })}>+6 Monate</button>
              <button className="btn small ghost" onClick={() => patchProject(pr.id, { simMonth: 0 })}><RotateCcw size={14} /> Start</button>
            </div>
          </div>
          <input type="range" min={0} max={96} value={month} onChange={(e) => patchProject(pr.id, { simMonth: Number(e.target.value) })} aria-label="Zeitraffer" />
          <div className="phases">
            {PHASES.map((p, i) => {
              const next = PHASES[i + 1]?.startMonth ?? Infinity;
              const state_ = month >= next ? 'done' : month >= p.startMonth ? 'cur' : '';
              return <div key={p.id} className={`ph ${state_}`}><i>{state_ === 'done' ? <Check size={12} /> : i + 1}</i><b>{p.short}</b><span className="muted small">ab Monat {p.startMonth}</span></div>;
            })}
          </div>
          <div className="muted small">Zeitraffer-Demo: Verschieben Sie den Regler, um Wasserstände, Erträge, Erlöse und Empfehlungen im Projektverlauf zu sehen.</div>
        </section>

        <div className="kpi-grid">
          <Kpi label="Wasserstand aktuell" value={sim.afterBuild || month > BUILD_END_MONTH ? `${nf(sim.wlNow, 0)} cm` : `${nf(sim.wlNow, 0)} cm (vor Bau)`} hint={`Ziel ${res.targetWl} cm unter Flur`} tone={wlTone} />
          <Kpi label="Zielerreichung (30 Tage)" value={sim.afterBuild ? `${nf(sim.inBand * 100)} %` : '–'} hint="Tage im Korridor ±10 cm" tone={sim.afterBuild ? (sim.inBand > 0.8 ? 'good' : sim.inBand > 0.5 ? 'warn' : 'bad') : undefined} />
          <Kpi label="THG eingespart (bisher)" value={`${nf(cumT[cumT.length - 1] ?? 0)} t`} hint="CO₂-Äquivalente aus Pegeldaten" tone="good" />
          <Kpi label="Erlöse (bisher)" value={eur(sumRev)} hint="Ernte + Zertifikate" tone="water" />
          <Kpi label="Förderungen erhalten" value={eur(sumGrants)} hint="Zuschüsse & Prämien" tone="good" />
          <Kpi label="Kosten (bisher)" value={eur(sumCost)} hint={`Saldo ${eur((sumRev + sumGrants) - sumCost)}`} />
        </div>

        <div className="grid-2-1">
          <div className="stack">
            <section className="card">
              <h3>Wasserstand der letzten 12 Monate</h3>
              <LineChart
                labels={wlLabels} xTickEvery={45} invertY unit=" cm"
                band={{ lo: res.targetWl - 10, hi: res.targetWl + 10, color: '#2f7fa8', label: 'Zielkorridor' }}
                series={[
                  { name: 'Wasserstand', color: '#2f7fa8', data: sim.days.map((d) => Math.round(d.wl * 10) / 10) },
                  { name: 'Ziel', color: '#6b8f3c', dashed: true, data: sim.days.map(() => res.targetWl) },
                ]}
              />
              <p className="muted small">cm unter Flur – oben = nass. Simulierte Pegelwerte; im Betrieb kommen die Daten von Ihren Loggern.</p>
            </section>

            <div className="grid-2">
              <section className="card">
                <h3>Niederschlag (Monat)</h3>
                <BarChart labels={lastYear.map((_, i) => mLabels[mLabels.length - lastYear.length + i])} series={[{ name: 'mm', color: '#7aa6c2', data: lastYear.map((m) => Math.round(m.rain)) }]} yFormat={(v) => nf(v)} />
              </section>
              <section className="card">
                <h3>THG-Einsparung (kumuliert)</h3>
                <LineChart
                  labels={mLabels} unit=" t"
                  series={[
                    { name: 'Erreicht', color: '#6b8f3c', area: true, data: cumT.map((v) => Math.round(v)) },
                    { name: 'Plan (volle Wirkung)', color: '#a0702c', dashed: true, data: monthly.map((m, i) => Math.round(Math.max(0, i - BUILD_END_MONTH) * planAvoidPerMonth)) },
                  ]}
                  yFormat={(v) => nf(v)}
                />
              </section>
            </div>

            <div className="grid-2">
              <section className="card">
                <h3>Cashflow (kumuliert)</h3>
                <LineChart labels={mLabels} unit=" €" zeroLine series={[{ name: 'Saldo', color: '#2f7fa8', area: true, data: cumNet.map((v) => Math.round(v)) }]} yFormat={(v) => `${nf(v / 1000)}k`} />
              </section>
              <section className="card">
                <h3>Erlöse Plan vs. Ist</h3>
                <BarChart
                  labels={yields.map((y) => `Jahr ${y.year}`)}
                  series={[
                    { name: 'Plan', color: '#c9b48a', data: yields.map((y) => Math.round(y.planned)) },
                    { name: 'Ist', color: '#6b8f3c', data: yields.map((y) => (y.actual == null ? null : Math.round(y.actual))) },
                  ]}
                  yFormat={(v) => `${nf(v / 1000)}k`}
                />
              </section>
            </div>
          </div>

          <div className="stack">
            <section className="card">
              <h3>Empfehlungen für jetzt</h3>
              {recos.length === 0 && <p className="muted">Aktuell keine offenen Empfehlungen.</p>}
              <div className="stack gap-s">
                {recos.map((r) => (
                  <div key={r.id} className={`reco ${r.level}`}>
                    <div className="row between">
                      <b><RecoLevelIcon level={r.level} /> {r.title}</b>
                      <Badge tone={levelTone[r.level]}>{r.level}</Badge>
                    </div>
                    <p>{r.text}</p>
                    {r.cta && <Link className="btn small" to={r.cta.to}>{r.cta.label} →</Link>}
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <h3>Pegel</h3>
              <table className="table compact">
                <thead><tr><th>Sensor</th><th className="num">Stand</th><th className="num">Akku</th></tr></thead>
                <tbody>
                  {sensors.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td className="num">{nf(sim.wlNow + s.off, 0)} cm</td>
                      <td className="num">{s.batt} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card">
              <h3>Aufgaben</h3>
              {PHASES.map((ph) => {
                const tasks = TASKS.filter((t) => t.phase === ph.id);
                const active = ph.id === phase.id;
                const open = tasks.filter((t) => !pr.tasks[t.id]).length;
                return (
                  <details key={ph.id} open={active}>
                    <summary><b>{ph.label}</b> {active && <Badge tone="blau">aktuell</Badge>} <span className="muted small">{open ? `${open} offen` : 'erledigt'}</span></summary>
                    {tasks.map((t) => (
                      <label key={t.id} className="check task">
                        <input type="checkbox" checked={!!pr.tasks[t.id]} onChange={() => toggleTask(pr.id, t.id)} /> {t.label}
                      </label>
                    ))}
                  </details>
                );
              })}
            </section>

            <section className="card">
              <h3>Anträge & Buchungen</h3>
              <div className="stack gap-s">
                {state.applications.length === 0 && myBookings.length === 0 && myInq.length === 0 && <p className="muted">Noch keine Aktivitäten.</p>}
                {state.applications.map((a) => (
                  <div key={a.id} className="row between"><span className="small">{a.programName}</span><Badge tone={applicationStage(a, now).tone === 'grau' ? 'grau' : applicationStage(a, now).tone === 'blau' ? 'blau' : applicationStage(a, now).tone === 'gelb' ? 'gelb' : 'gruen'}>{applicationStage(a, now).label}</Badge></div>
                ))}
                {myBookings.map((b) => (
                  <div key={b.id} className="row between">
                    <span className="small"><Tractor size={14} className="icon-inline" /> {b.machineName} ({fdate(b.from)})</span>
                    <Badge tone={bookingStage(b, now).tone}>{bookingStage(b, now).label}</Badge>
                  </div>
                ))}
                {myInq.map((i) => (
                  <div key={i.id} className="row between">
                    <span className="small"><ShoppingBag size={14} className="icon-inline" /> {i.listingTitle}</span>
                    <Badge tone="blau">Anfrage gesendet</Badge>
                  </div>
                ))}
                <div className="row gap-s">
                  <Link className="btn small" to="/foerderung">Förderungen</Link>
                  <Link className="btn small" to="/maschinen">Maschinen</Link>
                  <Link className="btn small" to="/produkte">Produkte</Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }
}
