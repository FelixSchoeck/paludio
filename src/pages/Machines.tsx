import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { bookingStage, uid, useNow, useStore } from '../lib/store';
import { MACHINE_CATEGORIES, machineCategory } from '../lib/market';
import { cropById } from '../lib/crops';
import { haversineKm } from '../lib/geo';
import type { Machine } from '../lib/types';
import { Badge, Empty, Field, Modal, PageHeader, Tabs, eur, fdate, nf } from '../components/ui';
import {
  Tractor,
  Calendar,
  Star,
  Info,
  MachineIcon,
} from '../components/Icons';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const dayCount = (from: string, to: string) => Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
const overlaps = (aFrom: string, aTo: string, bFrom: string, bTo: string) => aFrom <= bTo && bFrom <= aTo;

const pressureTone = (k: number) => (k === 0 ? 'grau' : k <= 20 ? 'gruen' : k <= 30 ? 'gelb' : 'rot') as 'grau' | 'gruen' | 'gelb' | 'rot';

export default function Machines() {
  const { state, machines, addBooking, cancelBooking, addMachine, say } = useStore();
  const now = useNow(1000);
  const [sp, setSp] = useSearchParams();
  const cat = sp.get('cat') ?? 'alle';
  const [tab, setTab] = useState<'finden' | 'buchungen' | 'anbieten'>('finden');
  const [operator, setOperator] = useState<'alle' | 'mit' | 'ohne'>('alle');
  const [maxKpa, setMaxKpa] = useState(40);
  const [radius, setRadius] = useState(0);
  const [sort, setSort] = useState<'distanz' | 'preis' | 'bewertung'>('distanz');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<Machine | null>(null);

  const activeCrop = useMemo(() => {
    const pr = state.projects[0];
    const draft = pr ? state.plans.find((p) => p.id === pr.planId)?.draft : state.draft;
    return cropById(draft?.cropId ?? '');
  }, [state.projects, state.plans, state.draft]);

  const list = useMemo(() => {
    return machines
      .map((m) => ({ m, dist: haversineKm(state.farm.location, m.location) }))
      .filter(({ m, dist }) =>
        (cat === 'alle' || m.category === cat) &&
        (operator === 'alle' || (operator === 'mit' ? m.operatorPerDay != null : true)) &&
        (m.groundPressureKpa === 0 || m.groundPressureKpa <= maxKpa) &&
        (!radius || dist <= radius) &&
        (!q || (m.name + m.owner + m.place).toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => (sort === 'distanz' ? a.dist - b.dist : sort === 'preis' ? a.m.pricePerDay - b.m.pricePerDay : b.m.rating - a.m.rating));
  }, [machines, cat, operator, maxKpa, radius, q, sort, state.farm.location]);

  return (
    <div className="page">
      <PageHeader title="Maschinenmarkt" sub="Paludi-Maschinen mit geringem Bodendruck leihen oder die eigene Technik anbieten – von Mähraupe bis Bagger." />
      <Tabs value={tab} onChange={setTab} items={[
        { id: 'finden', label: 'Maschinen finden' },
        { id: 'buchungen', label: `Meine Buchungen (${state.bookings.length})` },
        { id: 'anbieten', label: 'Maschine anbieten' },
      ]} />

      {tab === 'finden' && (
        <>
          <div className="chips">
            <button className={`chip ${cat === 'alle' ? 'on' : ''}`} onClick={() => setSp({})}>Alle</button>
            {MACHINE_CATEGORIES.map((c) => (
              <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setSp({ cat: c.id })}>
                <MachineIcon category={c.id} size={15} className="icon-inline" /> {c.label}
              </button>
            ))}
          </div>
          {activeCrop && activeCrop.machineCategories.length > 0 && (
            <div className="note">
              <Info size={16} className="icon-inline" /> Für <b>{activeCrop.name}</b> empfohlen: {activeCrop.machineCategories.map((c) => machineCategory(c)?.label).join(', ')}.
            </div>
          )}
          <div className="card filters">
            <Field label="Suche"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Anbieter, Ort" /></Field>
            <Field label={`Max. Bodendruck: ${maxKpa} kPa`} hint="Für nasse Moorstandorte ≤ 20 kPa empfohlen">
              <input type="range" min={8} max={40} value={maxKpa} onChange={(e) => setMaxKpa(Number(e.target.value))} />
            </Field>
            <Field label="Umkreis">
              <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                <option value={0}>Ganz Deutschland</option><option value={50}>50 km</option><option value={100}>100 km</option><option value={200}>200 km</option><option value={400}>400 km</option>
              </select>
            </Field>
            <Field label="Fahrer">
              <select value={operator} onChange={(e) => setOperator(e.target.value as typeof operator)}>
                <option value="alle">egal</option><option value="mit">mit Fahrer möglich</option>
              </select>
            </Field>
            <Field label="Sortierung">
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="distanz">Entfernung</option><option value="preis">Preis</option><option value="bewertung">Bewertung</option>
              </select>
            </Field>
          </div>
          <div className="muted small">Entfernungen ab Betriebsstandort: {state.farm.locationName}. {list.length} Treffer.</div>
          {list.length === 0 && <Empty icon={<Tractor size={36} />} title="Keine Maschinen gefunden">Erweitern Sie Umkreis oder Bodendruck.</Empty>}
          <div className="machine-grid">
            {list.map(({ m, dist }) => {
              const rec = activeCrop?.machineCategories.includes(m.category);
              const nextBlock = m.blocked.find((b) => b.to >= iso(new Date()));
              return (
                <article key={m.id} className="card machine" onClick={() => setDetail(m)}>
                  <div className="row between"><span className="m-ic"><MachineIcon category={m.category} size={22} /></span>{rec && <Badge tone="gruen">empfohlen</Badge>}{m.own && <Badge tone="blau">eigenes Angebot</Badge>}</div>
                  <h3>{m.name}</h3>
                  <div className="muted small">{m.owner} · {m.ownerType}</div>
                  <div className="row gap wrap">
                    <Badge>{nf(dist, 0)} km · {m.place}</Badge>
                    {m.groundPressureKpa > 0 && <Badge tone={pressureTone(m.groundPressureKpa)}>{m.groundPressureKpa} kPa</Badge>}
                    <Badge tone="gelb"><Star size={12} className="fill-current icon-inline" /> {m.rating.toFixed(1)} ({m.reviews})</Badge>
                  </div>
                  <div className="row between end">
                    <div><b className="price">{eur(m.pricePerDay)}</b><span className="muted small"> /Tag</span>{m.operatorPerDay != null && <div className="muted small">+ Fahrer {eur(m.operatorPerDay)}/Tag</div>}</div>
                    <div className="muted small">{nextBlock ? `belegt ${fdate(nextBlock.from)}–${fdate(nextBlock.to)}` : 'frei verfügbar'}</div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {tab === 'buchungen' && (
        <div className="stack">
          {state.bookings.length === 0 && <Empty icon={<Calendar size={36} />} title="Keine Buchungen">Wählen Sie im Maschinenmarkt eine Maschine und fragen Sie einen Zeitraum an.</Empty>}
          {state.bookings.map((b) => {
            const st = bookingStage(b, now);
            return (
              <article key={b.id} className="card">
                <div className="row between wrap">
                  <div>
                    <h3>{b.machineName}</h3>
                    <div className="muted small">{fdate(b.from)} – {fdate(b.to)} · {b.withOperator ? 'mit Fahrer' : 'ohne Fahrer'}</div>
                    {b.note && <div className="small">„{b.note}“</div>}
                  </div>
                  <div className="row gap-s">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <b>{eur(b.total)}</b>
                    <button className="btn small ghost" onClick={() => { cancelBooking(b.id); say('Buchung storniert'); }}>Stornieren</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === 'anbieten' && <OfferForm onAdd={(m) => { addMachine(m); say('Maschine inseriert – sichtbar im Maschinenmarkt'); setTab('finden'); }} location={state.farm.location} place={state.farm.locationName} owner={state.farm.name || 'Mein Betrieb'} />}

      {detail && (
        <BookingModal
          machine={detail}
          distance={haversineKm(state.farm.location, detail.location)}
          existing={state.bookings.filter((b) => b.machineId === detail.id)}
          onClose={() => setDetail(null)}
          onBook={(b) => { addBooking(b); setDetail(null); setTab('buchungen'); say('Buchungsanfrage gesendet'); }}
        />
      )}
    </div>
  );
}

function BookingModal({ machine: m, distance, existing, onClose, onBook }: {
  machine: Machine; distance: number; existing: { from: string; to: string }[]; onClose: () => void; onBook: (b: import('../lib/types').Booking) => void;
}) {
  const [from, setFrom] = useState(iso(addDays(new Date(), 14)));
  const [to, setTo] = useState(iso(addDays(new Date(), 16)));
  const [withOp, setWithOp] = useState(m.operatorPerDay != null);
  const [note, setNote] = useState('');
  const days = to >= from ? dayCount(from, to) : 0;
  const conflict = [...m.blocked, ...existing].some((b) => overlaps(from, to, b.from, b.to));
  const transport = Math.round(distance * 2 * m.transportPerKm);
  const rent = days * m.pricePerDay;
  const operator = withOp && m.operatorPerDay != null ? days * m.operatorPerDay : 0;
  const fee = Math.round((rent + operator) * 0.05);
  const total = rent + operator + transport + fee;
  const invalid = days === 0 || conflict;

  return (
    <Modal
      wide title={m.name} onClose={onClose}
      footer={
        <div className="row between grow">
          <div><span className="muted small">Gesamt</span> <b className="price big">{eur(total)}</b></div>
          <button className="btn primary" disabled={invalid} onClick={() => onBook({
            id: uid('bk'), machineId: m.id, machineName: m.name, from, to, withOperator: withOp && m.operatorPerDay != null, total, createdAt: new Date().toISOString(), note,
          })}>Verbindlich anfragen</button>
        </div>
      }
    >
      <div className="grid-2">
        <div className="stack">
          <p>{m.description}</p>
          <div className="row gap wrap">{m.features.map((f) => <Badge key={f} tone="blau">{f}</Badge>)}</div>
          <div className="kv wide">
            <span>Anbieter</span><b>{m.owner}</b>
            <span>Standort</span><b>{m.place} · {nf(distance, 0)} km</b>
            <span>Bodendruck</span><b>{m.groundPressureKpa ? `${m.groundPressureKpa} kPa` : '–'}</b>
            <span>Arbeitsbreite</span><b>{m.widthM ? `${m.widthM} m` : '–'}</b>
            <span>Bewertung</span><b><Star size={14} className="fill-current icon-inline" /> {m.rating.toFixed(1)} ({m.reviews})</b>
          </div>
          {m.blocked.length > 0 && <div className="note">Bereits belegt: {m.blocked.map((b) => `${fdate(b.from)}–${fdate(b.to)}`).join(', ')}</div>}
        </div>
        <div className="stack">
          <div className="form-grid">
            <Field label="Von"><input type="date" min={iso(new Date())} value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} /></Field>
            <Field label="Bis"><input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          {m.operatorPerDay != null && (
            <label className="check"><input type="checkbox" checked={withOp} onChange={(e) => setWithOp(e.target.checked)} /> Mit Fahrer (+ {eur(m.operatorPerDay)}/Tag)</label>
          )}
          <Field label="Hinweis an den Anbieter"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Flächengröße, Zufahrt, Erntegut" /></Field>
          {conflict && <div className="note bad">In diesem Zeitraum ist die Maschine nicht verfügbar.</div>}
          <table className="table compact">
            <tbody>
              <tr><td>Miete {days} Tag(e) × {eur(m.pricePerDay)}</td><td className="num">{eur(rent)}</td></tr>
              {withOp && m.operatorPerDay != null && <tr><td>Fahrer {days} × {eur(m.operatorPerDay)}</td><td className="num">{eur(operator)}</td></tr>}
              <tr><td>Transport (hin & zurück, {nf(distance * 2, 0)} km)</td><td className="num">{eur(transport)}</td></tr>
              <tr><td>Servicegebühr Paludio (5 %)</td><td className="num">{eur(fee)}</td></tr>
              <tr className="total"><td>Gesamt (netto)</td><td className="num">{eur(total)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function OfferForm({ onAdd, location, place, owner }: { onAdd: (m: Machine) => void; location: [number, number]; place: string; owner: string }) {
  const [f, setF] = useState({ name: '', category: 'raupe-maehen', price: 400, operator: 300, withOp: true, kpa: 20, width: 2.4, description: '' });
  const valid = f.name.trim().length > 3 && f.price > 0;
  return (
    <section className="card">
      <h3>Eigene Maschine anbieten</h3>
      <p className="muted">Teilen Sie Ihre Moor-taugliche Technik mit anderen Betrieben und erwirtschaften Sie Zusatzeinnahmen. Standort: {place}.</p>
      <div className="form-grid">
        <Field label="Bezeichnung"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z. B. Mähraupe mit Seitenmähwerk" /></Field>
        <Field label="Kategorie">
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{MACHINE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        </Field>
        <Field label="Preis pro Tag (€)"><input type="number" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></Field>
        <Field label="Bodendruck (kPa)"><input type="number" value={f.kpa} onChange={(e) => setF({ ...f, kpa: Number(e.target.value) })} /></Field>
        <label className="check"><input type="checkbox" checked={f.withOp} onChange={(e) => setF({ ...f, withOp: e.target.checked })} /> Fahrer anbieten</label>
        {f.withOp && <Field label="Fahrer pro Tag (€)"><input type="number" value={f.operator} onChange={(e) => setF({ ...f, operator: Number(e.target.value) })} /></Field>}
        <Field label="Beschreibung"><textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
      <button className="btn primary" disabled={!valid} onClick={() => onAdd({
        id: uid('m'), name: f.name.trim(), category: f.category, owner, ownerType: 'Landwirt', location, place, pricePerDay: f.price,
        operatorPerDay: f.withOp ? f.operator : null, transportPerKm: 1.8, groundPressureKpa: f.kpa, widthM: f.width,
        description: f.description || 'Eigenangebot', features: [], rating: 0, reviews: 0, blocked: [], own: true, icon: f.category,
      })}>Inserieren</button>
    </section>
  );
}
