import { useState } from 'react';
import type { AttrSource, LandUse, MoorType, Parcel, ParcelSources } from '../lib/types';
import { landUseLabel, isEstimate } from '../lib/parcels';

const SOURCE_LABEL: Record<AttrSource, string> = {
  kulisse: 'Thünen-Kulisse',
  modell: 'Modell',
  schaetzung: 'Schätzung',
  angabe: 'Eigene Angabe',
  messung: 'Messung',
  gutachten: 'Gutachten',
  sammelantrag: 'Sammelantrag',
};
const MOOR_LABEL: Record<MoorType, string> = { niedermoor: 'Niedermoor', hochmoor: 'Hochmoor', mineral: 'Mineralboden' };
const LAND_USES: LandUse[] = ['acker', 'gruenland_intensiv', 'gruenland_extensiv', 'brache'];

export const DEFAULT_SOURCES: ParcelSources = { moor: 'schaetzung', peat: 'schaetzung', water: 'schaetzung', landUse: 'schaetzung' };
export const sourcesOf = (p: Parcel): ParcelSources => p.sources ?? DEFAULT_SOURCES;
export const sourceLabel = (s?: AttrSource) => SOURCE_LABEL[s ?? 'schaetzung'];

/** Anzahl der Flurstücke, bei denen Wasserstand oder Nutzung (noch) geschätzt sind */
export function estimateSummary(parcels: Parcel[]) {
  const moor = parcels.filter((p) => p.moorType !== 'mineral');
  const water = moor.filter((p) => isEstimate(sourcesOf(p).water)).length;
  const landUse = moor.filter((p) => isEstimate(sourcesOf(p).landUse)).length;
  const soil = moor.filter((p) => isEstimate(sourcesOf(p).moor) || isEstimate(sourcesOf(p).peat)).length;
  return { total: moor.length, water, landUse, soil, any: water + landUse + soil > 0 };
}

/** Herkunft nur dort zeigen, wo sie dem Betrieb etwas sagt: eigene Angaben bzw. Modellwerte */
function SourceChip({ source }: { source: AttrSource }) {
  if (source === 'kulisse' || source === 'schaetzung') return <span />;
  const tone = source === 'modell' ? 'gelb' : 'gruen';
  return <span className={`badge ${tone} src-chip`}>{SOURCE_LABEL[source]}</span>;
}

/** Bodenwerte eines Flurstücks mit Herkunft; optional bearbeitbar */
export default function ParcelFacts({ parcel, onChange }: { parcel: Parcel; onChange?: (patch: Partial<Parcel>) => void }) {
  const src = sourcesOf(parcel);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    moorType: parcel.moorType,
    peat: parcel.peatDepthCm,
    water: (isEstimate(src.water) ? '' : String(parcel.waterLevelCm)) as string,
    landUse: (isEstimate(src.landUse) ? '' : parcel.landUse) as LandUse | '',
    peatSrc: 'angabe' as AttrSource,
    waterSrc: (isEstimate(src.water) ? 'messung' : src.water) as AttrSource,
    landUseSrc: (isEstimate(src.landUse) ? 'sammelantrag' : src.landUse) as AttrSource,
  });

  const save = () => {
    if (!onChange) return;
    const sources: ParcelSources = { ...src };
    const patch: Partial<Parcel> = {};
    if (form.moorType !== parcel.moorType) { patch.moorType = form.moorType; sources.moor = 'angabe'; patch.soilCategory = undefined; }
    if (form.peat !== parcel.peatDepthCm) { patch.peatDepthCm = form.peat; sources.peat = form.peatSrc; patch.peatClass = undefined; }
    // Nur eingetragene Werte übernehmen – leer bleibt „keine Angabe“
    if (form.water.trim() !== '') { patch.waterLevelCm = Number(form.water); sources.water = form.waterSrc; }
    if (form.landUse) { patch.landUse = form.landUse; sources.landUse = form.landUseSrc; }
    onChange({ ...patch, sources });
    setEdit(false);
  };

  if (edit && onChange) {
    const srcSelect = (value: AttrSource, set: (v: AttrSource) => void, options: AttrSource[], label: string) => (
      <select className="mini-select" value={value} onChange={(e) => set(e.target.value as AttrSource)} aria-label={label}>
        {options.map((o) => <option key={o} value={o}>{SOURCE_LABEL[o]}</option>)}
      </select>
    );
    return (
      <div className="facts-edit">
        <label>
          <span>Boden</span>
          <select value={form.moorType} onChange={(e) => setForm({ ...form, moorType: e.target.value as MoorType })}>
            {(Object.keys(MOOR_LABEL) as MoorType[]).map((m) => <option key={m} value={m}>{MOOR_LABEL[m]}</option>)}
          </select>
        </label>
        <label>
          <span>Torf (cm)</span>
          <input type="number" min={0} value={form.peat} onChange={(e) => setForm({ ...form, peat: Number(e.target.value) })} />
          {srcSelect(form.peatSrc, (v) => setForm({ ...form, peatSrc: v }), ['angabe', 'messung', 'gutachten'], 'Quelle Torf')}
        </label>
        <label>
          <span>Wasserstand (cm u. Flur)</span>
          <input type="number" placeholder="keine Angabe" value={form.water} onChange={(e) => setForm({ ...form, water: e.target.value })} />
          {srcSelect(form.waterSrc, (v) => setForm({ ...form, waterSrc: v }), ['messung', 'gutachten', 'angabe'], 'Quelle Wasserstand')}
        </label>
        <label>
          <span>Nutzung heute</span>
          <select value={form.landUse} onChange={(e) => setForm({ ...form, landUse: e.target.value as LandUse | '' })}>
            <option value="">keine Angabe</option>
            {LAND_USES.map((l) => <option key={l} value={l}>{landUseLabel(l)}</option>)}
          </select>
          {srcSelect(form.landUseSrc, (v) => setForm({ ...form, landUseSrc: v }), ['sammelantrag', 'angabe'], 'Quelle Nutzung')}
        </label>
        <div className="row gap-s">
          <button type="button" className="btn small primary" onClick={save}>Übernehmen</button>
          <button type="button" className="btn small ghost" onClick={() => setEdit(false)}>Abbrechen</button>
        </div>
      </div>
    );
  }

  const moorText = parcel.soilCategory ?? MOOR_LABEL[parcel.moorType];
  const peatText = parcel.moorType === 'mineral' ? '–' : parcel.peatClass ?? `${parcel.peatDepthCm} cm`;
  return (
    <div className="facts">
      <span>Boden</span><b>{moorText}</b><SourceChip source={src.moor} />
      {parcel.moorType !== 'mineral' && (<><span>Torf</span><b>{peatText}</b><SourceChip source={src.peat} /></>)}
      <span>Wasserstand</span>{isEstimate(src.water) ? <b className="muted">keine Angabe</b> : <b>{parcel.waterLevelCm} cm u. Flur</b>}<SourceChip source={src.water} />
      <span>Nutzung</span>{isEstimate(src.landUse) ? <b className="muted">keine Angabe</b> : <b>{landUseLabel(parcel.landUse)}</b>}<SourceChip source={src.landUse} />
      {onChange && (
        <button type="button" className="btn small ghost facts-btn" onClick={() => setEdit(true)}>
          {isEstimate(src.water) || isEstimate(src.landUse) ? 'Werte eintragen' : 'Werte bearbeiten'}
        </button>
      )}
    </div>
  );
}
