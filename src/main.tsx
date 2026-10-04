import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './lib/store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import Planner from './pages/Planner';
import Funding from './pages/Funding';
import Operations from './pages/Operations';
import Machines from './pages/Machines';
import Products from './pages/Products';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="karte" element={<MapPage />} />
            <Route path="planer" element={<Planner />} />
            <Route path="foerderung" element={<Funding />} />
            <Route path="betrieb" element={<Operations />} />
            <Route path="maschinen" element={<Machines />} />
            <Route path="produkte" element={<Products />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  </React.StrictMode>,
);
