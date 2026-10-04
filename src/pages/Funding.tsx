import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationStage, uid, useNow, useStore } from '../lib/store';
import { analyze } from '../lib/calc';
import { BUNDESLAENDER } from '../lib/geo';
import { programById, type FundingMatch, type FundingProgram } from '../lib/funding';
import type { Application } from '../lib/types';
import { Badge, Empty, Field, Kpi, Modal, PageHeader, Tabs, eur, fdate, nf } from '../components/ui';
import { Euro, FileText, CheckCircle2, Square, Check } from '../components/Icons';

const statusTone = { passt: 'gruen', teilweise: 'gelb', nicht: 'grau' } as const;
const statusLabel = { passt: 'Passt', teilweise: 'Teilweise', nicht: 'Nicht passend' } as const;
const kindLabel: Record<FundingProgram['kind'], string> = {
  investition: 'Investitionszuschuss', flaeche: 'Flächenprämie', kredit: 'Zinsgünstiges Darlehen', beratung: 'Beratung', info: 'Information / Auflage',
};

function daysLeft(deadline: string): number | null {
  if (deadline === 'laufend') return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

export default function Funding() {
  const { state, upsertApplication, deleteApplication, setFarm, say } = useStore();
  const now = useNow(1000);
  const [tab, setTab] = useState<'passend' | 'alle' | 'antraege'>('passend');
  const [provider, setProvider] = useState('alle');
  const [wizard, setWizard] = useState<{ app: Application; step: number } | null>(null);

  const parcels = useMemo(() => {
    const sel = state.myParcels.filter((p) => state.draft.parcelIds.includes(p.id));
    return sel.length ? sel : state.myParcels;
  }, [state.myParcels, state.draft.parcelIds]);
  const res = useMemo(() => analyze(parcels, state.draft), [parcels, state.draft]);
  const matches = res.funding.matches;
  const shown = matches.filter((m) => (tab === 'passend' ? m.status !== 'nicht' : true) && (provider === 'alle' || m.program.provider === provider));

  const startApplication = (m: FundingMatch) => {
    const moorIds = parcels.filter((p) => p.moorType !== 'mineral').map((p) => p.id);
    const app: Application = {
      id: uid('app'),
      programId: m.program.id,
      programName: m.program.name,
      parcelIds: moorIds,
      createdAt: new Date().toISOString(),
      status: 'entwurf',
      amountRequested: Math.round(m.oneTime + m.annual * (m.years || 0)),
      data: {
        measure: `${res.crop.name}: Wiedervernässung auf ${nf(res.moorHa, 1)} ha mit Zielwasserstand ${res.targetWl} cm unter Flur`,
        totalCost: Math.round(res.capex.total),
        startDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
        note: '',
        docs: Object.fromEntries(m.program.docs.map((d) => [d, d.includes('automatisch')])),
        confirmed: false,
      },
    };
    upsertApplication(app);
    setWizard({ app, step: 1 });
  };

  return (
    <div className="page">
      <PageHeader title="Förderungen" sub="Programme von EU, Bund, Ländern und Banken – automatisch auf Ihre Flächen und Ihren Plan abgestimmt." />

      <div className="note">
        <b>Hinweis:</b> Der Förderkatalog im Prototyp ist illustrativ. Fördersätze, Fristen und Stellen sind vor einem echten Antrag bei der zuständigen Behörde zu verifizieren.
      </div>

      {res.hasMoor ? (
        <div className="kpi-grid">
          <Kpi label="Berechnet für" value={`${nf(res.moorHa, 1)} ha Moor`} hint={`${res.crop.name} · ${[...new Set(parcels.map((p) => BUNDESLAENDER[p.bundesland].name))].join(', ')}`} />
          <Kpi label="Einmalige Förderung" value={eur(res.funding.oneTime)} hint={`${nf(res.kpis.grantShare * 100)} % der Investition`} tone="good" />
          <Kpi label="Jährliche Prämien" value={eur(res.funding.annual)} hint={res.funding.annualYears ? `über ${res.funding.annualYears} Jahre` : 'keine'} tone="good" />
          <Kpi label="Passende Programme" value={String(matches.filter((m) => m.status !== 'nicht' && m.program.kind !== 'info').length)} hint="inkl. teilweise passender" />
        </div>
      ) : (
        <div className="note warn">
          Ohne ausgewählte Moorflächen können Förderungen nicht zugeschnitten werden. <Link to="/karte"><b>Flächen auf der Karte wählen →</b></Link>
        </div>
      )}

      <div className="row between wrap">
        <Tabs value={tab} onChange={setTab} items={[
          { id: 'passend', label: 'Passende Förderungen' },
          { id: 'alle', label: `Alle Programme (${matches.length})` },
          { id: 'antraege', label: `Meine Anträge (${state.applications.length})` },
        ]} />
        {tab !== 'antraege' && (
          <select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Fördergeber filtern">
            <option value="alle">Alle Fördergeber</option><option value="EU">EU</option><option value="Bund">Bund</option><option value="Land">Land</option><option value="Bank">Bank</option>
          </select>
        )}
      </div>

      {tab !== 'antraege' && (
        <div className="stack">
          {shown.length === 0 && <Empty icon={<Euro size={36} />} title="Keine Programme gefunden">Passen Sie Ihre Flächen oder den Plan an.</Empty>}
          {shown.map((m) => {
            const p = m.program;
            const dl = daysLeft(p.deadline);
            const existing = state.applications.find((a) => a.programId === p.id);
            return (
              <article key={p.id} className="card fund-card">
                <div className="row between wrap">
                  <div className="row gap wrap">
                    <Badge tone={statusTone[m.status]}>{statusLabel[m.status]}</Badge>
                    <Badge tone="blau">{p.provider}{p.states !== 'ALL' ? ` · ${p.states.map((s) => s).join('/')}` : ''}</Badge>
                    <Badge>{kindLabel[p.kind]}</Badge>
                  </div>
                  <div className="row gap-s">
                    {dl !== null ? <Badge tone={dl < 30 ? 'rot' : dl < 90 ? 'gelb' : 'grau'}>Frist {fdate(p.deadline)} ({dl > 0 ? `in ${dl} Tagen` : 'abgelaufen'})</Badge> : <Badge tone="gruen">laufende Antragstellung</Badge>}
                  </div>
                </div>
                <h3>{p.name}</h3>
                <p>{p.summary}</p>
                <div className="fund-meta">
                  <div><span className="muted small">Stelle</span><br />{p.authority}</div>
                  <div><span className="muted small">Aufwand</span><br />{p.effort}</div>
                  {m.status !== 'nicht' && (m.oneTime > 0 || m.annual > 0) && (
                    <div><span className="muted small">Für Ihren Plan</span><br />
                      {m.oneTime > 0 && <b>{eur(m.oneTime)} einmalig</b>}{m.oneTime > 0 && m.annual > 0 && ' + '}
                      {m.annual > 0 && <b>{eur(m.annual)}/Jahr × {m.years}</b>}
                    </div>
                  )}
                </div>
                <ul className="reasons">{m.reasons.map((r) => <li key={r} className={m.status === 'passt' ? 'ok' : m.status === 'teilweise' ? 'warn' : 'no'}>{r}</li>)}</ul>
                {p.kind !== 'info' && m.status !== 'nicht' && (
                  <div className="row gap">
                    {existing ? (
                      <button className="btn" onClick={() => { setTab('antraege'); }}>Antrag ansehen ({applicationStage(existing, now).label})</button>
                    ) : (
                      <button className="btn primary" onClick={() => startApplication(m)}>Antrag vorbereiten</button>
                    )}
                    <span className="muted small">{p.docs.length} Nachweise · Daten aus Plan & Flächen vorausgefüllt</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {tab === 'antraege' && (
        <div className="stack">
          {state.applications.length === 0 && <Empty icon={<FileText size={36} />} title="Noch keine Anträge">Starten Sie einen Antrag bei einem passenden Programm – Flächendaten und Plan werden automatisch übernommen.</Empty>}
          {state.applications.map((a) => {
            const st = applicationStage(a, now);
            const steps = ['Entwurf', 'Eingegangen', 'In Prüfung', 'Bewilligt'];
            return (
              <article key={a.id} className="card">
                <div className="row between wrap">
                  <div>
                    <h3>{a.programName}</h3>
                    <div className="muted small">{a.parcelIds.length} Flurstück(e) · erstellt {fdate(a.createdAt)}{a.submittedAt && ` · eingereicht ${fdate(a.submittedAt)}`}</div>
                  </div>
                  <Badge tone={st.tone === 'grau' ? 'grau' : st.tone === 'blau' ? 'blau' : st.tone === 'gelb' ? 'gelb' : 'gruen'}>{st.label}</Badge>
                </div>
                <div className="stepper">
                  {steps.map((s, i) => <div key={s} className={`s ${i <= st.step ? 'done' : ''}`}><i>{i <= st.step ? <Check size={12} /> : i + 1}</i><span>{s}</span></div>)}
                </div>
                <div className="row gap wrap">
                  {a.amountRequested > 0 && <Badge tone="blau">Beantragt: {eur(a.amountRequested)}</Badge>}
                  {st.step === 3 && <Badge tone="gruen">Bescheid liegt vor (Demo)</Badge>}
                  <div className="grow" />
                  {a.status === 'entwurf' && <button className="btn primary small" onClick={() => setWizard({ app: a, step: 1 })}>Fortsetzen</button>}
                  {a.status === 'entwurf' && <button className="btn ghost small" onClick={() => deleteApplication(a.id)}>Verwerfen</button>}
                  {st.step === 3 && <button className="btn small" onClick={() => say('Im Prototyp wird kein echter Bescheid erzeugt')}>Bescheid öffnen</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {wizard && (
        <Wizard
          app={wizard.app} step={wizard.step}
          onStep={(s) => setWizard((w) => w && { ...w, step: s })}
          onChange={(a) => { setWizard((w) => w && { ...w, app: a }); upsertApplication(a); }}
          onClose={() => setWizard(null)}
          parcelOptions={parcels.filter((p) => p.moorType !== 'mineral')}
          farm={state.farm} setFarm={setFarm}
          onSubmit={(a) => {
            upsertApplication({ ...a, status: 'eingereicht', submittedAt: new Date().toISOString() });
            setWizard(null);
            setTab('antraege');
            say('Antrag eingereicht – Bearbeitungsstatus wird im Prototyp beschleunigt simuliert');
          }}
        />
      )}
    </div>
  );
}

function Wizard({
  app, step, onStep, onChange, onClose, onSubmit, parcelOptions, farm, setFarm,
}: {
  app: Application; step: number; onStep: (s: number) => void; onChange: (a: Application) => void; onClose: () => void; onSubmit: (a: Application) => void;
  parcelOptions: { id: string; label: string; areaHa: number; gemarkung: string }[];
  farm: ReturnType<typeof useStore>['state']['farm']; setFarm: (p: Partial<typeof farm>) => void;
}) {
  const program = programById(app.programId);
  const steps = ['Flächen', 'Antragsteller', 'Vorhaben', 'Nachweise', 'Prüfen & Senden'];
  const docs = Object.keys(app.data.docs);
  const set = (patch: Partial<Application['data']>) => onChange({ ...app, data: { ...app.data, ...patch } });

  const errors: string[] = [];
  if (!app.parcelIds.length) errors.push('Mindestens ein Flurstück auswählen');
  if (!farm.name || !farm.owner) errors.push('Betriebsname und Antragsteller angeben');
  if (!farm.betriebsnummer) errors.push('Betriebsnummer angeben');
  if (!farm.iban) errors.push('IBAN für die Auszahlung angeben');
  if (!app.data.measure.trim()) errors.push('Maßnahme beschreiben');
  if (!(app.data.totalCost > 0)) errors.push('Gesamtkosten angeben');
  const missingDocs = docs.filter((d) => !app.data.docs[d]);
  if (missingDocs.length) errors.push(`${missingDocs.length} Nachweis(e) fehlen`);
  if (!app.data.confirmed) errors.push('Richtigkeit der Angaben bestätigen');

  const areaHa = parcelOptions.filter((p) => app.parcelIds.includes(p.id)).reduce((a, p) => a + p.areaHa, 0);

  return (
    <Modal
      wide title={`Antrag: ${app.programName}`} onClose={onClose}
      footer={
        <div className="row between grow">
          <button className="btn ghost" onClick={() => (step > 1 ? onStep(step - 1) : onClose())}>{step > 1 ? '← Zurück' : 'Als Entwurf speichern'}</button>
          {step < 5 ? (
            <button className="btn primary" onClick={() => onStep(step + 1)}>Weiter →</button>
          ) : (
            <button className="btn primary" disabled={errors.length > 0} onClick={() => onSubmit(app)}>Verbindlich einreichen (Demo)</button>
          )}
        </div>
      }
    >
      <div className="stepper small">
        {steps.map((s, i) => <button key={s} className={`s ${i + 1 <= step ? 'done' : ''} ${i + 1 === step ? 'cur' : ''}`} onClick={() => onStep(i + 1)}><i>{i + 1 < step ? <Check size={12} /> : i + 1}</i><span>{s}</span></button>)}
      </div>

      {step === 1 && (
        <div className="stack">
          <p className="muted">{program?.summary}</p>
          <h4>Beantragte Flurstücke</h4>
          {parcelOptions.map((p) => (
            <label key={p.id} className="check box">
              <input type="checkbox" checked={app.parcelIds.includes(p.id)} onChange={(e) => onChange({ ...app, parcelIds: e.target.checked ? [...app.parcelIds, p.id] : app.parcelIds.filter((x) => x !== p.id) })} />
              <b>{p.label}</b> <span className="muted">{p.gemarkung} · {nf(p.areaHa, 2)} ha</span>
            </label>
          ))}
          <div className="note">Gesamtfläche des Antrags: <b>{nf(areaHa, 2)} ha</b></div>
        </div>
      )}

      {step === 2 && (
        <div className="form-grid">
          <Field label="Betriebsname"><input value={farm.name} onChange={(e) => setFarm({ name: e.target.value })} /></Field>
          <Field label="Antragsteller/in"><input value={farm.owner} onChange={(e) => setFarm({ owner: e.target.value })} /></Field>
          <Field label="Betriebsnummer / Registriernummer"><input value={farm.betriebsnummer} onChange={(e) => setFarm({ betriebsnummer: e.target.value })} /></Field>
          <Field label="Rechtsform">
            <select value={farm.legalForm} onChange={(e) => setFarm({ legalForm: e.target.value })}>
              <option>Einzelunternehmen</option><option>GbR</option><option>GmbH & Co. KG</option><option>GmbH</option><option>eG</option>
            </select>
          </Field>
          <Field label="E-Mail"><input type="email" value={farm.email} onChange={(e) => setFarm({ email: e.target.value })} /></Field>
          <Field label="Telefon"><input value={farm.phone} onChange={(e) => setFarm({ phone: e.target.value })} /></Field>
          <Field label="IBAN (Auszahlung)"><input value={farm.iban} onChange={(e) => setFarm({ iban: e.target.value })} /></Field>
        </div>
      )}

      {step === 3 && (
        <div className="form-grid">
          <Field label="Beschreibung der Maßnahme"><textarea rows={3} value={app.data.measure} onChange={(e) => set({ measure: e.target.value })} /></Field>
          <Field label="Gesamtkosten (€)" hint="aus dem Plan übernommen"><input type="number" value={app.data.totalCost} onChange={(e) => set({ totalCost: Number(e.target.value) })} /></Field>
          <Field label="Geplanter Maßnahmenbeginn"><input type="date" value={app.data.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
          <Field label="Beantragter Betrag (€)" hint="Einmalzuschuss + Prämien über die Laufzeit"><input type="number" value={app.amountRequested} onChange={(e) => onChange({ ...app, amountRequested: Number(e.target.value) })} /></Field>
          <Field label="Anmerkungen"><textarea rows={2} value={app.data.note} onChange={(e) => set({ note: e.target.value })} /></Field>
          <div className="note full">Mit der Maßnahme darf erst nach Bewilligung bzw. nach Genehmigung des vorzeitigen Maßnahmenbeginns begonnen werden.</div>
        </div>
      )}

      {step === 4 && (
        <div className="stack">
          <p className="muted">Automatisch erzeugte Nachweise sind bereits angehängt. Weitere Dokumente können hochgeladen werden (im Prototyp simuliert).</p>
          {docs.map((d) => {
            const auto = d.includes('automatisch');
            return (
              <div key={d} className="row between doc-line">
                <div className="row gap-s">
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {app.data.docs[d] ? <CheckCircle2 size={16} className="text-gruen" /> : <Square size={16} className="text-muted" />}
                  </span>
                  <span>{d}</span>
                </div>
                {auto ? <Badge tone="gruen">automatisch</Badge> : (
                  <button className={`btn small ${app.data.docs[d] ? 'ghost' : ''}`} onClick={() => set({ docs: { ...app.data.docs, [d]: !app.data.docs[d] } })}>
                    {app.data.docs[d] ? 'Entfernen' : 'Datei hochladen'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {step === 5 && (
        <div className="stack">
          <table className="table compact">
            <tbody>
              <tr><td>Programm</td><td>{app.programName}</td></tr>
              <tr><td>Antragsteller</td><td>{farm.owner} · {farm.name}</td></tr>
              <tr><td>Fläche</td><td>{app.parcelIds.length} Flurstück(e), {nf(areaHa, 2)} ha</td></tr>
              <tr><td>Maßnahme</td><td>{app.data.measure}</td></tr>
              <tr><td>Gesamtkosten</td><td>{eur(app.data.totalCost)}</td></tr>
              <tr><td>Beantragt</td><td><b>{eur(app.amountRequested)}</b></td></tr>
              <tr><td>Maßnahmenbeginn</td><td>{fdate(app.data.startDate)}</td></tr>
              <tr><td>Nachweise</td><td>{docs.length - missingDocs.length} von {docs.length} vollständig</td></tr>
            </tbody>
          </table>
          <label className="check box"><input type="checkbox" checked={app.data.confirmed} onChange={(e) => set({ confirmed: e.target.checked })} /> Ich bestätige die Richtigkeit und Vollständigkeit der Angaben.</label>
          {errors.length > 0 && <div className="note warn"><b>Noch offen:</b><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        </div>
      )}
    </Modal>
  );
}
