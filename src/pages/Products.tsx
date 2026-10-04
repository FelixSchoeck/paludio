import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { uid, useStore } from '../lib/store';
import { PRICE_BENCHMARK, PRODUCT_CATEGORIES, productCategory } from '../lib/market';
import { CROPS, cropById } from '../lib/crops';
import { haversineKm } from '../lib/geo';
import type { Inquiry, Listing, ListingType } from '../lib/types';
import { Badge, Empty, Field, Modal, PageHeader, Tabs, eur, fdate, nf } from '../components/ui';
import {
  ProductIcon,
  Package,
  Search,
  ShoppingBag,
  Info,
} from '../components/Icons';

export default function Products() {
  const { state, addListing, removeListing, addInquiry, say } = useStore();
  const [sp, setSp] = useSearchParams();
  const cat = sp.get('cat') ?? 'alle';
  const tabType = (sp.get('tab') as ListingType) ?? 'angebot';
  const [activeTab, setActiveTab] = useState<'markt' | 'meine' | 'inserieren'>('markt');
  const [q, setQ] = useState('');
  const [selectedCrop, setSelectedCrop] = useState<string>('alle');
  const [detailListing, setDetailListing] = useState<Listing | null>(null);
  const [inquiryModal, setInquiryModal] = useState<Listing | null>(null);

  // Aktive Kultur aus Projekt oder Plan für automatisches Matching
  const myCrop = useMemo(() => {
    const pr = state.projects[0];
    const draft = pr ? state.plans.find((p) => p.id === pr.planId)?.draft : state.draft;
    return cropById(draft?.cropId ?? '');
  }, [state.projects, state.plans, state.draft]);

  const filteredListings = useMemo(() => {
    return state.listings
      .filter((l) => l.type === tabType)
      .filter((l) => (cat === 'alle' || l.category === cat))
      .filter((l) => (selectedCrop === 'alle' || l.cropId === selectedCrop))
      .filter((l) => {
        if (!q) return true;
        const text = `${l.title} ${l.description} ${l.region} ${l.owner} ${l.quality}`.toLowerCase();
        return text.includes(q.toLowerCase());
      })
      .map((l) => ({
        listing: l,
        dist: haversineKm(state.farm.location, l.location),
      }))
      .sort((a, b) => new Date(b.listing.createdAt).getTime() - new Date(a.listing.createdAt).getTime());
  }, [state.listings, tabType, cat, selectedCrop, q, state.farm.location]);

  const myListings = useMemo(() => {
    return state.listings.filter((l) => l.own);
  }, [state.listings]);

  // Passende Gesuche zu meiner Ernte
  const matchedDemands = useMemo(() => {
    if (!myCrop) return [];
    return state.listings.filter((l) => l.type === 'gesuch' && l.cropId === myCrop.id);
  }, [state.listings, myCrop]);

  return (
    <div className="page">
      <PageHeader
        title="Produktmarkt für Paludikultur"
        sub="Rohstoffe und Produkte aus nassen Moorböden vermarkten oder beziehen – von Rohrkolben-Dämmstoffen über Reet und Torfmoos bis zu regionalen Moor-Zertifikaten."
      />

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'markt', label: 'Marktplatz durchstöbern' },
          { id: 'meine', label: `Meine Inserate & Anfragen (${myListings.length + state.inquiries.length})` },
          { id: 'inserieren', label: '＋ Inserat erstellen' },
        ]}
      />

      {activeTab === 'markt' && (
        <>
          {myCrop && matchedDemands.length > 0 && (
            <div className="note" style={{ marginBottom: 16 }}>
              <Info size={16} className="icon-inline" /> <b>Abnehmer für Ihren Betrieb gefunden:</b> Es gibt aktuell {matchedDemands.length} aktive Gesuche für Ihre Kultur <b>{myCrop.name}</b>.
              <button
                className="btn small"
                style={{ marginLeft: 12 }}
                onClick={() => {
                  setSp({ tab: 'gesuch', cat: myCrop.productCategory });
                  setSelectedCrop(myCrop.id);
                }}
              >
                Zu den Gesuchen ({matchedDemands.length})
              </button>
            </div>
          )}

          <div className="row between wrap gap" style={{ marginBottom: 16 }}>
            <div className="seg">
              <button
                className={tabType === 'angebot' ? 'on' : ''}
                onClick={() => setSp((prev) => { prev.set('tab', 'angebot'); return prev; })}
              >
                <Package size={15} className="icon-inline" /> Angebote (Verkauf)
              </button>
              <button
                className={tabType === 'gesuch' ? 'on' : ''}
                onClick={() => setSp((prev) => { prev.set('tab', 'gesuch'); return prev; })}
              >
                <Search size={15} className="icon-inline" /> Gesuche (Abnehmer / Ankauf)
              </button>
            </div>

            <div className="row gap">
              <select
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
                aria-label="Kultur filtern"
              >
                <option value="alle">Alle Kulturen</option>
                {CROPS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="chips">
            <button
              className={`chip ${cat === 'alle' ? 'on' : ''}`}
              onClick={() => setSp((prev) => { prev.delete('cat'); return prev; })}
            >
              Alle Kategorien
            </button>
            {PRODUCT_CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`chip ${cat === c.id ? 'on' : ''}`}
                onClick={() => setSp((prev) => { prev.set('cat', c.id); return prev; })}
              >
                <ProductIcon category={c.id} size={15} className="icon-inline" /> {c.label}
              </button>
            ))}
          </div>

          <div className="card filters" style={{ marginTop: 12 }}>
            <Field label="Stichwortsuche">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Titel, Beschreibung, Region, Qualität..."
              />
            </Field>
          </div>

          <div className="muted small" style={{ margin: '12px 0' }}>
            {filteredListings.length} {tabType === 'angebot' ? 'Angebote' : 'Gesuche'} gefunden.
          </div>

          {filteredListings.length === 0 && (
            <Empty icon={<ShoppingBag size={36} />} title={`Keine ${tabType === 'angebot' ? 'Angebote' : 'Gesuche'} vorhanden`}>
              Passen Sie den Suchfilter oder die Kategorie an. Sie können auch selbst ein Inserat anlegen!
            </Empty>
          )}

          <div className="product-grid">
            {filteredListings.map(({ listing: l, dist }) => {
              const pCat = productCategory(l.category);
              const crop = l.cropId ? cropById(l.cropId) : null;
              const benchmark = PRICE_BENCHMARK[l.category];
              const isMatchWithFarm = myCrop && l.cropId === myCrop.id;

              return (
                <article key={l.id} className="card product-card">
                  <div className="row between">
                    <span className="p-cat-ic"><ProductIcon category={l.category} size={22} /></span>
                    <div className="row gap-s">
                      {isMatchWithFarm && <Badge tone="gruen">Passend zu Ihrer Kultur</Badge>}
                      <Badge tone={l.type === 'angebot' ? 'blau' : 'braun'}>
                        {l.type === 'angebot' ? 'Angebot' : 'Gesuch'}
                      </Badge>
                      {l.own && <Badge tone="blau">Mein Inserat</Badge>}
                    </div>
                  </div>

                  <h3>{l.title}</h3>
                  <div className="muted small">
                    {l.owner} · {l.region} ({nf(dist, 0)} km)
                  </div>

                  <p className="product-desc">{l.description}</p>

                  <div className="kv" style={{ margin: '12px 0' }}>
                    <span>Menge:</span>
                    <b>{nf(l.quantity)} {l.unit}</b>
                    <span>Preis:</span>
                    <b>{eur(l.pricePerUnit)} / {l.unit}</b>
                    <span>Qualität:</span>
                    <span>{l.quality}</span>
                    <span>Verfügbar ab:</span>
                    <span>{fdate(l.availableFrom)}</span>
                  </div>

                  {benchmark && (
                    <div className="price-benchmark-bar">
                      <div className="muted small">
                        Markt-Richtwert: ca. {eur(benchmark)} / {pCat?.unit ?? l.unit}
                      </div>
                    </div>
                  )}

                  <div className="row between end" style={{ marginTop: 14 }}>
                    <button
                      className="btn small"
                      onClick={() => setDetailListing(l)}
                    >
                      Details
                    </button>
                    {!l.own ? (
                      <button
                        className="btn small primary"
                        onClick={() => setInquiryModal(l)}
                      >
                        {l.type === 'angebot' ? 'Kauf anfragen' : 'Angebot unterbreiten'}
                      </button>
                    ) : (
                      <button
                        className="btn small ghost"
                        onClick={() => {
                          removeListing(l.id);
                          say('Inserat gelöscht');
                        }}
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'meine' && (
        <div className="stack">
          <h3>Eigene Inserate ({myListings.length})</h3>
          {myListings.length === 0 ? (
            <p className="muted">Sie haben noch keine eigenen Produkte oder Gesuche inseriert.</p>
          ) : (
            <div className="list">
              {myListings.map((l) => (
                <div key={l.id} className="card row between wrap">
                  <div>
                    <div className="row gap-s">
                      <Badge tone={l.type === 'angebot' ? 'blau' : 'braun'}>
                        {l.type === 'angebot' ? 'Angebot' : 'Gesuch'}
                      </Badge>
                      <b>{l.title}</b>
                    </div>
                    <div className="muted small">
                      {nf(l.quantity)} {l.unit} · {eur(l.pricePerUnit)} / {l.unit} · {l.region} · Erstellt {fdate(l.createdAt)}
                    </div>
                  </div>
                  <div className="row gap-s">
                    <button className="btn small" onClick={() => setDetailListing(l)}>Details</button>
                    <button
                      className="btn small ghost"
                      onClick={() => {
                        removeListing(l.id);
                        say('Inserat entfernt');
                      }}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ marginTop: 24 }}>Gesendete Anfragen ({state.inquiries.length})</h3>
          {state.inquiries.length === 0 ? (
            <p className="muted">Noch keine Anfragen an andere Marktplatz-Teilnehmer gestellt.</p>
          ) : (
            <div className="list">
              {state.inquiries.map((inq) => (
                <div key={inq.id} className="card row between wrap">
                  <div>
                    <b>Anfrage zu: {inq.listingTitle}</b>
                    <div className="muted small">
                      Angefragte Menge: {nf(inq.quantity)} · Gesendet am {fdate(inq.createdAt)}
                    </div>
                    {inq.message && <div className="small" style={{ marginTop: 4 }}>„{inq.message}“</div>}
                  </div>
                  <Badge tone="gruen">Übermittelt (Kontakt hergestellt)</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'inserieren' && (
        <CreateListingForm
          farmLocation={state.farm.location}
          farmLocationName={state.farm.locationName}
          farmName={state.farm.name || 'Mein Betrieb'}
          onCreated={(newListing) => {
            addListing(newListing);
            say('Inserat erfolgreich veröffentlicht!');
            setActiveTab('meine');
          }}
        />
      )}

      {detailListing && (
        <Modal
          title={detailListing.title}
          onClose={() => setDetailListing(null)}
          footer={
            <div className="row between grow">
              <div>
                <span className="muted small">Preis: </span>
                <b className="price">{eur(detailListing.pricePerUnit)} / {detailListing.unit}</b>
              </div>
              {!detailListing.own ? (
                <button
                  className="btn primary"
                  onClick={() => {
                    const l = detailListing;
                    setDetailListing(null);
                    setInquiryModal(l);
                  }}
                >
                  {detailListing.type === 'angebot' ? 'Jetzt anfragen' : 'Angebot machen'}
                </button>
              ) : (
                <button className="btn" onClick={() => setDetailListing(null)}>Schließen</button>
              )}
            </div>
          }
        >
          <div className="stack">
            <div className="row gap wrap">
              <Badge tone={detailListing.type === 'angebot' ? 'blau' : 'braun'}>
                {detailListing.type === 'angebot' ? 'Verkaufsangebot' : 'Kaufgesuch'}
              </Badge>
              <Badge>{productCategory(detailListing.category)?.label}</Badge>
              {detailListing.cropId && <Badge tone="gruen">{cropById(detailListing.cropId)?.name}</Badge>}
            </div>

            <p>{detailListing.description}</p>

            <div className="kv wide">
              <span>Anbieter/Nachfrager:</span><b>{detailListing.owner}</b>
              <span>Region:</span><b>{detailListing.region}</b>
              <span>Gesamtmenge:</span><b>{nf(detailListing.quantity)} {detailListing.unit}</b>
              <span>Preisvorstellung:</span><b>{eur(detailListing.pricePerUnit)} / {detailListing.unit}</b>
              <span>Qualitätsstufe:</span><b>{detailListing.quality}</b>
              <span>Verfügbarkeitsdatum:</span><b>{fdate(detailListing.availableFrom)}</b>
            </div>

            <div className="note">
              <b>Logistik-Hinweis:</b> Bei Schüttgütern und Faserstoffen (Rohrkolben, Schilf) empfiehlt sich eine Bündelung über regionale Umschlagplätze oder Maschinenringe zur Senkung der Transportkosten.
            </div>
          </div>
        </Modal>
      )}

      {inquiryModal && (
        <InquiryModal
          listing={inquiryModal}
          onClose={() => setInquiryModal(null)}
          onSubmit={(inq) => {
            addInquiry(inq);
            setInquiryModal(null);
            say('Ihre Anfrage wurde direkt an den Anbieter übermittelt!');
            setActiveTab('meine');
          }}
        />
      )}
    </div>
  );
}

function InquiryModal({
  listing,
  onClose,
  onSubmit,
}: {
  listing: Listing;
  onClose: () => void;
  onSubmit: (i: Inquiry) => void;
}) {
  const [qty, setQty] = useState(listing.quantity > 50 ? 20 : listing.quantity);
  const [msg, setMsg] = useState('');

  return (
    <Modal
      title={`${listing.type === 'angebot' ? 'Kaufanfrage' : 'Angebot abgeben'}: ${listing.title}`}
      onClose={onClose}
      footer={
        <div className="row between grow">
          <button className="btn ghost" onClick={onClose}>Abbrechen</button>
          <button
            className="btn primary"
            disabled={qty <= 0}
            onClick={() => onSubmit({
              id: uid('inq'),
              listingId: listing.id,
              listingTitle: listing.title,
              quantity: qty,
              message: msg,
              createdAt: new Date().toISOString(),
            })}
          >
            Nachricht absenden
          </button>
        </div>
      }
    >
      <div className="stack">
        <p className="muted">
          Kontaktieren Sie <b>{listing.owner}</b> bezüglich {listing.title}. Vereinbaren Sie Lieferkonditionen, Bemusterung oder Zahlungsmodalitäten.
        </p>

        <div className="form-grid">
          <Field label={`Gewünschte Menge (${listing.unit})`}>
            <input
              type="number"
              min={1}
              max={listing.quantity * 2}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </Field>
          <Field label="Geschätzter Gesamtwert (Orientierung)">
            <input
              type="text"
              readOnly
              value={eur(qty * listing.pricePerUnit)}
              className="readonly-input"
            />
          </Field>
        </div>

        <Field label="Nachricht / Lieferkonditionen / Rückfragen">
          <textarea
            rows={4}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="z. B. Abholung ab Hof oder Anlieferung gewünscht, Qualitätsanforderungen, Prüfmuster..."
          />
        </Field>
      </div>
    </Modal>
  );
}

function CreateListingForm({
  farmLocation,
  farmLocationName,
  farmName,
  onCreated,
}: {
  farmLocation: [number, number];
  farmLocationName: string;
  farmName: string;
  onCreated: (l: Listing) => void;
}) {
  const [type, setType] = useState<ListingType>('angebot');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0].id);
  const [cropId, setCropId] = useState('rohrkolben');
  const [quantity, setQuantity] = useState(25);
  const [pricePerUnit, setPricePerUnit] = useState(150);
  const [quality, setQuality] = useState('Standardqualität, getrocknet');
  const [description, setDescription] = useState('');
  const [availableFrom, setAvailableFrom] = useState(new Date().toISOString().slice(0, 10));

  const pCat = productCategory(category);
  const valid = title.trim().length >= 4 && quantity > 0 && pricePerUnit > 0;

  return (
    <section className="card" style={{ maxWidth: 800 }}>
      <h3>Neues Inserat aufgeben</h3>
      <p className="muted">
        Bieten Sie Ihre Paludi-Ernte oder Produkte an oder stellen Sie ein Gesuch ein, wenn Sie Biomasse oder Rohstoffe für Ihre Weiterverarbeitung suchen.
      </p>

      <div className="form-grid">
        <Field label="Inserat-Typ">
          <select value={type} onChange={(e) => setType(e.target.value as ListingType)}>
            <option value="angebot">Verkaufsangebot (Ich biete ein Produkt an)</option>
            <option value="gesuch">Kaufgesuch (Ich suche ein Produkt / Abnehmerbedarf)</option>
          </select>
        </Field>

        <Field label="Kategorie">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              const bm = PRICE_BENCHMARK[e.target.value];
              if (bm) setPricePerUnit(bm);
            }}
          >
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Titel des Inserats">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Rohrkolben-Ballen 1. Schnitt, trocken"
          />
        </Field>

        <Field label="Zugehörige Paludikultur">
          <select value={cropId} onChange={(e) => setCropId(e.target.value)}>
            <option value="">Keine direkte Kulturzuordnung</option>
            {CROPS.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label={`Menge (${pCat?.unit ?? 'Einheiten'})`}>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </Field>

        <Field label={`Preisvorstellung (€ / ${pCat?.unit ?? 'Einheit'})`}>
          <input
            type="number"
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(Number(e.target.value))}
          />
        </Field>

        <Field label="Qualitätsbeschreibung">
          <input
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            placeholder="z. B. Trockenmasse >85 %, feingehäckselt, Bio-zertifiziert"
          />
        </Field>

        <Field label="Verfügbar ab">
          <input
            type="date"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
          />
        </Field>

        <Field label="Ausführliche Beschreibung" hint="Lieferbedingungen, Mindestabnahme, Verpackung...">
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beschreiben Sie Besonderheiten, Standortzufahrt für LKW, Lagerbedingungen..."
          />
        </Field>
      </div>

      <div className="row gap" style={{ marginTop: 18 }}>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={() => onCreated({
            id: uid('list'),
            type,
            title: title.trim(),
            category,
            cropId: cropId || undefined,
            quantity,
            unit: pCat?.unit ?? 't',
            pricePerUnit,
            region: farmLocationName,
            location: farmLocation,
            availableFrom,
            quality,
            description: description || 'Keine weitere Beschreibung.',
            owner: farmName,
            own: true,
            createdAt: new Date().toISOString(),
          })}
        >
          Inserat jetzt veröffentlichen
        </button>
      </div>
    </section>
  );
}
