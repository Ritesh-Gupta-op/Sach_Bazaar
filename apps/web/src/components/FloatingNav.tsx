import { Link, NavLink } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative text-sm font-medium transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315C43] focus-visible:ring-offset-4',
    isActive
      ? 'text-[#214B35]'
      : 'text-stone-500 hover:text-[#214B35]',
  ].join(' ');

export function FloatingNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed left-1/2 top-4 z-40 w-[calc(100%-24px)] max-w-3xl -translate-x-1/2 sm:top-5 sm:w-[calc(100%-40px)]"
    >
      <div className="flex items-center justify-between gap-3 rounded-full border border-[#E5E9DF] bg-[#FDFCF8]/95 py-2 pl-3 pr-2 shadow-[0_8px_30px_rgba(27,54,38,0.08)] backdrop-blur-xl sm:pl-4">
        {/* Brand */}
        <Link
          to="/"
          aria-label="Sach Bazaar home"
          className="group flex shrink-0 items-center gap-2.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#214B35] transition-transform duration-300 group-hover:rotate-[-6deg]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                d="M19.5 4.5C11 4.5 5 8 5 14a5 5 0 0 0 5 5c6 0 9.5-7 9.5-14.5Z"
                stroke="#FDFCF8"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 21c3-5 6.5-8 11-11"
                stroke="#FFB7B2"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>

          <span className="text-[15px] font-semibold tracking-[-0.5px] text-[#214B35] sm:text-base">
            Sach Bazaar
          </span>
        </Link>

        {/* Navigation links */}
        <div className="hidden items-center gap-6 md:flex">
          <NavLink to="/trace" className={linkClass}>
            Trace Produce
          </NavLink>

          <NavLink to="/console" className={linkClass}>
            Console
          </NavLink>

          <Link
            to="/#faq"
            className="text-sm font-medium text-stone-500 transition-colors duration-200 hover:text-[#214B35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315C43]"
          >
            FAQ
          </Link>
        </div>

        {/* Mobile trace link */}
        <NavLink
          to="/trace"
          className={({ isActive }) =>
            [
              'text-xs font-medium transition-colors md:hidden',
              isActive
                ? 'text-[#214B35]'
                : 'text-stone-500 hover:text-[#214B35]',
            ].join(' ')
          }
        >
          Trace
        </NavLink>

        {/* Primary CTA */}
        <Link
          to="/console"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#214B35] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#163D2B] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315C43] focus-visible:ring-offset-2 sm:px-5 sm:text-sm"
        >
          <span>Try demo</span>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              d="M4 10h12m-5-5 5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </nav>
  );
}