/**
 * Förderung & Antragsvorbereitung.
 *
 * WICHTIG: Anträge werden ausschließlich lokal vorbereitet (Browser-Speicher) und als Dokument
 * heruntergeladen. Sie dürfen NICHT an eine API oder ein Behördenportal übertragen werden –
 * die Einreichung erfolgt immer durch den Betrieb selbst im Portal der Bewilligungsstelle.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationStage, uid, useStore } from '../lib/store';
import { analyze, BASELINE_DB, type PlanResult } from '../lib/calc';
import { cropById } from '../lib/crops';
import { BUNDESLAENDER } from '../lib/geo';
import { parseKennzeichen } from '../lib/alkis_live';
import {
  DOCS, paluBonusActive, programById, windowStatus,
  type DocId, type FundingMatch, type FundingProgram,
} from '../lib/funding';
import type { Application, Farm, Parcel } from '../lib/types';
import { Badge, Empty, Field, Modal, PageHeader, Tabs, eur, fdate, nf } from '../components/ui';
import { Euro, FileText, CheckCircle2, Square, Check, Download, ArrowRight } from '../components/Icons';

const statusTone = { passt: 'gruen', teilweise: 'gelb', nicht: 'grau' } as const;
const statusLabel = (m: FundingMatch) => {
  if (m.status === 'nicht') return 'Passt nicht';
  if (m.program.kind === 'info') return 'Gilt für Sie';
  if (m.program.kind === 'beratung' || m.program.kind === 'kredit') return 'Verfügbar';
  return m.status === 'passt' ? 'Passt' : 'Passt – Betrag offen';
};
const windowOrder = { offen: 0, demnaechst: 1, laufend: 2, geschlossen: 3 } as const;
const kindLabel: Record<FundingProgram['kind'], string> = {
  investition: 'Zuschuss', ausgleich: 'Ausgleichszahlung', flaeche: 'Flächenprämie', kredit: 'Darlehen', beratung: 'Beratung', info: 'Information',
};
const windowTone = { offen: 'gruen', demnaechst: 'blau', geschlossen: 'grau', laufend: 'grau' } as const;

const isPalu = (id: string) => id.startsWith('palu_');
const canApply = (m: FundingMatch) => m.status !== 'nicht' && ['investition', 'ausgleich', 'flaeche'].includes(m.program.kind);

/* ---------- Berechnung des beantragten Betrags ---------- */

interface RequestCalc {
  lines: { label: string; amount: number }[];
  total: number;
  note?: string;
}

function yearsForParcel(p: Parcel, app: Application): number | null {
  if (p.tenure !== 'pacht') return 7;
  const end = app.data.parcelInfo?.[p.id]?.leaseEnd;
  if (!end) return null;
  const yrs = (new Date(end).getTime() - Date.now()) / (365.25 * 86400000);
  return Math.max(0, Math.min(7, Math.floor(yrs)));
}

function computeRequest(prog: FundingProgram | undefined, app: Application, parcels: Parcel[]): RequestCalc {
  if (!prog) return { lines: [], total: 0 };
  const costs = app.data.costs ?? { planning: 0, waterworks: 0, establishment: 0 };
  if (prog.kind === 'investition' && prog.covers) {
    const stufe1 = (app.data.targetWlCm ?? 99) <= 10;
    const rate = prog.rateStufe1 && stufe1 ? prog.rateStufe1 : prog.rate ?? 0;
    const label = { planning: 'Planung, Gutachten, Genehmigung', waterworks: 'Wasserbau und Pegel', establishment: 'Etablierung der Paludikultur' } as const;
    const lines = prog.covers.map((c) => ({ label: `${label[c]} × ${nf(rate * 100)} %`, amount: costs[c] * rate }));
    return { lines, total: lines.reduce((a, l) => a + l.amount, 0) };
  }
  if (prog.id === 'palu_3b') {
    const factor = paluBonusActive() ? 1.2 : 1;
    let total = 0;
    const lines: RequestCalc['lines'] = [];
    for (const p of parcels) {
      const years = yearsForParcel(p, app);
      const db = BASELINE_DB[p.landUse] * p.areaHa * factor;
      const amount = years == null ? 0 : db * years;
      total += amount;
      lines.push({ label: `${p.label}: ${eur(db)}/Jahr × ${years ?? '?'} Jahre`, amount });
    }
    return { lines, total, note: `Schätzung aus dem Deckungsbeitrag der heutigen Nutzung${factor > 1 ? ' inkl. 20 Prozentpunkte Geschwindigkeitsbonus' : ''}. Maßgeblich ist der Kompensationsrechner der Rentenbank.` };
  }
  if (prog.kind === 'flaeche' && prog.annualPerHa && prog.amountMode !== 'extern') {
    const ha = parcels.reduce((a, p) => a + p.areaHa, 0);
    const years = prog.years ?? 5;
    return { lines: [{ label: `${nf(ha, 2)} ha × ${eur(prog.annualPerHa)} × ${years} Jahre`, amount: ha * prog.annualPerHa * years }], total: ha * prog.annualPerHa * years, note: prog.amountNote };
  }
  return { lines: [], total: 0, note: prog.amountNote ?? 'Der Betrag wird von der Bewilligungsstelle festgesetzt.' };
}

/* ---------- Nachweise & Prüfung ---------- */

function docApplies(id: DocId, parcels: Parcel[]): boolean {
  const anyPacht = parcels.some((p) => p.tenure === 'pacht');
  if (id === 'nutzungsrecht' || id === 'zustimmung') return anyPacht;
  if (id === 'eigentum') return parcels.some((p) => p.tenure !== 'pacht');
  return true;
}

function validate(prog: FundingProgram | undefined, app: Application, parcels: Parcel[], farm: Farm, req: RequestCalc): string[] {
  const e: string[] = [];
  const ha = parcels.reduce((a, p) => a + p.areaHa, 0);
  if (!parcels.length) e.push('Mindestens ein Flurstück auswählen');
  if (prog?.requires.minHa && prog.requires.minHa >= 1 && ha < prog.requires.minHa) e.push(`Mindestens ${prog.requires.minHa} ha Moorfläche nötig (ausgewählt: ${nf(ha, 2)} ha)`);
  if (prog?.requires.maxWlCm !== undefined && (app.data.targetWlCm ?? 99) > prog.requires.maxWlCm) e.push(`Zielwasserstand muss höchstens ${prog.requires.maxWlCm} cm unter Flur liegen`);
  if (!farm.name || !farm.owner) e.push('Betriebsname und Antragsteller/in angeben');
  if (!farm.address?.trim()) e.push('Anschrift des Betriebssitzes angeben');
  if (!farm.betriebsnummer) e.push('Betriebsnummer angeben');
  if (!farm.iban) e.push('IBAN für die Auszahlung angeben');
  if (prog && (prog.id === 'palu_3a' || prog.id === 'palu_3b')) {
    const missing = parcels.filter((p) => !app.data.parcelInfo?.[p.id]?.agriUse5y);
    if (missing.length) e.push(`5 Jahre landwirtschaftliche Nutzung bestätigen (${missing.map((p) => p.label).join(', ')})`);
  }
  if (prog?.id === 'palu_3b') {
    const noEnd = parcels.filter((p) => p.tenure === 'pacht' && !app.data.parcelInfo?.[p.id]?.leaseEnd);
    if (noEnd.length) e.push(`Pachtende angeben (${noEnd.map((p) => p.label).join(', ')})`);
  }
  if (prog?.docs.includes('deminimis') && app.data.declarations?.deminimisEur == null) e.push('De-minimis-Beihilfen der letzten 3 Jahre angeben (0, wenn keine)');
  if (!app.data.measure.trim()) e.push('Maßnahme beschreiben');
  if (prog?.amountMode !== 'extern' && !(req.total > 0)) e.push('Förderfähige Kosten bzw. Betrag fehlen');
  const docs = (prog?.docs ?? []).filter((d) => docApplies(d, parcels));
  const missingDocs = docs.filter((d) => !DOCS[d].auto && !app.data.docs[d]);
  if (missingDocs.length) e.push(`${missingDocs.length} Nachweis(e) fehlen`);
  if (!app.data.declarations?.noDoubleFunding) e.push('Erklärung zur Doppelförderung abgeben');
  if (!app.data.declarations?.notStarted) e.push('Bestätigen, dass die Maßnahme noch nicht begonnen wurde');
  if (!app.data.confirmed) e.push('Richtigkeit der Angaben bestätigen');
  return e;
}

/* ---------- Antragsunterlagen als druckbares Dokument ---------- */

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function buildDocument(prog: FundingProgram | undefined, app: Application, parcels: Parcel[], farm: Farm, req: RequestCalc, res: PlanResult | null): string {
  const docs = (prog?.docs ?? []).filter((d) => docApplies(d, parcels));
  const ha = parcels.reduce((a, p) => a + p.areaHa, 0);
  const wl = app.data.targetWlCm;
  const stufe = wl == null ? '–' : wl <= 10 ? 'Vernässungsstufe 1 (≤ 10 cm)' : wl <= 20 ? 'Vernässungsstufe 2 (≤ 20 cm)' : 'keine (über 20 cm)';
  const decl = app.data.declarations;
  const rows = parcels.map((p) => {
    const k = p.alkis ? parseKennzeichen(p.alkis.flurstueckskennzeichen) : null;
    const info = app.data.parcelInfo?.[p.id];
    return `<tr><td>${esc(p.alkis?.flurstueckskennzeichen ?? p.label)}</td><td>${esc(p.gemarkung)}</td><td>${k && k.flur > 0 ? k.flur : '–'}</td><td>${esc(k ? k.nummer : p.label)}</td><td style="text-align:right">${nf(p.alkis?.amtlicheFlaecheQm ? p.alkis.amtlicheFlaecheQm / 10000 : p.areaHa, 4)} ha</td><td>${p.tenure === 'pacht' ? `Pacht${info?.leaseEnd ? ' bis ' + fdate(info.leaseEnd) : ''}` : 'Eigentum'}</td><td>${info?.agriUse5y ? 'ja' : '–'}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(prog?.name ?? app.programName)} – Antragsunterlagen</title>
<style>body{font:14px/1.5 system-ui,sans-serif;color:#18211c;max-width:900px;margin:32px auto;padding:0 24px}h1{font-size:22px}h2{font-size:16px;margin-top:28px;border-bottom:1px solid #ccc;padding-bottom:4px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f4f5f1}.muted{color:#58635c}@media print{body{margin:0}}</style></head><body>
<h1>${esc(prog?.name ?? app.programName)}</h1>
<p class="muted">Antragsunterlagen erstellt mit Paludio am ${new Date().toLocaleDateString('de-DE')}. Die Einreichung erfolgt im Portal der Bewilligungsstelle: ${esc(prog?.authority ?? '')}${prog?.portal ? ` (${esc(prog.portal)})` : ''}.</p>
<h2>1. Antragsteller/in</h2><table>
<tr><th>Betrieb</th><td>${esc(farm.name)}</td></tr><tr><th>Antragsteller/in</th><td>${esc(farm.owner)}</td></tr><tr><th>Rechtsform</th><td>${esc(farm.legalForm)}</td></tr>
<tr><th>Anschrift</th><td>${esc(farm.address)}</td></tr><tr><th>Betriebsnummer</th><td>${esc(farm.betriebsnummer)}</td></tr><tr><th>E-Mail / Telefon</th><td>${esc(farm.email)} / ${esc(farm.phone)}</td></tr>
<tr><th>IBAN</th><td>${esc(farm.iban)}</td></tr><tr><th>KMU</th><td>${decl?.kmu ? 'ja' : 'nein'}</td></tr><tr><th>De-minimis (3 Jahre)</th><td>${decl?.deminimisEur != null ? eur(decl.deminimisEur) : '–'}</td></tr></table>
<h2>2. Flächen (${parcels.length} Flurstücke, ${nf(ha, 2)} ha)</h2><table><tr><th>Flurstückskennzeichen</th><th>Gemarkung</th><th>Flur</th><th>Flurstück</th><th>Amtliche Fläche</th><th>Nutzungsrecht</th><th>≥ 5 J. landw. genutzt</th></tr>${rows}</table>
<h2>3. Vorhaben</h2><table>
<tr><th>Maßnahme</th><td>${esc(app.data.measure)}</td></tr><tr><th>Künftige Nutzung</th><td>${esc(cropById(app.data.cropId ?? '')?.name ?? '–')}</td></tr>
<tr><th>Zielwasserstand (Jahresmittel)</th><td>${wl ?? '–'} cm unter Flur – ${stufe}</td></tr>
${res ? `<tr><th>THG-Minderung (Abschätzung)</th><td>${nf(res.emissions.avoidedT)} t CO₂e/Jahr (${nf(res.emissions.baselinePerHa, 1)} → ${nf(res.emissions.scenarioPerHa, 1)} t/ha·a, vereinfachtes GEST-Modell)</td></tr>` : ''}
<tr><th>Geplanter Beginn</th><td>${app.data.startDate ? fdate(app.data.startDate) : '–'} (nicht vor Bewilligung bzw. Zulassung des vorzeitigen Beginns)</td></tr>
${app.data.bodenrichtwert ? `<tr><th>Bodenrichtwert</th><td>${nf(app.data.bodenrichtwert, 2)} €/m²</td></tr>` : ''}</table>
<h2>4. Kosten und beantragter Betrag</h2><table>${req.lines.map((l) => `<tr><td>${esc(l.label)}</td><td style="text-align:right">${eur(l.amount)}</td></tr>`).join('')}
<tr><th>Beantragt</th><th style="text-align:right">${prog?.amountMode === 'extern' ? 'wird von der Bewilligungsstelle berechnet' : eur(req.total)}</th></tr></table>${req.note ? `<p class="muted">${esc(req.note)}</p>` : ''}
<h2>5. Nachweise</h2><ul>${docs.map((d) => `<li>${DOCS[d].auto || app.data.docs[d] ? '☑' : '☐'} ${esc(DOCS[d].label)}${DOCS[d].auto ? ' (in diesem Dokument enthalten)' : ''}</li>`).join('')}</ul>
<h2>6. Erklärungen</h2><ul>
<li>${decl?.noDoubleFunding ? '☑' : '☐'} Für dieselbe Maßnahme wurde keine andere öffentliche Förderung beantragt oder bewilligt.</li>
<li>${decl?.notStarted ? '☑' : '☐'} Mit der Maßnahme wurde noch nicht begonnen.</li>
<li>${app.data.confirmed ? '☑' : '☐'} Die Angaben sind richtig und vollständig.</li></ul>
${prog?.obligations.length ? `<h2>7. Pflichten nach Bewilligung</h2><ul>${prog.obligations.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
<p class="muted">Quelle der Förderbedingungen: ${esc(prog?.source.label)} (Stand ${esc(prog?.source.stand)}), ${esc(prog?.source.url)}</p>
</body></html>`;
}

function downloadDocument(name: string, html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 60)}_${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- Seite ---------- */

export default function Funding() {
  const { state, upsertApplication, deleteApplication, setFarm, updateParcel, say } = useStore();
  const [tab, setTab] = useState<'passend' | 'alle' | 'antraege'>('passend');
  const [provider, setProvider] = useState('alle');
  const [wizard, setWizard] = useState<{ appId: string; step: number } | null>(null);

  // Berechnungsgrundlage: Plan des laufenden Projekts, sonst der aktuelle Planentwurf
  const project = state.projects[0];
  const plan = project ? state.plans.find((x) => x.id === project.planId) : undefined;
  const draft = plan?.draft ?? state.draft;
  const parcels = useMemo(() => {
    const sel = state.myParcels.filter((p) => draft.parcelIds.includes(p.id));
    return sel.length ? sel : state.myParcels;
  }, [state.myParcels, draft.parcelIds]);
  const res = useMemo(() => (parcels.length ? analyze(parcels, draft) : null), [parcels, draft]);
  const matches = res?.funding.matches ?? [];
  const shown = matches
    .filter((m) => (tab === 'passend' ? m.status !== 'nicht' : true) && (provider === 'alle' || m.program.provider === provider))
    .map((m, i) => ({ m, i, w: windowOrder[windowStatus(m.program).state], info: m.program.kind === 'info' ? 1 : 0 }))
    .sort((a, b) => (a.m.status === 'nicht' ? 1 : 0) - (b.m.status === 'nicht' ? 1 : 0) || a.info - b.info || a.w - b.w || a.i - b.i)
    .map((x) => x.m);
  const moorParcels = state.myParcels.filter((p) => p.moorType !== 'mineral');

  const startApplication = (m: FundingMatch) => {
    if (!res) return;
    const prog = m.program;
    const appParcels = parcels.filter((p) => p.moorType !== 'mineral');
    const app: Application = {
      id: uid('app'),
      programId: prog.id,
      programName: prog.name,
      parcelIds: appParcels.map((p) => p.id),
      createdAt: new Date().toISOString(),
      status: 'entwurf',
      amountRequested: 0,
      data: {
        measure: `Dauerhafte Wiedervernässung auf ${nf(res.moorHa, 1)} ha Moorboden durch Anstau der Entwässerung, Zielwasserstand ${res.targetWl} cm unter Flur im Jahresmittel; anschließend ${res.crop.name}.`,
        totalCost: Math.round(res.capex.total),
        startDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
        note: '',
        docs: Object.fromEntries(prog.docs.map((d) => [d, DOCS[d].auto])),
        confirmed: false,
        costs: { planning: Math.round(res.capex.planning), waterworks: Math.round(res.capex.waterworks), establishment: Math.round(res.capex.establishment) },
        targetWlCm: res.targetWl,
        cropId: res.crop.id,
        bodenrichtwert: null,
        parcelInfo: {},
        declarations: { noDoubleFunding: false, notStarted: false, kmu: true, deminimisEur: null },
      },
    };
    upsertApplication(app);
    setWizard({ appId: app.id, step: 1 });
  };

  const wizardApp = wizard ? state.applications.find((a) => a.id === wizard.appId) : undefined;

  return (
    <div className="page">
      <PageHeader title="Förderung" sub="Programme von Bund, Ländern und EU, geprüft gegen Ihre Flächen und Ihren Plan. Mit Quelle und Stand." />

      {res?.hasMoor ? (
        <section className="card funding-summary">
          <span className="icon-tile"><Euro size={18} /></span>
          <div>
            <div className="funding-summary-main"><b>{eur(res.funding.oneTime)}</b> Zuschuss <span className="muted">+</span> <b>{eur(res.funding.annual)}</b> pro Jahr</div>
            <div className="muted small">
              {plan ? `Plan „${plan.name}“` : 'Aktueller Planentwurf'} · {res.crop.name} auf {nf(res.moorHa, 1)} ha · {[...new Set(parcels.map((p) => BUNDESLAENDER[p.bundesland].name))].join(', ')} · Zielwasserstand {res.targetWl} cm
            </div>
          </div>
        </section>
      ) : (
        <div className="note warn" style={{ marginBottom: 24 }}>
          Ohne Moorflächen können Förderungen nicht zugeschnitten werden. <Link to="/karte"><b>Flächen wählen →</b></Link>
        </div>
      )}

      <div className="row between wrap">
        <Tabs value={tab} onChange={setTab} items={[
          { id: 'passend', label: `Passend (${matches.filter((m) => m.status !== 'nicht').length})` },
          { id: 'alle', label: `Alle Programme (${matches.length})` },
          { id: 'antraege', label: `Meine Anträge (${state.applications.length})` },
        ]} />
        {tab !== 'antraege' && (
          <select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Fördergeber filtern">
            <option value="alle">Alle Fördergeber</option><option value="Bund">Bund</option><option value="Land">Land</option><option value="EU">EU</option><option value="Bank">Bank</option><option value="Privat">Privat</option>
          </select>
        )}
      </div>

      {tab !== 'antraege' && (
        <div className="stack">
          {shown.length === 0 && <Empty icon={<Euro size={36} />} title="Keine Programme gefunden">Passen Sie Ihre Flächen oder den Plan an.</Empty>}
          {shown.map((m) => {
            const prog = m.program;
            const ws = windowStatus(prog);
            const existing = state.applications.find((a) => a.programId === prog.id);
            const amount = m.oneTime + m.annual * (m.years || 0);
            return (
              <article key={prog.id} className="card fund-card">
                <div className="fund-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="row gap-s wrap" style={{ marginBottom: 6 }}>
                      <Badge tone={m.program.kind === 'info' && m.status !== 'nicht' ? 'blau' : statusTone[m.status]}>{statusLabel(m)}</Badge>
                      {prog.kind !== 'info' && <Badge tone={windowTone[ws.state]}>{ws.state === 'laufend' ? (prog.rolling ?? 'laufend') : ws.text}</Badge>}
                    </div>
                    <h3 style={{ margin: 0 }}>{prog.name}</h3>
                    <div className="muted small">{prog.provider} · {kindLabel[prog.kind]} · {prog.authority}</div>
                  </div>
                  {m.status !== 'nicht' && amount > 0 && (
                    <div className="fund-amount">
                      {m.oneTime > 0 && <b>{eur(m.oneTime)}</b>}
                      {m.annual > 0 && <b>{eur(m.annual)}/Jahr</b>}
                      <span className="muted small">{m.annual > 0 ? `${m.years} Jahre${prog.amountMode === 'geschaetzt' ? ', geschätzt' : ''}` : prog.rate ? `${nf((m.rate ?? prog.rate) * 100)} % von ${eur(m.eligibleCost)}` : ''}</span>
                    </div>
                  )}
                  {m.status !== 'nicht' && amount === 0 && prog.amountMode === 'extern' && prog.kind !== 'info' && (
                    <div className="fund-amount"><span className="muted small" style={{ maxWidth: 220 }}>{prog.kind === 'kredit' ? 'Konditionen über die Hausbank' : 'Betrag berechnet die Bewilligungsstelle'}</span></div>
                  )}
                </div>
                <p style={{ margin: '12px 0' }}>{prog.summary}</p>
                <details className="small">
                  <summary className="muted" style={{ fontWeight: 500 }}>Voraussetzungen, Pflichten und Quelle</summary>
                  <ul className="reasons">{m.reasons.map((r) => <li key={r} className={m.status === 'nicht' ? 'no' : 'ok'}>{r}</li>)}</ul>
                  {prog.obligations.length > 0 && <ul className="reasons">{prog.obligations.map((o) => <li key={o}>{o}</li>)}</ul>}
                  <div className="muted">Quelle: <a href={prog.source.url} target="_blank" rel="noreferrer">{prog.source.label}</a> · Stand {prog.source.stand}</div>
                </details>
                <div className="row gap wrap" style={{ marginTop: 12 }}>
                  {canApply(m) && (existing ? (
                    <button className="btn" onClick={() => setTab('antraege')}>Antrag ansehen ({applicationStage(existing).label})</button>
                  ) : (
                    <button className="btn primary" onClick={() => startApplication(m)}>
                      {isPalu(prog.id) ? 'Interessenbekundung vorbereiten' : 'Antrag vorbereiten'}
                    </button>
                  ))}
                  {(prog.portal || !canApply(m)) && (
                    <a className="btn ghost" href={prog.portal ?? prog.source.url} target="_blank" rel="noreferrer">{prog.portal ? 'Zum Antragsportal' : 'Mehr erfahren'} <ArrowRight size={14} /></a>
                  )}
                  {canApply(m) && <span className="muted small">{prog.docs.length} Nachweise · Daten aus Plan und Kataster werden übernommen</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === 'antraege' && (
        <div className="stack">
          {state.applications.length === 0 && <Empty icon={<FileText size={36} />} title="Noch keine Anträge">Bereiten Sie einen Antrag bei einem passenden Programm vor. Flächen und Plan werden übernommen.</Empty>}
          {state.applications.map((a) => {
            const st = applicationStage(a);
            const prog = programById(a.programId);
            const appParcels = state.myParcels.filter((p) => a.parcelIds.includes(p.id));
            const ws = prog ? windowStatus(prog) : null;
            return (
              <article key={a.id} className="card stack" style={{ gap: 12 }}>
                <div className="row between wrap gap">
                  <div>
                    <h3 style={{ margin: 0 }}>{a.programName}</h3>
                    <div className="muted small">
                      {appParcels.length} Flurstück(e), {nf(appParcels.reduce((x, p) => x + p.areaHa, 0), 2)} ha · erstellt {fdate(a.createdAt)}
                      {a.submittedAt && ` · eingereicht ${fdate(a.submittedAt)}`}{a.data.portalRef && ` · Vorgang ${a.data.portalRef}`}
                    </div>
                    {!prog && <div className="note warn" style={{ marginTop: 8 }}>Dieses Programm ist nicht mehr im Katalog. Bitte Angaben bei der Bewilligungsstelle prüfen.</div>}
                  </div>
                  <label className="row gap-s small">
                    <span className="muted">Status</span>
                    <select
                      value={a.status}
                      onChange={(e) => upsertApplication({ ...a, status: e.target.value as Application['status'], submittedAt: e.target.value === 'eingereicht' && !a.submittedAt ? new Date().toISOString() : a.submittedAt })}
                    >
                      <option value="entwurf">Entwurf</option><option value="eingereicht">Eingereicht</option><option value="bewilligt">Bewilligt</option><option value="abgelehnt">Abgelehnt</option>
                    </select>
                  </label>
                </div>
                <div className="row gap wrap">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {a.amountRequested > 0 && <Badge tone="blau">Beantragt: {eur(a.amountRequested)}</Badge>}
                  {a.status === 'entwurf' && ws && <Badge tone={windowTone[ws.state]}>{ws.text}</Badge>}
                  <div className="grow" />
                  <button className="btn small" onClick={() => setWizard({ appId: a.id, step: a.status === 'entwurf' ? 1 : 5 })}>{a.status === 'entwurf' ? 'Fortsetzen' : 'Ansehen'}</button>
                  {a.status === 'entwurf' && <button className="btn ghost small" onClick={() => deleteApplication(a.id)}>Verwerfen</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {wizard && wizardApp && (
        <Wizard
          app={wizardApp} step={wizard.step} res={res}
          onStep={(s) => setWizard((w) => w && { ...w, step: s })}
          onChange={(a) => upsertApplication(a)}
          onClose={() => setWizard(null)}
          parcelOptions={moorParcels}
          farm={state.farm} setFarm={setFarm} updateParcel={updateParcel}
          onSubmitted={() => { setWizard(null); setTab('antraege'); say('Als eingereicht markiert'); }}
        />
      )}
    </div>
  );
}

/* ---------- Antragsassistent ---------- */

function Wizard({
  app, step, res, onStep, onChange, onClose, onSubmitted, parcelOptions, farm, setFarm, updateParcel,
}: {
  app: Application; step: number; res: PlanResult | null; onStep: (s: number) => void; onChange: (a: Application) => void; onClose: () => void; onSubmitted: () => void;
  parcelOptions: Parcel[]; farm: Farm; setFarm: (p: Partial<Farm>) => void; updateParcel: (id: string, patch: Partial<Parcel>) => void;
}) {
  const prog = programById(app.programId);
  const steps = ['Flächen', 'Antragsteller', 'Vorhaben & Kosten', 'Nachweise', 'Prüfen & Unterlagen'];
  const set = (patch: Partial<Application['data']>) => onChange({ ...app, data: { ...app.data, ...patch } });
  const setInfo = (id: string, patch: Partial<NonNullable<Application['data']['parcelInfo']>[string]>) =>
    set({ parcelInfo: { ...app.data.parcelInfo, [id]: { ...app.data.parcelInfo?.[id], ...patch } } });
  const decl = app.data.declarations ?? { noDoubleFunding: false, notStarted: false, kmu: true, deminimisEur: null };
  const setDecl = (patch: Partial<typeof decl>) => set({ declarations: { ...decl, ...patch } });

  const selected = parcelOptions.filter((p) => app.parcelIds.includes(p.id));
  const areaHa = selected.reduce((a, p) => a + p.areaHa, 0);
  const req = computeRequest(prog, app, selected);
  const errors = validate(prog, app, selected, farm, req);
  const docs = (prog?.docs ?? []).filter((d) => docApplies(d, selected));
  const needs5y = prog?.id === 'palu_3a' || prog?.id === 'palu_3b';
  const wl = app.data.targetWlCm;
  const stufe = wl == null ? null : wl <= 10 ? 1 : wl <= 20 ? 2 : null;
  const readOnly = app.status !== 'entwurf';

  // Beantragten Betrag mitführen
  const total = Math.round(req.total);
  useEffect(() => {
    if (!readOnly && total !== app.amountRequested) onChange({ ...app, amountRequested: total });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, readOnly]);

  const download = () => downloadDocument(app.programName, buildDocument(prog, app, selected, farm, req, res));

  return (
    <Modal
      wide title={app.programName} onClose={onClose}
      footer={
        <div className="row between grow">
          <button className="btn ghost" onClick={() => (step > 1 ? onStep(step - 1) : onClose())}>{step > 1 ? '← Zurück' : 'Schließen'}</button>
          {step < 5 ? (
            <button className="btn primary" onClick={() => onStep(step + 1)}>Weiter →</button>
          ) : (
            <div className="row gap-s wrap">
              <button className="btn" onClick={download}><Download size={15} /> Unterlagen herunterladen</button>
              {!readOnly && (
                <button className="btn primary" disabled={errors.length > 0} onClick={() => { onChange({ ...app, status: 'eingereicht', submittedAt: new Date().toISOString() }); onSubmitted(); }}>
                  Im Portal eingereicht
                </button>
              )}
            </div>
          )}
        </div>
      }
    >
      <div className="stepper small" style={{ marginTop: 0 }}>
        {steps.map((s, i) => (
          <button key={s} className={`s ${i + 1 < step ? 'done' : ''} ${i + 1 === step ? 'cur' : ''}`} onClick={() => onStep(i + 1)}>
            <i>{i + 1 < step ? <Check size={12} /> : i + 1}</i><span>{s}</span>
          </button>
        ))}
      </div>

      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {step === 1 && (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>Amtliche Angaben werden aus dem Kataster übernommen. Ergänzen Sie Nutzungsrecht{needs5y ? ', Pachtende und die Nutzung der letzten fünf Jahre' : ''}.</p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th /><th>Flurstück</th><th>Gemarkung · Flur</th><th className="num">Amtl. Fläche</th><th>Nutzungsrecht</th>{prog?.id === 'palu_3b' && <th>Pachtende</th>}{needs5y && <th>≥ 5 J. landw.</th>}</tr>
                </thead>
                <tbody>
                  {parcelOptions.map((p) => {
                    const on = app.parcelIds.includes(p.id);
                    const k = p.alkis ? parseKennzeichen(p.alkis.flurstueckskennzeichen) : null;
                    const info = app.data.parcelInfo?.[p.id];
                    return (
                      <tr key={p.id} className={on ? 'on' : ''}>
                        <td><input type="checkbox" checked={on} aria-label={`${p.label} beantragen`} onChange={(e) => onChange({ ...app, parcelIds: e.target.checked ? [...app.parcelIds, p.id] : app.parcelIds.filter((x) => x !== p.id) })} /></td>
                        <td><b>{p.label}</b><div className="code-cell">{p.alkis?.flurstueckskennzeichen ?? 'kein amtliches Kennzeichen'}</div></td>
                        <td>{p.gemarkung}{k && k.flur > 0 ? ` · Flur ${k.flur}` : ''}</td>
                        <td className="num">{nf(p.alkis?.amtlicheFlaecheQm ? p.alkis.amtlicheFlaecheQm / 10000 : p.areaHa, 2)} ha</td>
                        <td>
                          <select className="mini-select" value={p.tenure ?? 'eigentum'} onChange={(e) => updateParcel(p.id, { tenure: e.target.value as 'eigentum' | 'pacht' })} aria-label={`Nutzungsrecht ${p.label}`}>
                            <option value="eigentum">Eigentum</option><option value="pacht">Pacht</option>
                          </select>
                        </td>
                        {prog?.id === 'palu_3b' && (
                          <td>{p.tenure === 'pacht' ? <input type="date" value={info?.leaseEnd ?? ''} onChange={(e) => setInfo(p.id, { leaseEnd: e.target.value })} aria-label={`Pachtende ${p.label}`} /> : <span className="muted">–</span>}</td>
                        )}
                        {needs5y && <td><input type="checkbox" checked={!!info?.agriUse5y} onChange={(e) => setInfo(p.id, { agriUse5y: e.target.checked })} aria-label={`${p.label} seit 5 Jahren landwirtschaftlich genutzt`} /></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="note">Beantragt: <b>{selected.length} Flurstück(e), {nf(areaHa, 2)} ha</b>{prog?.requires.minHa && prog.requires.minHa >= 1 ? ` · Mindestfläche ${prog.requires.minHa} ha` : ''}</div>
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            <Field label="Betriebsname"><input type="text" value={farm.name} onChange={(e) => setFarm({ name: e.target.value })} /></Field>
            <Field label="Antragsteller/in"><input type="text" value={farm.owner} onChange={(e) => setFarm({ owner: e.target.value })} /></Field>
            <Field label="Anschrift des Betriebssitzes" hint="Straße, PLZ, Ort"><input type="text" value={farm.address ?? ''} onChange={(e) => setFarm({ address: e.target.value })} /></Field>
            <Field label="Rechtsform">
              <select value={farm.legalForm} onChange={(e) => setFarm({ legalForm: e.target.value })}>
                <option>Einzelunternehmen</option><option>GbR</option><option>GmbH & Co. KG</option><option>GmbH</option><option>eG</option>
              </select>
            </Field>
            <Field label="Betriebsnummer (InVeKoS)"><input type="text" value={farm.betriebsnummer} onChange={(e) => setFarm({ betriebsnummer: e.target.value })} /></Field>
            <Field label="IBAN (Auszahlung)"><input type="text" value={farm.iban} onChange={(e) => setFarm({ iban: e.target.value })} /></Field>
            <Field label="E-Mail"><input type="email" value={farm.email} onChange={(e) => setFarm({ email: e.target.value })} /></Field>
            <Field label="Telefon"><input type="text" value={farm.phone} onChange={(e) => setFarm({ phone: e.target.value })} /></Field>
            <label className="check"><input type="checkbox" checked={decl.kmu} onChange={(e) => setDecl({ kmu: e.target.checked })} /> Kleines oder mittleres Unternehmen (KMU)</label>
            {prog?.docs.includes('deminimis') && (
              <Field label="De-minimis-Beihilfen der letzten 3 Jahre (€)" hint="Höchstens 50.000 € in der landwirtschaftlichen Primärproduktion">
                <input type="number" min={0} value={decl.deminimisEur ?? ''} onChange={(e) => setDecl({ deminimisEur: e.target.value === '' ? null : Number(e.target.value) })} />
              </Field>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="stack">
            <div className="form-grid">
              <Field label="Beschreibung der Maßnahme"><textarea rows={3} value={app.data.measure} onChange={(e) => set({ measure: e.target.value })} /></Field>
              <Field label="Zielwasserstand (Jahresmittel, cm unter Flur)" hint={stufe ? `Vernässungsstufe ${stufe}` : 'Über 20 cm: nicht förderfähig nach Palu'}>
                <input type="number" value={wl ?? ''} onChange={(e) => set({ targetWlCm: Number(e.target.value) })} />
              </Field>
              <Field label="Geplanter Maßnahmenbeginn" hint="Erst nach Bewilligung bzw. Zulassung des vorzeitigen Beginns">
                <input type="date" value={app.data.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              </Field>
              {prog?.id === 'palu_3a' && (
                <Field label="Bodenrichtwert (€/m²)" hint="Grundlage des Kompensationsrechners; z. B. aus BORIS">
                  <input type="number" step="0.01" value={app.data.bodenrichtwert ?? ''} onChange={(e) => set({ bodenrichtwert: e.target.value === '' ? null : Number(e.target.value) })} />
                </Field>
              )}
            </div>
            {prog?.covers && (
              <div className="form-grid">
                {prog.covers.map((c) => (
                  <Field key={c} label={{ planning: 'Planung, Gutachten, Genehmigung (€)', waterworks: 'Wasserbau und Pegel (€)', establishment: 'Etablierung Paludikultur (€)' }[c]} hint="aus dem Plan, durch Angebote ersetzen">
                    <input type="number" value={app.data.costs?.[c] ?? 0} onChange={(e) => set({ costs: { ...(app.data.costs ?? { planning: 0, waterworks: 0, establishment: 0 }), [c]: Number(e.target.value) } })} />
                  </Field>
                ))}
              </div>
            )}
            <table className="table compact">
              <tbody>
                {req.lines.map((l) => <tr key={l.label}><td>{l.label}</td><td className="num">{eur(l.amount)}</td></tr>)}
                <tr className="total"><td>Beantragter Betrag</td><td className="num">{prog?.amountMode === 'extern' ? 'berechnet die Bewilligungsstelle' : eur(req.total)}</td></tr>
              </tbody>
            </table>
            {req.note && <p className="muted small" style={{ margin: 0 }}>{req.note}</p>}
          </div>
        )}

        {step === 4 && (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>Grün markierte Unterlagen erzeugt Paludio aus Ihren Daten. Die übrigen legen Sie bei der Einreichung im Portal bei.</p>
            {docs.map((d) => (
              <div key={d} className="row between doc-line">
                <div className="row gap-s">
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {DOCS[d].auto || app.data.docs[d] ? <CheckCircle2 size={16} className="text-gruen" /> : <Square size={16} className="muted" />}
                  </span>
                  <span>{DOCS[d].label}</span>
                </div>
                {DOCS[d].auto ? <Badge tone="gruen">wird erzeugt</Badge> : (
                  <label className="check small"><input type="checkbox" checked={!!app.data.docs[d]} onChange={(e) => set({ docs: { ...app.data.docs, [d]: e.target.checked } })} /> liegt vor</label>
                )}
              </div>
            ))}
            {(prog?.docs ?? []).filter((d) => !docApplies(d, selected)).map((d) => (
              <div key={d} className="row between doc-line muted"><span>{DOCS[d].label}</span><span className="small">entfällt</span></div>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="stack">
            <table className="table compact">
              <tbody>
                <tr><td>Programm</td><td>{app.programName}</td></tr>
                <tr><td>Bewilligungsstelle</td><td>{prog?.authority ?? '–'}</td></tr>
                <tr><td>Antragsteller/in</td><td>{farm.owner} · {farm.name}{farm.address ? ` · ${farm.address}` : ''}</td></tr>
                <tr><td>Flächen</td><td>{selected.length} Flurstück(e), {nf(areaHa, 2)} ha</td></tr>
                <tr><td>Zielwasserstand</td><td>{wl ?? '–'} cm unter Flur{stufe ? ` · Vernässungsstufe ${stufe}` : ''}</td></tr>
                <tr><td>Beantragt</td><td><b>{prog?.amountMode === 'extern' ? 'Betrag berechnet die Bewilligungsstelle' : eur(req.total)}</b></td></tr>
                <tr><td>Nachweise</td><td>{docs.filter((d) => DOCS[d].auto || app.data.docs[d]).length} von {docs.length} vorhanden</td></tr>
                {prog && <tr><td>Antragsfenster</td><td>{windowStatus(prog).text}</td></tr>}
              </tbody>
            </table>
            <label className="check box"><input type="checkbox" checked={decl.noDoubleFunding} onChange={(e) => setDecl({ noDoubleFunding: e.target.checked })} /> Für dieselbe Maßnahme habe ich keine andere öffentliche Förderung beantragt oder erhalten.</label>
            <label className="check box"><input type="checkbox" checked={decl.notStarted} onChange={(e) => setDecl({ notStarted: e.target.checked })} /> Mit der Maßnahme wurde noch nicht begonnen.</label>
            <label className="check box"><input type="checkbox" checked={app.data.confirmed} onChange={(e) => set({ confirmed: e.target.checked })} /> Die Angaben sind richtig und vollständig.</label>
            {!readOnly && (
              <Field label="Vorgangsnummer im Portal (optional)"><input type="text" value={app.data.portalRef ?? ''} onChange={(e) => set({ portalRef: e.target.value })} /></Field>
            )}
            {errors.length > 0 && <div className="note warn"><b>Noch offen:</b><ul style={{ margin: '6px 0 0' }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
            <p className="muted small" style={{ margin: 0 }}>
              Paludio reicht nicht selbst ein. Laden Sie die Unterlagen herunter und stellen Sie den Antrag im Portal{prog?.portal ? <> der <a href={prog.portal} target="_blank" rel="noreferrer">Bewilligungsstelle</a></> : ' der Bewilligungsstelle'}. Danach markieren Sie ihn hier als eingereicht.
            </p>
          </div>
        )}
      </fieldset>
    </Modal>
  );
}
