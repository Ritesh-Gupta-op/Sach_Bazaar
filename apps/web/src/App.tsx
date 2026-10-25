import { Route, Routes, useLocation } from 'react-router-dom';
import { SearchPage } from './pages/SearchPage';
import { TracePage } from './pages/TracePage';
import { ConsolePage } from './pages/ConsolePage';
import { LandingPage } from './pages/LandingPage';
import { FloatingNav } from './components/FloatingNav';
import { GrainOverlay } from './components/GrainOverlay';

export function App() {
  const isLanding = useLocation().pathname === '/';
  return (
    <div className={`mx-auto px-4 py-6 ${isLanding ? 'max-w-7xl px-0 sm:px-0' : 'max-w-4xl pt-24'}`}>
      <FloatingNav />
      <GrainOverlay />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/trace" element={<SearchPage />} />
        <Route path="/trace/:batchId" element={<TracePage />} />
        <Route path="/console" element={<ConsolePage />} />
      </Routes>
      <footer className="mt-16 border-t border-stone-200 px-6 pt-4 pb-6 text-center text-xs text-stone-400">
        Hashes anchor on-chain; photos and personal data stay off-chain. Verification recomputes every record hash.
      </footer>
    </div>
  );
}
