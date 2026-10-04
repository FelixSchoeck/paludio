import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import FarmerOnboarding from './FarmerOnboarding';
import {
  Home,
  Map,
  DraftingCompass,
  Euro,
  Activity,
  Tractor,
  ShoppingBag,
  Building2,
  Database,
  Sparkles,
  RotateCcw,
} from './Icons';

const NAV = [
  { to: '/', label: 'Cockpit & Übersicht', icon: Home, end: true },
  { to: '/karte', label: 'Karte & Flurstücke', icon: Map },
  { to: '/planer', label: 'Planer & Szenarien', icon: DraftingCompass },
  { to: '/foerderung', label: 'Förderassistent', icon: Euro },
  { to: '/betrieb', label: 'Betrieb & Pegel', icon: Activity },
  { to: '/maschinen', label: 'Maschinenmarkt', icon: Tractor },
  { to: '/produkte', label: 'Produktmarkt', icon: ShoppingBag },
];

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={{ borderRadius: 0 }}>
      <rect width="64" height="64" fill="#241a12" />
      <path d="M8 42c6-3 10-3 16 0s10 3 16 0 8-2 16-1v15H8z" fill="#1e6b8a" />
      <path d="M22 42V18M22 18c-3 2-4 5-4 8M22 18c3 2 4 5 4 8" stroke="#528a47" strokeWidth="3" strokeLinecap="square" fill="none" />
      <path d="M40 42V12" stroke="#b08a45" strokeWidth="3.5" strokeLinecap="square" />
      <rect x="36.5" y="16" width="7" height="15" fill="#805426" />
    </svg>
  );
}

export default function Layout() {
  const { state, toast, loadBwDemo, reset } = useStore();
  const nav = useNavigate();
  const [showManualOnboarding, setShowManualOnboarding] = useState(false);

  // If farmer is not onboarded yet, show onboarding first
  const showOnboarding = !state.onboarded || showManualOnboarding;

  const hasAlkis = state.myParcels.some((p) => p.isAlkis) || state.farm.locationName?.includes('BW');

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand" onClick={() => nav('/')}>
          <Logo />
          <div>
            <div className="brand-name">Paludio</div>
            <div className="brand-sub">Enterprise Moor-Kataster & ERP</div>
          </div>
        </div>

        <nav>
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'nav on' : 'nav')}>
                <span className="nav-ic"><Icon size={18} /></span>
                {n.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="side-foot">
          <div className="farm-chip" style={{ borderRadius: 0 }}>
            <div className="farm-avatar" style={{ borderRadius: 0 }}>{(state.farm.name || 'B').slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="farm-name">{state.farm.name || 'Betrieb nicht konfiguriert'}</div>
              <div className="farm-sub">
                {state.myParcels.length} Fläche(n) · {state.farm.locationName || 'Deutschland'}
              </div>
              {hasAlkis && (
                <div style={{ marginTop: 4 }}>
                  <span className="badge gruen small enterprise-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Database size={10} /> AMTLICHE KATASTERDATEN
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            className="btn small primary"
            style={{ width: '100%', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => setShowManualOnboarding(true)}
          >
            <Building2 size={14} /> Betriebs-Onboarding
          </button>

          <button
            className="btn ghost small"
            style={{ width: '100%', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={loadBwDemo}
          >
            <Sparkles size={14} /> Musterbetrieb BW laden
          </button>

          <button
            className="btn ghost small"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => window.confirm('Möchten Sie alle Betriebs- und Katasterdaten zurücksetzen? Danach startet das Onboarding erneut.') && reset()}
          >
            <RotateCcw size={14} /> Zurücksetzen
          </button>

          <div className="proto-note">
            Baden-Württemberg: Amtliche Vermessungsdaten aktiv · Andere Länder: Kataster-Modell
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      {/* Onboarding Wizard (Always shown first if not onboarded) */}
      {showOnboarding && (
        <FarmerOnboarding onClose={() => setShowManualOnboarding(false)} />
      )}

      {toast && <div className="toast" role="status" style={{ borderRadius: 0 }}>{toast}</div>}
    </div>
  );
}
