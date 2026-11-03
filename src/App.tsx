import { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { acronyms, flashcards } from './content';
import { requestPersistence } from './db/idb';
import { buildQueue } from './engine/queue';
import { DataProvider, useData } from './ui/data';
import { IconBook, IconCards, IconHome, IconMore, IconTarget } from './ui/icons';
import Home from './features/Home';
import Quick from './features/Quick';
import { ReviewHome, ReviewSession } from './features/review/Review';
import Train from './features/train/Train';
import QuizRunner from './features/train/QuizRunner';
import ExamRunner from './features/train/ExamRunner';
import Results from './features/train/Results';
import Daily from './features/train/Daily';
import { RefHome, RefSheet } from './features/ref/Reference';
import More from './features/more/More';
import Stats from './features/more/Stats';
import Backup from './features/more/Backup';
import Settings from './features/more/Settings';

const TABS = ['/', '/review', '/train', '/ref', '/more'];

function Nav() {
  const d = useData();
  const due = buildQueue({ deck: 'all', srs: d.srs, flashcards, acronyms, settings: d.settings }).due.length;
  return (
    <nav className="nav">
      <NavLink to="/" end><IconHome />Inicio</NavLink>
      <NavLink to="/review"><span className="icon-wrap"><IconCards />{due > 0 && <span className="badge-dot">{due > 99 ? '99+' : due}</span>}</span>Repasar</NavLink>
      <NavLink to="/train"><IconTarget />Entrenar</NavLink>
      <NavLink to="/ref"><IconBook />Fichas</NavLink>
      <NavLink to="/more"><IconMore />Más</NavLink>
    </nav>
  );
}

function UpdateToast() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="toast" role="status">
      <span className="small">Nueva versión disponible</span>
      <button className="btn sm primary" onClick={() => updateServiceWorker(true)}>Actualizar</button>
      <button className="btn sm ghost" onClick={() => setNeedRefresh(false)}>Luego</button>
    </div>
  );
}

function Shell() {
  const loc = useLocation();
  const isTab = TABS.includes(loc.pathname);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <>
      <main className={`app ${isTab ? '' : 'fullscreen'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quick" element={<Quick />} />
          <Route path="/review" element={<ReviewHome />} />
          <Route path="/review/:deck" element={<ReviewSession />} />
          <Route path="/train" element={<Train />} />
          <Route path="/train/daily" element={<Daily />} />
          <Route path="/train/quiz/:id" element={<QuizRunner />} />
          <Route path="/train/exam/:id" element={<ExamRunner />} />
          <Route path="/train/results/:id" element={<Results />} />
          <Route path="/ref" element={<RefHome />} />
          <Route path="/ref/:id" element={<RefSheet />} />
          <Route path="/more" element={<More />} />
          <Route path="/more/stats" element={<Stats />} />
          <Route path="/more/backup" element={<Backup />} />
          <Route path="/more/settings" element={<Settings />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      {isTab && <Nav />}
      <UpdateToast />
    </>
  );
}

export default function App() {
  useEffect(() => { requestPersistence(); }, []);
  return (
    <HashRouter>
      <DataProvider>
        <Shell />
      </DataProvider>
    </HashRouter>
  );
}
