import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal';

/* ---------------------------------- Hero ---------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-40 pb-24 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-10 -left-24 h-80 w-80 rounded-full bg-coral-soft opacity-60 blur-3xl animate-float-slow" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-lavender-soft opacity-60 blur-3xl animate-float-slow [animation-delay:1.4s]" />
      </div>

      <Reveal>
        <p className="font-hand text-2xl text-coral">a gentler kind of proof</p>
        <h1 className="mx-auto max-w-3xl text-5xl leading-[1.05] font-semibold tracking-[-0.025em] sm:text-6xl md:text-[72px]">
          From farm gate to mandi, every hop{' '}
          <span className="font-hand text-coral text-[1.15em] font-normal">verifiable</span>
        </h1>
      </Reveal>
      <Reveal delay={150}>
        <p className="mx-auto mt-6 max-w-[500px] text-lg text-muted">
          Sach Bazaar anchors a tomato crate's journey on Polygon — dual-signed handovers, a hash chain anyone can
          recompute, and settlement that pays the farmer first. Nothing rushed, nothing hidden.
        </p>
      </Reveal>
      <Reveal delay={300}>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/trace"
            className="rounded-full bg-coral px-7 py-3.5 text-sm font-semibold text-ink shadow-[0_8px_30px_-6px_rgba(255,183,178,0.8)] transition-transform hover:scale-105"
          >
            Trace a batch
          </Link>
          <a
            href="#app"
            className="rounded-full border border-stone-200 bg-white px-7 py-3.5 text-sm font-semibold text-ink transition-transform hover:scale-105"
          >
            See the app
          </a>
        </div>
      </Reveal>
    </section>
  );
}

/* --------------------------- Scenario scroll ------------------------------ */

const SCENARIOS = [
  { time: '6:12 am', text: 'The co-op agent and buyer both sign batch #4127 into existence at the farm gate.' },
  { time: '9:47 am', text: 'The trucker picks up the crate — one tap, two signatures, one more link in the chain.' },
  { time: '2:05 pm', text: 'Cold storage receives it. The custody window is anchored, not asserted on paper.' },
  { time: '5:38 pm', text: 'A photo is graded by the advisory AI. Grade 2/4, no concerns — informational, never a gate.' },
  { time: '7:20 pm', text: 'Sold at mandi for ₹15/kg. Escrow splits instantly: the farmer takes 70%.' },
  { time: '7:20 pm', text: 'The buyer scans the crate sticker and watches the whole journey recompute — every hop ✓.' },
];

function ScenarioScroll() {
  return (
    <section id="scenarios" className="py-16">
      <Reveal>
        <div className="mb-6 flex items-end justify-between px-6">
          <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">One crate, one day</h2>
          <span className="font-hand text-xl text-muted">swipe →</span>
        </div>
      </Reveal>
      <Reveal delay={120}>
        <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2">
          {SCENARIOS.map((s) => (
            <article
              key={s.text}
              className="group flex h-40 w-72 shrink-0 snap-start flex-col justify-between rounded-3xl bg-white p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]"
            >
              <time className="text-sm text-stone-400">{s.time}</time>
              <p className="text-xl leading-snug font-medium text-stone-800 transition-colors group-hover:text-coral">
                {s.text}
              </p>
            </article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ----------------------------- App preview -------------------------------- */

function Phone({
  tone,
  className = '',
  children,
}: {
  tone: 'sage' | 'lavender' | 'white';
  className?: string;
  children?: ReactNode;
}) {
  const bg = tone === 'sage' ? 'bg-sage' : tone === 'lavender' ? 'bg-lavender' : 'bg-white';
  return (
    <div className={`flex flex-col overflow-hidden rounded-[2.5rem] border border-stone-200/70 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)] ${bg} ${className}`}>
      <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-stone-300/70" />
      {children}
    </div>
  );
}

function AppPreview() {
  return (
    <section id="app" className="px-6 py-24">
      <Reveal>
        <p className="text-center font-hand text-2xl text-coral">slow tech, fast trust</p>
        <h2 className="mt-2 text-center text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
          The whole journey, in your pocket
        </h2>
      </Reveal>
      <Reveal delay={150}>
        <div className="mt-16 flex items-start justify-center gap-4 sm:gap-[-2rem]">
          <Phone tone="sage" className="h-[580px] w-[260px] translate-y-12 opacity-80 sm:w-[280px]">
            <div className="flex h-full flex-col p-5">
              <div className="rounded-2xl bg-white/70 p-4">
                <div className="h-2.5 w-16 rounded-full bg-stone-300" />
                <div className="mt-3 h-2.5 w-24 rounded-full bg-stone-200" />
              </div>
              <div className="mt-3 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3">
                    <span className="h-8 w-8 rounded-full bg-sage" />
                    <span className="h-2 flex-1 rounded-full bg-stone-200" />
                  </div>
                ))}
              </div>
              <div className="mt-auto rounded-2xl bg-white/70 p-4 text-center">
                <span className="font-hand text-xl text-stone-500">sign to hand over</span>
              </div>
            </div>
          </Phone>

          <Phone tone="white" className="relative z-10 h-[620px] w-[290px] sm:w-[300px]">
            <div className="flex h-full flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-stone-500">K67XV6NETOVAQ</span>
                <span className="rounded-full bg-coral px-2.5 py-0.5 text-[10px] font-bold text-white">mandi</span>
              </div>
              <div className="mt-5 rounded-2xl bg-cream p-4">
                <span className="text-xs text-stone-400">verified journey</span>
                <div className="mt-2 space-y-2.5">
                  {['Farm gate ✓', 'In transit ✓', 'Cold storage ✓', 'Mandi ✓'].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-coral" />
                      <span className="text-xs font-medium text-stone-700">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-lavender p-4">
                <span className="text-xs text-stone-400">AI advisory</span>
                <p className="mt-1 text-lg font-semibold text-stone-800">2<span className="text-sm text-stone-400">/4 · fair band</span></p>
              </div>
              <div className="mt-auto flex flex-col items-center gap-3">
                <button
                  type="button"
                  className="animate-breathe rounded-full bg-coral px-8 py-3.5 text-sm font-semibold text-ink"
                  aria-label="Breathe — verify this batch"
                >
                  Breathe
                </button>
                <span className="text-[10px] text-stone-400">pause and recompute the chain</span>
              </div>
            </div>
          </Phone>

          <Phone tone="lavender" className="h-[580px] w-[260px] translate-y-24 opacity-80 sm:w-[280px]">
            <div className="flex h-full flex-col p-5">
              <div className="rounded-2xl bg-white/70 p-4 text-center">
                <div className="mx-auto h-10 w-10 rounded-full bg-coral" />
                <div className="mx-auto mt-3 h-2.5 w-20 rounded-full bg-stone-300" />
                <div className="mx-auto mt-2 h-2.5 w-14 rounded-full bg-stone-200" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {['₹175', 'farmer', '₹25', 'mandi'].map((t) => (
                  <div key={t} className="rounded-2xl bg-white/70 p-3 text-center text-xs font-semibold text-stone-600">
                    {t}
                  </div>
                ))}
              </div>
              <div className="mt-auto rounded-2xl bg-white/70 p-4 text-center">
                <span className="font-hand text-xl text-stone-500">settled, softly</span>
              </div>
            </div>
          </Phone>
        </div>
      </Reveal>
    </section>
  );
}

/* ----------------------------- Testimonials ------------------------------- */

const DIARY = [
  {
    quote:
      'For the first time, I can show the mandi agent exactly when my tomatoes left my field and how they travelled. The price argument ended the day the chain started speaking.',
    name: 'Rukmini',
    place: 'farmer, Nashik',
    rotate: '-1deg',
  },
  {
    quote:
      'We used to reconcile payments over a week of phone calls. Now the sale settles the moment the batch is marked sold, and every rupee is accounted for on-chain.',
    name: 'Arjun',
    place: 'co-op agent, Pune',
    rotate: '1deg',
  },
];

function Testimonials() {
  return (
    <section className="px-6 py-16">
      <Reveal>
        <h2 className="text-center text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
          From the <span className="font-hand text-coral text-[1.15em] font-normal">diary</span>
        </h2>
      </Reveal>
      <div className="mx-auto mt-10 grid max-w-3xl gap-8 md:grid-cols-2">
        {DIARY.map((d, i) => (
          <Reveal key={d.name} delay={i * 150}>
            <figure
              className="rounded-[2rem] bg-white p-8 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]"
              style={{ transform: `rotate(${d.rotate})` }}
            >
              <blockquote className="text-lg leading-relaxed text-stone-700">“{d.quote}”</blockquote>
              <figcaption className="mt-6">
                <span className="block h-0.5 w-8 rounded-full bg-stone-300" />
                <span className="mt-2 block font-hand text-2xl text-stone-500">
                  {d.name}, {d.place}
                </span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- Waitlist -------------------------------- */

function Waitlist() {
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);

  return (
    <section className="relative overflow-hidden px-6 py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/4 -left-20 h-72 w-72 rounded-full bg-coral-soft opacity-50 blur-3xl animate-float-slow" />
        <div className="absolute -right-20 bottom-1/4 h-72 w-72 rounded-full bg-lavender-soft opacity-50 blur-3xl animate-float-slow [animation-delay:2s]" />
      </div>
      <Reveal>
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-coral" />
          </span>
          <h2 className="mt-6 text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
            Come sit with us in the <span className="font-hand text-coral text-[1.15em] font-normal">living room</span>
          </h2>
          <p className="mt-3 text-muted">Get a note when the pilot opens to more co-ops. No noise, we promise.</p>
          {joined ? (
            <p className="mt-8 font-hand text-2xl text-coral">you're on the list ✦</p>
          ) : (
            <form
              className="mt-8 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.includes('@')) setJoined(true);
              }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                className="w-full rounded-full bg-stone-50 px-5 py-3.5 text-sm text-ink placeholder-stone-400 focus:ring-2 focus:ring-coral focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-cream transition-transform hover:scale-105"
              >
                Join
              </button>
            </form>
          )}
        </div>
      </Reveal>
    </section>
  );
}

/* ----------------------------------- FAQ ----------------------------------- */

const FAQS = [
  {
    q: 'What actually lives on the blockchain?',
    a: 'Only commitments: hashes of the photo, metadata and location, the stage transitions, custody records, and the payout split. Photos, personal data and anything heavy stay off-chain — the chain is an audit anchor, not a database.',
  },
  {
    q: 'Who pays for the transactions?',
    a: 'Nobody in the field. Farmers and agents sign EIP-712 messages with their own keys — that part is free — and a gas-paying relayer submits the transactions. Signing also works offline and submits later.',
  },
  {
    q: 'What does the AI grade actually do?',
    a: 'It is advisory, by design. The grading service scores a photo, the oracle signs the result on-chain, and the whole chain of custody keeps moving regardless. It informs buyers; it never blocks a farmer.',
  },
  {
    q: 'What happens when something goes wrong?',
    a: 'Any batch can be moved into a dispute state, which pauses the journey and remembers exactly where it stopped. An admin resolves it to the appropriate stage — and the full history stays visible forever.',
  },
  {
    q: 'How does the farmer get paid?',
    a: 'The buyer funds a USDC escrow when the batch reaches the mandi. On sale, the contract splits it instantly by policy — the farmer is guaranteed at least 50% by code, and in the pilot takes 70%.',
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-2xl px-6 py-20">
      <Reveal>
        <h2 className="text-center text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
          Asked <span className="font-hand text-coral text-[1.15em] font-normal">gently</span>, answered plainly
        </h2>
      </Reveal>
      <div className="mt-10 space-y-3">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={f.q} delay={i * 80}>
              <div className="rounded-2xl border border-stone-100 bg-white">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 p-6 text-left font-medium"
                >
                  <span>{f.q}</span>
                  <span
                    aria-hidden
                    className={`text-xl leading-none transition-transform duration-500 ease-in-out ${isOpen ? 'rotate-45' : ''}`}
                  >
                    +
                  </span>
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 leading-relaxed text-muted">{f.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export function LandingPage() {
  return (
    <main className="pb-10">
      <Hero />
      <ScenarioScroll />
      <AppPreview />
      <Testimonials />
      <Waitlist />
      <Faq />
    </main>
  );
}
