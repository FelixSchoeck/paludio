import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import FarmerOnboarding from './FarmerOnboarding';
import {
  Home,
  Map,
  ChartLine,
  Euro,
  Activity,
  Tractor,
  ShoppingBag,
  Building2,
  Sparkles,
  RotateCcw,
  Search,
  ChevronsUpDown,
} from './Icons';

const NAV_GROUPS = [
  {
    label: 'Übersicht',
    items: [
      { to: '/', label: 'Cockpit', icon: Home, end: true },
      { to: '/karte', label: 'Karte & Flurstücke', icon: Map },
    ],
  },
  {
    label: 'Projekt',
    items: [
      { to: '/planer', label: 'Planer & Szenarien', icon: ChartLine },
      { to: '/foerderung', label: 'Förderung', icon: Euro },
      { to: '/betrieb', label: 'Betrieb & Pegel', icon: Activity },
    ],
  },
  {
    label: 'Märkte',
    items: [
      { to: '/maschinen', label: 'Maschinenmarkt', icon: Tractor },
      { to: '/produkte', label: 'Produktmarkt', icon: ShoppingBag },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Cockpit',
  '/karte': 'Karte & Flurstücke',
  '/planer': 'Planer & Szenarien',
  '/foerderung': 'Förderung',
  '/betrieb': 'Betrieb & Pegel',
  '/maschinen': 'Maschinenmarkt',
  '/produkte': 'Produktmarkt',
};

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#2e6a3b" />
      <path d="M8 44c6-3 10-3 16 0s10 3 16 0 8-2 16-1v13a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8z" fill="#5fa8c4" />
      <path d="M24 42V18M24 18c-3 2-4 5-4 8M24 18c3 2 4 5 4 8" stroke="#bfe3b4" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M41 42V13" stroke="#f1d9a8" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="37.5" y="16" width="7" height="14" rx="3.5" fill="#e2b76a" />
    </svg>
  );
}

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
          <Logo />
          <span>
            <div className="brand-name">Paludio</div>
            <div className="brand-sub">Moor &amp; Paludikultur</div>
          </span>
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
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="nav-group">
              <span className="nav-group-label">{g.label}</span>
              {g.items.map((n) => {
                const Icon = n.icon;
                return (
                  <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'nav on' : 'nav')}>
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
            {hasAlkis
              ? 'LGL Baden-Württemberg · Stand Q1/2026 · INVEKOS synchronisiert'
              : 'Amtliche Vermessungsdaten derzeit für Baden-Württemberg verfügbar'}
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
