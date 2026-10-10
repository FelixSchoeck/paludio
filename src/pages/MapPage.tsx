import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../lib/store';
import type { LatLng, MoorType, Parcel } from '../lib/types';
import { parcelsInBounds, makeCustomParcel, landUseLabel } from '../lib/parcels';
import { soilAt, MOOR_REGIONS } from '../lib/moor';
import { BUNDESLAENDER, CITIES } from '../lib/geo';
import { emissionPerHa } from '../lib/calc';
import { Badge, Tabs, nf } from '../components/ui';
import { Pencil, MapPin, X, DraftingCompass, Crosshair, Trash2, Database } from '../components/Icons';

const MIN_PARCEL_ZOOM = 14;

const moorLabel: Record<MoorType, string> = { niedermoor: 'Niedermoor', hochmoor: 'Hochmoor', mineral: 'Mineralboden' };
const moorTone = (t: MoorType) => (t === 'niedermoor' ? 'braun' : t === 'hochmoor' ? 'rot' : 'grau') as 'braun' | 'rot' | 'grau';

function baseStyle(p: Parcel): L.PathOptions {
  if (p.moorType === 'niedermoor') return { color: '#4a3722', weight: 1, fillColor: '#b08a45', fillOpacity: 0.45 };
  if (p.moorType === 'hochmoor') return { color: '#4a2a30', weight: 1, fillColor: '#8a4f5a', fillOpacity: 0.5 };
  return { color: '#5f6b60', weight: 0.8, fillColor: '#9aa89c', fillOpacity: 0.12 };
}
const SELECTED: L.PathOptions = { color: '#1d5e78', weight: 2.5, fillColor: '#5fa8c4', fillOpacity: 0.55 };
const OWNED: L.PathOptions = { color: '#2e6a3b', weight: 2, fillColor: '#3e8a4c', fillOpacity: 0.45 };

interface Suggestion { name: string; pos: LatLng; sub?: string; zoom?: number }

export default function MapPage() {
  const { state, addParcels, removeParcel, updateParcel, setDraft, say } = useStore();
  const nav = useNavigate();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const moorRef = useRef<L.GridLayer | null>(null);
  const pinsRef = useRef<L.LayerGroup | null>(null);
  const viewRef = useRef<L.LayerGroup | null>(null);
  const ownRef = useRef<L.LayerGroup | null>(null);
  const selRef = useRef<L.LayerGroup | null>(null);
  const drawRef = useRef<L.LayerGroup | null>(null);
  const viewPolys = useRef(new Map<string, L.Polygon>());
  const drawPts = useRef<LatLng[]>([]);

  const [zoom, setZoom] = useState(6);
  const [basemap, setBasemap] = useState<'karte' | 'luftbild'>('karte');
  const [showMoor, setShowMoor] = useState(true);
  const [selected, setSelected] = useState<Parcel[]>([]);
  const [hover, setHover] = useState<Parcel | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [drawCount, setDrawCount] = useState(0);
  const [tab, setTab] = useState<'auswahl' | 'meine'>(state.myParcels.length ? 'meine' : 'auswahl');
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSug, setShowSug] = useState(false);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const ownRefData = useRef(state.myParcels);
  ownRefData.current = state.myParcels;
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  const toggle = useCallback((p: Parcel) => {
    if (drawingRef.current) return;
    setSelected((cur) => (cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, p]));
    setTab('auswahl');
  }, []);

  /* ----- Karte initialisieren ----- */
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      center: [51.2, 10.4], zoom: 6, minZoom: 5, maxZoom: 19, preferCanvas: true, zoomControl: true,
      maxBounds: [[46.2, 4.5], [56.2, 16.5]], maxBoundsViscosity: 0.8,
    });
    mapRef.current = map;
    map.zoomControl.setPosition('topright');
    // Mit eigenen Flächen direkt dorthin springen
    if (state.myParcels.length) {
      const bounds = L.latLngBounds(state.myParcels.flatMap((p) => p.ring));
      map.fitBounds(bounds, { maxZoom: 15, padding: [60, 60] });
    }

    const MoorGrid = (L.GridLayer as unknown as { extend: (o: object) => new (o?: object) => L.GridLayer }).extend({
      createTile(coords: L.Coords) {
        const size = 256;
        const tile = document.createElement('canvas');
        tile.width = size;
        tile.height = size;
        const nwLL = map.unproject(L.point(coords.x * size, coords.y * size), coords.z);
        const seLL = map.unproject(L.point((coords.x + 1) * size, (coords.y + 1) * size), coords.z);
        if (seLL.lat > 55.3 || nwLL.lat < 47.0 || seLL.lng < 5.7 || nwLL.lng > 15.3) return tile;
        const N = coords.z <= 9 ? 96 : 64;
        const small = document.createElement('canvas');
        small.width = N;
        small.height = N;
        const sctx = small.getContext('2d')!;
        const img = sctx.createImageData(N, N);
        const step = size / N;
        let any = false;
        for (let j = 0; j < N; j++) {
          for (let i = 0; i < N; i++) {
            const ll = map.unproject(L.point(coords.x * size + (i + 0.5) * step, coords.y * size + (j + 0.5) * step), coords.z);
            const s = soilAt(ll.lat, ll.lng);
            if (s.type === 'mineral') continue;
            any = true;
            const o = (j * N + i) * 4;
            const k = Math.min(1, s.depthCm / 300);
            if (s.type === 'hochmoor') { img.data[o] = 128; img.data[o + 1] = 52; img.data[o + 2] = 70; }
            else { img.data[o] = 160; img.data[o + 1] = 112; img.data[o + 2] = 44; }
            img.data[o + 3] = Math.round(120 + 110 * k);
          }
        }
        if (any) {
          sctx.putImageData(img, 0, 0);
          const ctx = tile.getContext('2d')!;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(small, 0, 0, size, size);
        }
        return tile;
      },
    });
    const moor = new MoorGrid({ opacity: 0.75, zIndex: 5 });
    moor.addTo(map);
    moorRef.current = moor;

    const pins = L.layerGroup().addTo(map);
    pinsRef.current = pins;
    MOOR_REGIONS.forEach((r) => {
      const m = L.circleMarker(r.center, { radius: 7, color: '#fff', weight: 2, fillColor: r.type === 'hochmoor' ? '#8a3a50' : '#a8742a', fillOpacity: 1 });
      m.bindTooltip(`${r.name} · ${r.type === 'hochmoor' ? 'Hochmoor' : 'Niedermoor'}`, { direction: 'top' });
      m.on('click', () => map.flyTo(r.center, 13, { duration: 1.2 }));
      m.addTo(pins);
    });

    viewRef.current = L.layerGroup().addTo(map);
    ownRef.current = L.layerGroup().addTo(map);
    selRef.current = L.layerGroup().addTo(map);
    drawRef.current = L.layerGroup().addTo(map);

    const renderView = () => {
      const z = map.getZoom();
      setZoom(z);
      pins.getLayers().length; // keep reference
      if (z >= 10) map.removeLayer(pins); else if (!map.hasLayer(pins)) pins.addTo(map);
      const grp = viewRef.current!;
      if (z < MIN_PARCEL_ZOOM) {
        grp.clearLayers();
        viewPolys.current.clear();
        return;
      }
      const b = map.getBounds().pad(0.1);
      const list = parcelsInBounds(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
      const skip = new Set<string>([...selectedRef.current.map((p) => p.id), ...ownRefData.current.map((p) => p.id)]);
      const want = new Set<string>();
      for (const p of list) {
        if (skip.has(p.id)) continue;
        want.add(p.id);
        if (viewPolys.current.has(p.id)) continue;
        const poly = L.polygon(p.ring, baseStyle(p));
        poly.on('click', (e) => { L.DomEvent.stopPropagation(e); toggle(p); });
        poly.on('mouseover', () => { poly.setStyle({ weight: 2.5, fillOpacity: 0.7 }); setHover(p); });
        poly.on('mouseout', () => { poly.setStyle(baseStyle(p)); setHover((h) => (h?.id === p.id ? null : h)); });
        poly.addTo(grp);
        viewPolys.current.set(p.id, poly);
      }
      for (const [id, poly] of viewPolys.current) {
        if (!want.has(id)) {
          grp.removeLayer(poly);
          viewPolys.current.delete(id);
        }
      }
    };
    (map as unknown as { _renderView: () => void })._renderView = renderView;
    map.on('moveend zoomend', renderView);
    renderView();

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- Basiskarte ----- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (baseRef.current) map.removeLayer(baseRef.current);
    const layer =
      basemap === 'karte'
        ? L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap-Mitwirkende', maxZoom: 19 })
        : L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Luftbild © Esri, Maxar, Earthstar Geographics', maxZoom: 19 });
    layer.setZIndex(1);
    layer.addTo(map);
    baseRef.current = layer;
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = moorRef.current;
    if (!map || !layer) return;
    if (showMoor) layer.addTo(map); else map.removeLayer(layer);
  }, [showMoor]);

  /* ----- Auswahl- und Eigene-Layer ----- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sel = selRef.current!;
    const own = ownRef.current!;
    sel.clearLayers();
    own.clearLayers();
    const selIds = new Set(selected.map((p) => p.id));
    for (const p of state.myParcels) {
      if (selIds.has(p.id)) continue;
      const poly = L.polygon(p.ring, OWNED);
      poly.on('click', (e) => { L.DomEvent.stopPropagation(e); toggle(p); });
      poly.on('mouseover', () => setHover(p));
      poly.on('mouseout', () => setHover((h) => (h?.id === p.id ? null : h)));
      poly.addTo(own);
    }
    for (const p of selected) {
      const poly = L.polygon(p.ring, SELECTED);
      poly.on('click', (e) => { L.DomEvent.stopPropagation(e); toggle(p); });
      poly.on('mouseover', () => setHover(p));
      poly.on('mouseout', () => setHover((h) => (h?.id === p.id ? null : h)));
      poly.addTo(sel);
    }
    (map as unknown as { _renderView?: () => void })._renderView?.();
  }, [selected, state.myParcels, toggle]);

  /* ----- Zeichenmodus ----- */
  const redrawDraft = useCallback(() => {
    const g = drawRef.current;
    if (!g) return;
    g.clearLayers();
    const pts = drawPts.current;
    pts.forEach((p) => L.circleMarker(p, { radius: 5, color: '#fff', weight: 2, fillColor: '#d9822b', fillOpacity: 1 }).addTo(g));
    if (pts.length >= 3) L.polygon(pts, { color: '#d9822b', weight: 2, dashArray: '6 4', fillColor: '#d9822b', fillOpacity: 0.2 }).addTo(g);
    else if (pts.length === 2) L.polyline(pts, { color: '#d9822b', weight: 2, dashArray: '6 4' }).addTo(g);
    setDrawCount(pts.length);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!drawing) {
      map.getContainer().style.cursor = '';
      return;
    }
    map.getContainer().style.cursor = 'crosshair';
    map.doubleClickZoom.disable();
    const onClick = (e: L.LeafletMouseEvent) => {
      drawPts.current = [...drawPts.current, [e.latlng.lat, e.latlng.lng]];
      redrawDraft();
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = '';
    };
  }, [drawing, redrawDraft]);

  const startDraw = () => {
    drawPts.current = [];
    redrawDraft();
    setDrawing(true);
    if (zoom < 13) mapRef.current?.setZoom(14);
  };
  const cancelDraw = () => {
    drawPts.current = [];
    redrawDraft();
    setDrawing(false);
  };
  const finishDraw = () => {
    if (drawPts.current.length < 3) {
      say('Bitte mindestens 3 Eckpunkte setzen');
      return;
    }
    const p = makeCustomParcel(drawPts.current);
    drawPts.current = [];
    redrawDraft();
    setDrawing(false);
    setSelected((cur) => [...cur, p]);
    setTab('auswahl');
  };

  /* ----- Suche ----- */
  const local: Suggestion[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const regs = MOOR_REGIONS.filter((r) => r.name.toLowerCase().includes(q) || r.gemeinden.some((g) => g.toLowerCase().includes(q)))
      .map((r) => ({ name: r.name, pos: r.center, sub: `Moorregion · ${BUNDESLAENDER[r.bl].name}`, zoom: 13 }));
    const cities = CITIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4)
      .map((c) => ({ name: c.name, pos: c.pos, sub: 'Ort', zoom: 12 }));
    return [...regs, ...cities].slice(0, 6);
  }, [query]);

  const fly = (s: Suggestion) => {
    mapRef.current?.flyTo(s.pos, s.zoom ?? 14, { duration: 1.2 });
    setShowSug(false);
    setQuery(s.name);
  };

  const searchRemote = async () => {
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=de&limit=5&accept-language=de&q=${encodeURIComponent(q)}`);
      const data = (await r.json()) as { display_name: string; lat: string; lon: string }[];
      setRemote(data.map((d) => ({ name: d.display_name.split(',').slice(0, 2).join(','), pos: [Number(d.lat), Number(d.lon)] as LatLng, sub: d.display_name.split(',').slice(2, 4).join(','), zoom: 15 })));
      setShowSug(true);
      if (!data.length && !local.length) say('Kein Ort gefunden');
    } catch {
      say('Adresssuche offline – lokale Treffer werden angezeigt');
    } finally {
      setSearching(false);
    }
  };

  /* ----- Abgeleitete Werte ----- */
  const totals = useMemo(() => {
    const ha = selected.reduce((a, p) => a + p.areaHa, 0);
    const moor = selected.filter((p) => p.moorType !== 'mineral');
    const moorHa = moor.reduce((a, p) => a + p.areaHa, 0);
    const em = moor.reduce((a, p) => a + emissionPerHa(p.waterLevelCm, p.peatDepthCm, p.landUse) * p.areaHa, 0);
    const emAfter = moor.reduce((a, p) => a + emissionPerHa(5, p.peatDepthCm, p.landUse) * p.areaHa, 0);
    return { ha, moorHa, em, saving: em - emAfter };
  }, [selected]);

  const ownIds = new Set(state.myParcels.map((p) => p.id));
  const saveSelected = () => {
    addParcels(selected);
    say(`${selected.length} Fläche(n) zu „Meine Flächen“ hinzugefügt`);
  };
  const toPlanner = () => {
    addParcels(selected);
    const ids = [...new Set([...selected.map((p) => p.id)])];
    setDraft({ parcelIds: ids });
    nav('/planer');
  };
  const flyToParcel = (p: Parcel) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyToBounds(L.latLngBounds(p.ring), { maxZoom: 16, duration: 1 });
  };

  const sugs = [...local, ...remote];

  return (
    <div className="map-page">
      <div className="map-wrap">
        <div ref={mapEl} className="map" />

        <div className="map-search">
          <form onSubmit={(e) => { e.preventDefault(); searchRemote(); }}>
            <input
              placeholder="Ort, Gemeinde oder Moorregion suchen …" value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSug(true); setRemote([]); }}
              onFocus={() => setShowSug(true)}
            />
            <button className="btn small" type="submit" disabled={searching}>{searching ? '…' : 'Adresse'}</button>
          </form>
          {showSug && sugs.length > 0 && (
            <div className="sug">
              {sugs.map((s, i) => (
                <button key={i} onClick={() => fly(s)}>
                  <b>{s.name}</b><span className="muted">{s.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="map-tools">
          <div className="seg">
            <button className={basemap === 'karte' ? 'on' : ''} onClick={() => setBasemap('karte')}>Karte</button>
            <button className={basemap === 'luftbild' ? 'on' : ''} onClick={() => setBasemap('luftbild')}>Luftbild</button>
          </div>
          <label className="check"><input type="checkbox" checked={showMoor} onChange={(e) => setShowMoor(e.target.checked)} /> Moorböden</label>
          {!drawing ? (
            <button className="btn small" onClick={startDraw}><Pencil size={15} /> Fläche zeichnen</button>
          ) : (
            <div className="row gap">
              <button className="btn small primary" onClick={finishDraw}>Fertig ({drawCount})</button>
              <button className="btn small ghost" onClick={cancelDraw}>Abbrechen</button>
            </div>
          )}
          <button className="btn small ghost" onClick={() => mapRef.current?.flyTo(state.farm.location, 13)}><MapPin size={15} /> Mein Betrieb</button>
        </div>

        <div className="map-legend">
          <div><i style={{ background: '#b08a45' }} /> Niedermoor</div>
          <div><i style={{ background: '#803446' }} /> Hochmoor</div>
          <div><i style={{ background: '#5fa8c4' }} /> Auswahl</div>
          <div><i style={{ background: '#3e8a4c' }} /> Meine Flächen</div>
        </div>

        {zoom < MIN_PARCEL_ZOOM && !drawing && (
          <div className="map-hint">
            Zoomstufe {zoom}: Zoomen Sie auf <b>{MIN_PARCEL_ZOOM}+</b> oder klicken Sie eine Moorregion an, um wählbare Flurstücke zu sehen.
          </div>
        )}
        {drawing && <div className="map-hint draw">Klicken Sie die Eckpunkte Ihrer Fläche in die Karte, dann „Fertig“.</div>}

        {hover && (
          <div className="hover-card">
            <div className="row between align-center" style={{ marginBottom: 2 }}>
              <b>Flurstück {hover.label}</b>
              {hover.isAlkis && (
                <span className="badge gruen small enterprise-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Database size={10} /> Amtlich erfasst (BW)
                </span>
              )}
            </div>
            {hover.alkis?.flurstueckskennzeichen && (
              <div className="code-cell" style={{ fontSize: '0.74rem', marginBottom: 2 }}>
                {hover.alkis.flurstueckskennzeichen}
              </div>
            )}
            <div>{hover.gemarkung} · {BUNDESLAENDER[hover.bundesland].name}</div>
            <div>{nf(hover.areaHa, 2)} ha · {moorLabel[hover.moorType]}{hover.moorType !== 'mineral' && ` · ${hover.peatDepthCm} cm Torf`}</div>
          </div>
        )}
      </div>

      <aside className="map-panel">
        <Tabs value={tab} onChange={setTab} items={[{ id: 'meine', label: `Meine Flächen (${state.myParcels.length})` }, { id: 'auswahl', label: `Auswahl (${selected.length})` }]} />

        {tab === 'auswahl' && (
          <div className="panel-body">
            {selected.length === 0 ? (
              <div className="stack">
                <p className="muted">Klicken Sie Flurstücke in der Karte an, um sie auszuwählen. Mehrere Flurstücke können kombiniert werden.</p>
                <h4>Moorregionen entdecken</h4>
                <div className="chips">
                  {MOOR_REGIONS.map((r) => (
                    <button key={r.id} className="chip" onClick={() => mapRef.current?.flyTo(r.center, 13, { duration: 1.2 })}>{r.name}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="stack">
                <div className="sel-summary">
                  <div><span className="big">{nf(totals.ha, 1)}</span> ha gesamt</div>
                  <div><span className="big">{nf(totals.moorHa, 1)}</span> ha Moor</div>
                  <div><span className="big">{nf(totals.em, 0)}</span> t CO₂e/a heute</div>
                  <div><span className="big good">−{nf(totals.saving, 0)}</span> t CO₂e/a möglich</div>
                </div>
                {totals.moorHa === 0 && <div className="note warn">Keine Moorfläche in der Auswahl – Wiedervernässung und Paludikultur sind hier nicht sinnvoll.</div>}
                <div className="list">
                  {selected.map((p) => (
                    <div key={p.id} className="parcel-card">
                      <div className="row between align-center">
                        <div>
                          <b>{p.label}</b>
                          {p.isAlkis && (
                            <span className="badge gruen small enterprise-badge" style={{ marginLeft: 6 }}>
                              Amtlich erfasst (BW)
                            </span>
                          )}
                        </div>
                        <button className="icon-btn" title="Aus Auswahl entfernen" onClick={() => toggle(p)}><X size={15} /></button>
                      </div>
                      {p.alkis?.flurstueckskennzeichen && (
                        <div className="code-cell" style={{ fontSize: '0.74rem' }}>{p.alkis.flurstueckskennzeichen}</div>
                      )}
                      <div className="muted">{p.gemarkung} · {BUNDESLAENDER[p.bundesland].name}</div>
                      <div className="row gap wrap">
                        <Badge tone={moorTone(p.moorType)}>{moorLabel[p.moorType]}</Badge>
                        <Badge>{nf(p.areaHa, 2)} ha</Badge>
                        {p.moorType !== 'mineral' && <Badge>{p.peatDepthCm} cm Torf</Badge>}
                      </div>
                      <div className="kv">
                        <span>Nutzung</span><b>{landUseLabel(p.landUse)}</b>
                        {p.moorType !== 'mineral' && (<><span>Wasserstand heute</span><b>{p.waterLevelCm} cm unter Flur</b></>)}
                        <span>Entwässerung</span><b>{p.drainage === 'drainage' ? 'Dränage' : p.drainage === 'graeben' ? 'Gräben' : 'keine'}</b>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="stack gap-s">
                  <button className="btn primary" onClick={toPlanner}><DraftingCompass size={16} /> Im Planer analysieren</button>
                  <button className="btn" onClick={saveSelected}>Zu „Meine Flächen“ hinzufügen</button>
                  <button className="btn ghost" onClick={() => setSelected([])}>Auswahl leeren</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'meine' && (
          <div className="panel-body">
            {state.myParcels.length === 0 ? (
              <p className="muted">Noch keine Flächen gespeichert. Wählen Sie Flurstücke aus und fügen Sie sie zu „Meine Flächen“ hinzu – oder laden Sie links den Demobetrieb.</p>
            ) : (
              <div className="stack">
                <div className="list">
                  {state.myParcels.map((p) => (
                    <div key={p.id} className="parcel-card">
                      <div className="row between align-center">
                        <div>
                          <b>{p.label}</b>
                          {p.isAlkis && (
                            <span className="badge gruen small enterprise-badge" style={{ marginLeft: 6 }}>
                              Amtlich erfasst (BW)
                            </span>
                          )}
                        </div>
                        <div className="row gap-s">
                          <button className="icon-btn" title="Auf Karte zeigen" onClick={() => flyToParcel(p)}><Crosshair size={15} /></button>
                          <button className="icon-btn" title="Entfernen" onClick={() => removeParcel(p.id)}><Trash2 size={15} /></button>
                        </div>
                      </div>
                      {p.alkis?.flurstueckskennzeichen && (
                        <div className="code-cell" style={{ fontSize: '0.74rem' }}>{p.alkis.flurstueckskennzeichen}</div>
                      )}
                      <div className="muted">{p.gemarkung} · {nf(p.areaHa, 2)} ha</div>
                      {p.moorType !== 'mineral' && (
                        <div className="kv">
                          <span>Torf</span><b>{p.peatDepthCm} cm</b>
                          <span>Wasserstand heute</span><b>{p.waterLevelCm} cm unter Flur</b>
                        </div>
                      )}
                      <div className="row gap wrap">
                        <Badge tone={moorTone(p.moorType)}>{moorLabel[p.moorType]}</Badge>
                        <select className="mini-select" value={p.tenure ?? 'eigentum'} onChange={(e) => updateParcel(p.id, { tenure: e.target.value as 'eigentum' | 'pacht' })}>
                          <option value="eigentum">Eigentum</option>
                          <option value="pacht">Pacht</option>
                        </select>
                        {selected.some((s) => s.id === p.id) && <Badge tone="blau">ausgewählt</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn primary" onClick={() => { setDraft({ parcelIds: state.myParcels.filter((p) => p.moorType !== 'mineral').map((p) => p.id) }); nav('/planer'); }}>
                  Alle Moorflächen im Planer öffnen
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
