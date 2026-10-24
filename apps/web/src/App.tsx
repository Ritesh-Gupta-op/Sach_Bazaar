import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { SearchPage } from './pages/SearchPage';
import { TracePage } from './pages/TracePage';
import { ConsolePage } from './pages/ConsolePage';

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-full px-3 py-1 text-sm font-medium',
    isActive ? 'bg-orange-600 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-300',
  ].join(' ');

export function App() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold">
          <span className="text-2xl" aria-hidden>
            🍅
          </span>
          <span>Sach Bazaar</span>
          <span className="hidden text-sm font-normal text-stone-500 sm:inline">farm-to-mandi trace</span>
        </Link>
        <nav className="flex items-center gap-2">
          <NavLink to="/" end className={navClass}>
            Trace
          </NavLink>
          <NavLink to="/console" className={navClass}>
            Console
          </NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/trace/:batchId" element={<TracePage />} />
        <Route path="/console" element={<ConsolePage />} />
      </Routes>
      <footer className="mt-16 border-t border-stone-200 pt-4 text-center text-xs text-stone-400">
        Hashes anchor on-chain; photos and personal data stay off-chain. Verification recomputes every record hash.
      </footer>
    </div>
  );
}
