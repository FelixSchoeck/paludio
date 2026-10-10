import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import Machines from './Machines';
import Products from './Products';

export default function Marketplace() {
  const loc = useLocation();
  const nav = useNavigate();
  const tab = loc.pathname.startsWith('/produkte') ? 'produkte' : 'maschinen';

  return (
    <div className="page">
      <PageHeader
        title="Marktplatz"
        sub={tab === 'maschinen'
          ? 'Spezialtechnik mit geringem Bodendruck leihen oder eigene Maschinen anbieten.'
          : 'Ernte und Produkte aus Paludikultur verkaufen oder Abnehmer finden.'}
        actions={
          <div className="seg" role="tablist" aria-label="Marktplatz-Bereich">
            <button role="tab" aria-selected={tab === 'maschinen'} className={tab === 'maschinen' ? 'on' : ''} onClick={() => nav('/maschinen')}>
              Maschinen
            </button>
            <button role="tab" aria-selected={tab === 'produkte'} className={tab === 'produkte' ? 'on' : ''} onClick={() => nav('/produkte')}>
              Produkte
            </button>
          </div>
        }
      />
      {tab === 'maschinen' ? <Machines /> : <Products />}
    </div>
  );
}
