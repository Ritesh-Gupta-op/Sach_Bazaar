import { Link, NavLink } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) => ['text-sm font-medium transition-colors', isActive ? 'text-ink' : 'text-muted hover:text-ink'].join(' ');

/**
 * Floating pill navigation: 70% white, 20px backdrop blur, coral logo dot,
 * dark pill CTA. Width is the viewport minus 32px on mobile.
 */
export function FloatingNav() {
  return (
    <nav className="fixed top-4 left-1/2 z-40 w-[calc(100%-32px)] max-w-xl -translate-x-1/2">
      <div className="flex items-center justify-between gap-3 rounded-full border border-white/60 bg-white/70 py-2 pr-2 pl-3 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] backdrop-blur-[20px]">
        <Link to="/" className="flex items-center gap-2">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-coral">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Sach Bazaar</span>
        </Link>
        <div className="hidden items-center gap-5 sm:flex">
          <NavLink to="/trace" className={linkClass}>
            Trace
          </NavLink>
          <NavLink to="/console" className={linkClass}>
            Console
          </NavLink>
          <a href="#faq" className="text-sm font-medium text-muted transition-colors hover:text-ink">
            FAQ
          </a>
        </div>
        <Link
          to="/console"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition-transform hover:scale-105"
        >
          Try demo
        </Link>
      </div>
    </nav>
  );
}
