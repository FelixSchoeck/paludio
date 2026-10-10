import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { applicationStage, useNow, useStore } from '../lib/store';
import { analyze } from '../lib/calc';
import { cropById } from '../lib/crops';
import { useProjectStatus, type Todo } from '../lib/project';
import { eur, nf } from '../components/ui';
import {
  Leaf,
  ChartLine,
  Euro,
  Sparkles,
  Check,
  ArrowRight,
  AlertTriangle,
  Info,
  CheckCircle2,
  Droplet,
} from '../components/Icons';

type StepState = 'done' | 'cur' | 'todo';

function levelTile(t: Todo) {
  if (t.level === 'kritisch') return <span className="icon-tile bad"><AlertTriangle size={16} /></span>;
  if (t.level === 'wichtig') return <span className="icon-tile warn"><AlertTriangle size={16} /></span>;
  if (t.level === 'positiv') return <span className="icon-tile"><CheckCircle2 size={16} /></span>;
  if (t.taskId) return <span className="icon-tile water"><Droplet size={16} /></span>;
  return <span className="icon-tile water"><Info size={16} /></span>;
}

export default function Dashboard() {
  const { state, loadBwDemo } = useStore();
  const now = useNow(5000);
  const status = useProjectStatus();

  // Kennzahlen: aus dem laufenden Projekt, sonst aus dem aktuellen Planentwurf
  const draftParcels = useMemo(() => {
    const sel = state.myParcels.filter((p) => state.draft.parcelIds.includes(p.id));
    return sel.length ? sel : state.myParcels;
  }, [state.myParcels, state.draft.parcelIds]);
  const draftRes = useMemo(
    () => (draftParcels.length ? analyze(draftParcels, state.draft) : null),
    [draftParcels, state.draft],
  );
  const res = status.res ?? draftRes;

  const farm = state.farm;
  const totalHa = state.myParcels.reduce((a, p) => a + p.areaHa, 0);
  const hasParcels = state.myParcels.length > 0;
  const hasPlan = state.plans.length > 0 || !!status.project;
  const submitted = state.applications.filter((a) => a.status === 'eingereicht' || a.status === 'bewilligt');
  const drafts = state.applications.filter((a) => a.status === 'entwurf');
  const project = status.ready ? status : null;

  // Ihr Weg: vier Schritte vom Flächenerfassen bis zum Betrieb
  const steps: { label: string; cta: string; to: string; detail: ReactNode; state: StepState }[] = [];
  const pushStep = (label: string, cta: string, to: string, done: boolean, detail: ReactNode) => {
    const firstOpen = steps.every((s) => s.state === 'done');
    steps.push({ label, cta, to, detail, state: done ? 'done' : firstOpen ? 'cur' : 'todo' });
  };
  pushStep('Flächen erfassen', 'Flächen wählen', '/karte', hasParcels,
    hasParcels ? `${state.myParcels.length} ${state.myParcels.length === 1 ? 'Flurstück' : 'Flurstücke'} · ${nf(totalHa, 1)} ha` : 'Flurstücke auf der Karte wählen');
  const planCrop = cropById(status.plan?.draft.cropId ?? state.plans[0]?.draft.cropId ?? '');
  pushStep('Nutzung planen', 'Szenario berechnen', '/planer', hasPlan,
    hasPlan && planCrop ? `${planCrop.name}${res ? ` · Kapitalwert ${eur(res.kpis.npv)}` : ''}` : 'Kultur und Wirtschaftlichkeit berechnen');
  pushStep('Förderung beantragen', 'Förderung beantragen', '/foerderung', submitted.length > 0,
    submitted.length > 0
      ? `${submitted.length} ${submitted.length === 1 ? 'Antrag' : 'Anträge'} · ${applicationStage(submitted[0], now).label}`
      : res?.hasMoor ? `bis ${eur(res.funding.oneTime)} möglich` : 'Programme passend zum Plan');
  pushStep('Umsetzen & betreiben', 'Zum Betrieb', '/betrieb', !!project && project.phase.id === 'betrieb',
    project ? `${project.phase.label} · Monat ${project.month}` : 'Projekt im Planer starten');

  // Als Nächstes: offene Punkte aus dem Projekt, sonst der nächste Schritt des Weges
  const openTodos: Todo[] = project ? project.todos.filter((t) => !t.done).slice(0, 3) : [];
  const upcomingPhase = openTodos.find((t) => t.upcoming)?.upcoming;
  const todoNote = upcomingPhase && openTodos.every((t) => t.upcoming || !t.taskId)
    ? `Die aktuelle Phase ist erledigt. Als Nächstes: ${upcomingPhase}` : null;
  const nextStep = steps.find((s) => s.state === 'cur');

  const meta = [farm.owner, farm.locationName, totalHa > 0 ? `${nf(totalHa, 1)} ha` : null].filter(Boolean) as string[];

  return (
    <div className="page">
      <section className="cockpit-head">
        <div className="stack" style={{ gap: 6, flex: '1 1 420px' }}>
          <h1 style={{ margin: 0 }}>{farm.name || 'Willkommen bei Paludio'}</h1>
          {meta.length > 0 && <div className="cockpit-meta">{meta.map((m) => <span key={m}>{m}</span>)}</div>}
        </div>
        {nextStep && (
          <Link className="btn primary" to={nextStep.to}>{nextStep.cta} <ArrowRight size={16} /></Link>
        )}
      </section>

      {res?.hasMoor && (
        <section className="kpi-grid" aria-label="Kennzahlen">
          <div className="kpi good">
            <span className="kpi-label"><Leaf size={16} /> THG-Minderung</span>
            <span className="kpi-value">−{nf(res.emissions.avoidedT, 0)} <span className="kpi-unit">t CO₂e/a</span></span>
            <span className="kpi-hint">auf {nf(res.moorHa, 1)} ha Moor</span>
          </div>
          <div className="kpi">
            <span className="kpi-label"><ChartLine size={16} /> Kapitalwert</span>
            <span className="kpi-value">
              {Math.abs(res.kpis.npv) >= 1e6 ? <>{nf(res.kpis.npv / 1e6, 2)} <span className="kpi-unit">Mio. €</span></> : eur(res.kpis.npv)}
            </span>
            <span className="kpi-hint">{res.kpis.payback != null ? `Amortisation nach ${nf(res.kpis.payback, 1)} Jahren` : 'keine Amortisation im Zeitraum'}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label"><Euro size={16} /> Förderung</span>
            <span className="kpi-value">{eur(res.funding.oneTime)}</span>
            <span className="kpi-hint">+ {eur(res.funding.annual)} pro Jahr</span>
          </div>
        </section>
      )}

      <div className="row wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
        {/* Als Nächstes */}
        <section className="card stack" aria-labelledby="next-h" style={{ flex: '999 1 480px', minWidth: 0, gap: 16 }}>
          <div>
            <h2 id="next-h" className="section-title">Als Nächstes</h2>
            {todoNote && <span className="muted small">{todoNote}</span>}
          </div>

          {!hasParcels && (
            <div className="todo">
              <span className="icon-tile water"><Info size={16} /></span>
              <div className="todo-text">
                <b style={{ fontWeight: 600 }}>Flächen auswählen</b>
                <span className="muted small">Wählen Sie Ihre Flurstücke auf der Karte oder laden Sie den Musterbetrieb, um alle Funktionen auszuprobieren.</span>
                <div className="row gap-s wrap" style={{ marginTop: 8 }}>
                  <Link className="btn small primary" to="/karte">Zur Karte</Link>
                  <button className="btn small" onClick={loadBwDemo}><Sparkles size={14} /> Musterbetrieb laden</button>
                </div>
              </div>
            </div>
          )}

          {hasParcels && !project && nextStep && (
            <div className="todo">
              <span className="icon-tile"><ArrowRight size={16} /></span>
              <div className="todo-text">
                <b style={{ fontWeight: 600 }}>{nextStep.label}</b>
                <span className="muted small">{nextStep.detail}</span>
                <div style={{ marginTop: 8 }}><Link className="btn small primary" to={nextStep.to}>Weiter</Link></div>
              </div>
            </div>
          )}

          {drafts.map((a) => (
            <div key={a.id} className="todo">
              <span className="icon-tile warn"><Euro size={16} /></span>
              <div className="todo-text">
                <b style={{ fontWeight: 600 }}>Förderantrag fertigstellen</b>
                <span className="muted small">{a.programName}</span>
                <div style={{ marginTop: 6 }}><Link className="small" to="/foerderung" style={{ fontWeight: 500 }}>Antrag öffnen →</Link></div>
              </div>
            </div>
          ))}

          {openTodos.map((t) => (
            <div key={t.id} className="todo">
              {levelTile(t)}
              <div className="todo-text">
                <b style={{ fontWeight: 600 }}>{t.title}</b>
                {t.text && <span className="muted small clamp-2">{t.text}</span>}
                {t.cta && <div style={{ marginTop: 6 }}><Link className="small" to={t.cta.to} style={{ fontWeight: 500 }}>{t.cta.label} →</Link></div>}
              </div>
            </div>
          ))}

          {project && openTodos.length === 0 && drafts.length === 0 && (
            <div className="todo">
              <span className="icon-tile"><Check size={16} /></span>
              <div className="todo-text">
                <b style={{ fontWeight: 600 }}>Alles erledigt</b>
                <span className="muted small">In der aktuellen Phase ist nichts offen.</span>
              </div>
            </div>
          )}

          {project && (
            <Link to="/betrieb" className="small" style={{ fontWeight: 500 }}>Alle Aufgaben im Betrieb →</Link>
          )}
        </section>

        {/* Ihr Weg */}
        <section className="card" aria-labelledby="weg-h" style={{ flex: '1 1 300px', minWidth: 0 }}>
          <h2 id="weg-h" className="section-title" style={{ marginBottom: 12 }}>Ihr Weg</h2>
          <ol className="journey">
            {steps.map((s, i) => (
              <li key={s.label} className={s.state} aria-current={s.state === 'cur' ? 'step' : undefined}>
                <Link to={s.to}>
                  <span className="journey-dot">{s.state === 'done' ? <Check size={14} strokeWidth={2.5} /> : i + 1}</span>
                  <span className="journey-text">
                    <span className="journey-label">{s.label}</span>
                    <span className="journey-detail">{s.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
