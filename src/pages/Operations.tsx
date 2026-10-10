import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { BUILD_END_MONTH, PHASES, TASKS, monthlyStats, yieldByYear } from '../lib/monitoring';
import { useProjectStatus, type Todo } from '../lib/project';
import { Badge, Empty, Kpi, PageHeader, Tabs, eur, fdate, nf } from '../components/ui';
import { BarChart, LineChart } from '../components/Charts';
import { Activity, AlertTriangle, Download, CropIcon, RotateCcw, Check } from '../components/Icons';

const levelTone = { kritisch: 'rot', wichtig: 'gelb', hinweis: 'blau', positiv: 'gruen' } as const;
const levelLabel = { kritisch: 'Dringend', wichtig: 'Wichtig', hinweis: 'Hinweis', positiv: 'Gut' } as const;

export default function Operations() {
  const { state, loadDemo } = useStore();
  const [projectId, setProjectId] = useState<string | null>(null);
  const project = state.projects.find((p) => p.id === projectId) ?? state.projects[0];

  if (!project)
    return (
      <div className="page">
        <PageHeader title="Betrieb" sub="Begleitung während Wiedervernässung und Betrieb: Wasserstände, Aufgaben und Auswertungen." />
        <Empty icon={<Activity size={36} />} title="Noch kein aktives Projekt">
          Starten Sie im Planer ein Projekt. Paludio begleitet Sie dann von der Genehmigung über den Bau bis zum Regelbetrieb.
          <div className="row gap center" style={{ marginTop: 14 }}>
            <Link className="btn primary" to="/planer">Zum Planer</Link>
            <button className="btn" onClick={loadDemo}>Demobetrieb laden</button>
          </div>
        </Empty>
      </div>
    );

  return <ProjectView key={project.id} projectId={project.id} setProjectId={setProjectId} />;
}

function TodoItem({ t, onToggle }: { t: Todo; onToggle: () => void }) {
  return (
    <div className={`todo-item ${t.done ? 'done' : ''}`}>
      {t.taskId ? (
        <input type="checkbox" checked={!!t.done} onChange={onToggle} aria-label={t.title} />
      ) : (
        <span className={`todo-mark ${t.level ?? 'hinweis'}`} aria-hidden />
      )}
      <div className="todo-text">
        <div className="row gap-s wrap">
          <b style={{ fontWeight: 600 }}>{t.title}</b>
          {!t.done && t.level && t.level !== 'hinweis' && <Badge tone={levelTone[t.level]}>{levelLabel[t.level]}</Badge>}
          {t.upcoming && <Badge>{t.upcoming}</Badge>}
        </div>
        {!t.done && t.text && <span className="muted small">{t.text}</span>}
        {!t.done && t.cta && <Link className="small" to={t.cta.to} style={{ fontWeight: 500, marginTop: 4 }}>{t.cta.label} →</Link>}
      </div>
    </div>
  );
}

function ProjectView({ projectId: pid, setProjectId: setPid }: { projectId: string; setProjectId: (id: string) => void }) {
  const { state, patchProject, toggleTask, say } = useStore();
  const [tab, setTab] = useState<'jetzt' | 'auswertung'>('jetzt');
  const st = useProjectStatus(pid);

  const monthly = useMemo(
    () => (st.ready ? monthlyStats(st.project, st.res, st.plan.draft.sellCertificates, st.month) : []),
    [st.ready, st.project, st.res, st.plan, st.month],
  );
  const yields = useMemo(() => (st.ready ? yieldByYear(st.project, st.res, st.month) : []), [st.ready, st.project, st.res, st.month]);

  if (!st.ready)
    return (
      <div className="page">
        <PageHeader title="Betrieb" />
        <Empty icon={<AlertTriangle size={36} />} title="Plan oder Flächen nicht mehr vorhanden">Dieses Projekt basiert auf einem gelöschten Plan.</Empty>
      </div>
    );

  const { project: pr, res, sim, month, date, phase, todos } = st;

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
  const beforeBuild = month <= BUILD_END_MONTH;
  const wlTone = !sim.afterBuild ? undefined : Math.abs(sim.wlNow - res.targetWl) <= 10 ? 'good' : Math.abs(sim.wlNow - res.targetWl) <= 20 ? 'warn' : 'bad';

  const exportCsv = () => {
    const rows = ['Datum;Wasserstand_cm_unter_Flur;Niederschlag_mm;Zielwert_cm', ...sim.days.map((d) => `${d.date.toISOString().slice(0, 10)};${d.wl.toFixed(1).replace('.', ',')};${d.rain.toFixed(1).replace('.', ',')};${res.targetWl}`)];
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
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

  const openCount = todos.filter((t) => t.taskId && !t.done).length;
  const otherPhases = PHASES.filter((p) => p.id !== phase.id);

  return (
    <div className="page">
      <PageHeader
        title="Betrieb"
        sub={<>{pr.name} · {nf(res.moorHa, 1)} ha · <CropIcon name={res.crop.id} size={15} className="icon-inline" />{res.crop.name} · Start {fdate(pr.startDate)}</>}
        actions={
          <>
            {state.projects.length > 1 && (
              <select value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Projekt wählen">
                {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button className="btn" onClick={exportCsv}><Download size={15} /> Wasserstandsprotokoll</button>
          </>
        }
      />

      {/* Projektphase */}
      <section className="card stack" style={{ gap: 16, marginBottom: 24 }} aria-label="Projektphase">
        <div className="row between wrap gap">
          <div>
            <h2 className="section-title">{phase.label}</h2>
            <span className="muted small">Projektmonat {month} · {date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
        <ol className="phase-track">
          {PHASES.map((p, i) => {
            const next = PHASES[i + 1]?.startMonth;
            const isDone = next !== undefined && month >= next;
            const isCur = p.id === phase.id;
            const pct = isCur && next !== undefined ? Math.max(8, Math.round(((month - p.startMonth) / (next - p.startMonth)) * 100)) : isCur ? 100 : 0;
            return (
              <li key={p.id} className={isDone ? 'done' : isCur ? 'cur' : ''} aria-current={isCur ? 'step' : undefined}>
                <span className="phase-bar">{isCur && <span style={{ width: `${pct}%` }} />}</span>
                <span className="phase-name">{isDone && <Check size={14} strokeWidth={2.5} className="text-gruen" />}{p.short}</span>
                <span className="phase-sub">{next !== undefined ? `Monat ${p.startMonth}–${next - 1}` : `ab Monat ${p.startMonth}`}</span>
              </li>
            );
          })}
        </ol>
        <details className="demo-box">
          <summary>Demo: Projektverlauf im Zeitraffer</summary>
          <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            <input type="range" min={0} max={96} value={month} onChange={(e) => patchProject(pr.id, { simMonth: Number(e.target.value) })} aria-label="Projektmonat" />
            <div className="row gap-s wrap">
              <button className="btn small" onClick={() => patchProject(pr.id, { simMonth: Math.min(96, month + 1) })}>+1 Monat</button>
              <button className="btn small" onClick={() => patchProject(pr.id, { simMonth: Math.min(96, month + 6) })}>+6 Monate</button>
              <button className="btn small ghost" onClick={() => patchProject(pr.id, { simMonth: 0 })}><RotateCcw size={14} /> Zum Start</button>
            </div>
          </div>
        </details>
      </section>

      <Tabs value={tab} onChange={setTab} items={[
        { id: 'jetzt', label: openCount ? `Jetzt · ${openCount} offen` : 'Jetzt' },
        { id: 'auswertung', label: 'Auswertungen' },
      ]} />

      {tab === 'jetzt' && (
        <>
          <div className="kpi-grid">
            <Kpi label="Wasserstand" value={`${nf(sim.wlNow, 0)} cm`} hint={beforeBuild ? `vor dem Bau · Ziel ${res.targetWl} cm unter Flur` : `unter Flur · Ziel ${res.targetWl} cm`} tone={wlTone} />
            <Kpi label="Im Zielkorridor (30 Tage)" value={sim.afterBuild ? `${nf(sim.inBand * 100)} %` : '–'} hint="Tage innerhalb ±10 cm" tone={sim.afterBuild ? (sim.inBand > 0.8 ? 'good' : sim.inBand > 0.5 ? 'warn' : 'bad') : undefined} />
            <Kpi label="THG eingespart bisher" value={`${nf(cumT[cumT.length - 1] ?? 0)} t`} hint="CO₂-Äquivalente aus Pegeldaten" tone="good" />
          </div>

          <div className="grid-2-1">
            <div className="stack">
              <section className="card">
                <h3>Wasserstand der letzten 12 Monate</h3>
                <LineChart
                  labels={wlLabels} xTickEvery={45} invertY unit=" cm"
                  band={{ lo: res.targetWl - 10, hi: res.targetWl + 10, color: '#2e6a3b', label: 'Zielkorridor' }}
                  series={[
                    { name: 'Wasserstand', color: '#1d5e78', data: sim.days.map((d) => Math.round(d.wl * 10) / 10) },
                    { name: 'Ziel', color: '#2e6a3b', dashed: true, data: sim.days.map(() => res.targetWl) },
                  ]}
                />
                <p className="muted small">cm unter Flur, oben = nass.</p>
              </section>
              <section className="card">
                <h3>Pegel</h3>
                <table className="table compact">
                  <thead><tr><th>Messstelle</th><th className="num">Stand</th><th className="num">Akku</th></tr></thead>
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
            </div>

            <section className="card stack" style={{ gap: 4 }} aria-labelledby="todo-h">
              <h3 id="todo-h" style={{ marginBottom: 8 }}>Zu tun</h3>
              {todos.length === 0 && <p className="muted">Aktuell ist nichts zu tun.</p>}
              {todos.map((t) => (
                <TodoItem key={t.id} t={t} onToggle={() => t.taskId && toggleTask(pr.id, t.taskId)} />
              ))}
              <details style={{ marginTop: 8 }}>
                <summary className="small" style={{ fontWeight: 500 }}>Aufgaben anderer Phasen</summary>
                {otherPhases.map((ph) => {
                  const tasks = TASKS.filter((t) => t.phase === ph.id);
                  return (
                    <div key={ph.id} style={{ marginTop: 10 }}>
                      <div className="muted small" style={{ fontWeight: 600 }}>{ph.label}</div>
                      {tasks.map((t) => (
                        <label key={t.id} className="check task">
                          <input type="checkbox" checked={!!pr.tasks[t.id]} onChange={() => toggleTask(pr.id, t.id)} /> {t.label}
                        </label>
                      ))}
                    </div>
                  );
                })}
              </details>
            </section>
          </div>
        </>
      )}

      {tab === 'auswertung' && (
        <>
          <div className="kpi-grid">
            <Kpi label="Erlöse bisher" value={eur(sumRev)} hint="Ernte und Zertifikate" />
            <Kpi label="Förderungen erhalten" value={eur(sumGrants)} hint="Zuschüsse und Prämien" tone="good" />
            <Kpi label="Saldo bisher" value={eur(sumRev + sumGrants - sumCost)} hint={`Kosten ${eur(sumCost)}`} tone={sumRev + sumGrants - sumCost >= 0 ? 'good' : 'bad'} />
          </div>
          <div className="grid-2">
            <section className="card">
              <h3>THG-Einsparung (kumuliert)</h3>
              <LineChart
                labels={mLabels} unit=" t"
                series={[
                  { name: 'Erreicht', color: '#2e6a3b', area: true, data: cumT.map((v) => Math.round(v)) },
                  { name: 'Plan (volle Wirkung)', color: '#8a5300', dashed: true, data: monthly.map((m, i) => Math.round(Math.max(0, i - BUILD_END_MONTH) * planAvoidPerMonth)) },
                ]}
                yFormat={(v) => nf(v)}
              />
            </section>
            <section className="card">
              <h3>Cashflow (kumuliert)</h3>
              <LineChart labels={mLabels} unit=" €" zeroLine series={[{ name: 'Saldo', color: '#1d5e78', area: true, data: cumNet.map((v) => Math.round(v)) }]} yFormat={(v) => `${nf(v / 1000)}k`} />
            </section>
            <section className="card">
              <h3>Erlöse Plan vs. Ist</h3>
              <BarChart
                labels={yields.map((y) => `Jahr ${y.year}`)}
                series={[
                  { name: 'Plan', color: '#c3cbc5', data: yields.map((y) => Math.round(y.planned)) },
                  { name: 'Ist', color: '#2e6a3b', data: yields.map((y) => (y.actual == null ? null : Math.round(y.actual))) },
                ]}
                yFormat={(v) => `${nf(v / 1000)}k`}
              />
            </section>
            <section className="card">
              <h3>Niederschlag (Monat)</h3>
              <BarChart labels={lastYear.map((_, i) => mLabels[mLabels.length - lastYear.length + i])} series={[{ name: 'mm', color: '#7db4cb', data: lastYear.map((m) => Math.round(m.rain)) }]} yFormat={(v) => nf(v)} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
