import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import FarmerOnboarding from './FarmerOnboarding';
import { Wordmark } from './Logo';
import {
  Home,
  Map,
  ChartLine,
  Euro,
  Activity,
  ShoppingBag,
  Building2,
  Sparkles,
  RotateCcw,
  Search,
  ChevronsUpDown,
} from './Icons';

const NAV_GROUPS = [
  {
    label: null,
    items: [{ to: '/', label: 'Cockpit', icon: Home, end: true, also: [] as string[] }],
  },
  {
    label: 'Ihr Projekt',
    items: [
      { to: '/karte', label: 'Flächen', icon: Map, also: [] as string[] },
      { to: '/planer', label: 'Planer', icon: ChartLine, also: [] as string[] },
      { to: '/foerderung', label: 'Förderung', icon: Euro, also: [] as string[] },
      { to: '/betrieb', label: 'Betrieb', icon: Activity, also: [] as string[] },
    ],
  },
  {
    label: 'Handel',
    items: [{ to: '/maschinen', label: 'Marktplatz', icon: ShoppingBag, also: ['/produkte'] }],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Cockpit',
  '/karte': 'Flächen',
  '/planer': 'Planer',
  '/foerderung': 'Förderung',
  '/betrieb': 'Betrieb',
  '/maschinen': 'Marktplatz',
  '/produkte': 'Marktplatz',
};

function initials(name?: string) {
  if (!name) return 'B';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'B';
}

export default function Layout() {
  const { state, toast, loadBwDemo, reset } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const [showManualOnboarding, setShowManualOnboarding] = useState(false);
  const [farmMenu, setFarmMenu] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => setFarmMenu(false), [loc.pathname]);

  // If farmer is not onboarded yet, show onboarding first
  const showOnboarding = !state.onboarded || showManualOnboarding;

  const hasAlkis = state.myParcels.some((p) => p.isAlkis);
  const openApplications = state.applications.filter((a) => a.status === 'entwurf').length;
  const farmName = state.farm.name || 'Betrieb einrichten';
  const pageTitle = PAGE_TITLES[loc.pathname] ?? 'Paludio';

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    nav(q ? `/?q=${encodeURIComponent(q)}` : '/');
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <Wordmark />
        </Link>

        <button
          type="button"
          className="farm-switch"
          aria-expanded={farmMenu}
          aria-haspopup="menu"
          onClick={() => setFarmMenu((v) => !v)}
        >
          <span className="farm-avatar">{farmName.slice(0, 1).toUpperCase()}</span>
          <span className="farm-text">
            <span className="farm-name">{farmName}</span>
            <span className="farm-sub">
              {state.farm.locationName || 'Deutschland'} · {state.myParcels.length} {state.myParcels.length === 1 ? 'Fläche' : 'Flächen'}
            </span>
          </span>
          <ChevronsUpDown size={16} className="muted" />
        </button>

        {farmMenu && (
          <div className="farm-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setFarmMenu(false); setShowManualOnboarding(true); }}>
              <Building2 size={15} /> Betriebsdaten bearbeiten
            </button>
            <button type="button" role="menuitem" onClick={() => { setFarmMenu(false); loadBwDemo(); }}>
              <Sparkles size={15} /> Musterbetrieb BW laden
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setFarmMenu(false);
                if (window.confirm('Möchten Sie alle Betriebs- und Katasterdaten zurücksetzen? Danach startet das Onboarding erneut.')) reset();
              }}
            >
              <RotateCcw size={15} /> Zurücksetzen
            </button>
          </div>
        )}

        <nav aria-label="Hauptnavigation">
          {NAV_GROUPS.map((g, gi) => (
            <div key={gi} className="nav-group">
              {g.label && <span className="nav-group-label">{g.label}</span>}
              {g.items.map((n) => {
                const Icon = n.icon;
                const alsoActive = n.also.some((p) => loc.pathname.startsWith(p));
                return (
                  <NavLink key={n.to} to={n.to} end={'end' in n ? n.end : undefined} className={({ isActive }) => (isActive || alsoActive ? 'nav on' : 'nav')}>
                    <span className="nav-ic"><Icon size={18} strokeWidth={1.8} /></span>
                    {n.label}
                    {n.to === '/foerderung' && openApplications > 0 && <span className="nav-count">{openApplications}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <span className="side-foot-title">
            <span className={hasAlkis ? 'dot' : 'dot off'} />
            {hasAlkis ? 'Amtliche Katasterdaten' : 'Kataster-Modell'}
          </span>
          <span className="side-foot-sub">
            {hasAlkis ? 'LGL Baden-Württemberg · Stand Q1/2026' : 'Amtliche Daten derzeit nur für Baden-Württemberg'}
          </span>
          <span className="proto-pill">Prototyp</span>
          <span className="side-foot-sub">
            Förder-, Markt- und Pegeldaten sind Beispielwerte. Vor echten Anträgen bei der zuständigen Stelle prüfen.
          </span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="crumbs">
            {state.farm.name ? <>{state.farm.name} <span aria-hidden>/</span> </> : null}
            <b>{pageTitle}</b>
          </span>
          <form className="top-search" role="search" onSubmit={submitSearch}>
            <Search size={16} />
            <label className="vh" htmlFor="top-search">Flurstücke suchen</label>
            <input
              id="top-search"
              type="search"
              placeholder="Flurstück, Kennzeichen oder Gemarkung"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
          <span className="top-avatar" title={state.farm.owner || undefined} aria-label={state.farm.owner ? `Angemeldet: ${state.farm.owner}` : undefined}>
            {initials(state.farm.owner)}
          </span>
        </header>
        <Outlet />
      </main>

      {/* Onboarding Wizard (Always shown first if not onboarded) */}
      {showOnboarding && (
        <FarmerOnboarding onClose={() => setShowManualOnboarding(false)} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
