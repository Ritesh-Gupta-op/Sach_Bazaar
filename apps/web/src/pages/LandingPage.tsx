import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchBatches } from '../lib/api';
import type { DemoBatch } from '../lib/types';
import { stageLabel } from '../components/StageTimeline';

const JOURNEY = [
  { icon: '🚜', label: 'Farm gate' },
  { icon: '🚚', label: 'In transit' },
  { icon: '❄️', label: 'Cold storage' },
  { icon: '🏪', label: 'Mandi' },
];

const PROBLEMS = [
  {
    icon: '💸',
    title: 'Opaque pricing',
    body: 'The farmer sees a fraction of the mandi price and has no visibility into what happened in between.',
  },
  {
    icon: '🤷',
    title: 'No custody proof',
    body: 'When a crate spoils or a weight is disputed, every hop is he-said-she-said with nothing to check against.',
  },
  {
    icon: '⏳',
    title: 'Slow settlement',
    body: 'Payments crawl through days of reconciliation before anyone gets paid for the produce already sold.',
  },
];

const STEPS = [
  {
    n: 1,
    title: 'Dual-signed at the farm gate',
    body: 'The co-op agent and buyer both sign the batch — weight, price, photo and location hashes — before it moves anywhere.',
  },
  {
    n: 2,
    title: 'Hash-chained custody hops',
    body: 'Every handover (truck, cold storage, mandi) is signed by both parties and each record cites the previous record hash. Tampering breaks the chain visibly.',
  },
  {
    n: 3,
    title: 'Advisory AI grade',
    body: 'A photo is graded by the advisory service; the oracle signs the result on-chain. It informs — never blocks — the journey.',
  },
  {
    n: 4,
    title: 'Sale with instant split',
    body: 'Buyer funds USDC escrow; when the batch sells, the payout split settles instantly — the farmer takes at least half by policy.',
  },
];

const ACTORS = [
  { icon: '👨‍🌾', role: 'Farmer', benefit: 'Proof of quality and custody — and a guaranteed minimum share of every sale.' },
  { icon: '🤝', role: 'Co-op agent', benefit: 'Registers farmers pseudonymously and signs batches into the chain of custody.' },
  { icon: '🚛', role: 'Truck driver', benefit: 'Every pickup and drop-off is a signed record — no disputes about what moved when.' },
  { icon: '🧊', role: 'Cold storage', benefit: 'Temperature custody windows are anchored, not asserted on paper.' },
  { icon: '🏪', role: 'Mandi agent', benefit: 'Receives verifiable provenance with the crate instead of promises.' },
  { icon: '🛒', role: 'Buyer', benefit: 'Funds escrow knowing the journey is verified, and pays exactly what was signed.' },
];

const TECH = ['Polygon Amoy testnet', 'Solidity 0.8.24', 'EIP-712 signed actions', 'Gas-paid relayer', 'Verified hash chain', 'USDC escrow'];

export function LandingPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<DemoBatch[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchBatches()
      .then(setBatches)
      .catch(() => setBatches([]));
  }, []);

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="pt-8 pb-2 text-center">
        <div className="mb-8 flex items-center justify-center gap-2 sm:gap-6">
          {JOURNEY.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2 sm:gap-6">
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-4xl" aria-hidden>
                  {step.icon}
                </span>
                <span className="mt-1 text-[10px] font-semibold tracking-wide text-stone-500 uppercase sm:text-xs">{step.label}</span>
              </div>
              {i < JOURNEY.length - 1 && <span className="h-0.5 w-4 bg-orange-300 sm:w-10" aria-hidden />}
            </div>
          ))}
        </div>
        <h1 className="mx-auto max-w-2xl text-3xl font-bold sm:text-5xl">
          From farm gate to mandi, <span className="text-orange-600">every hop verifiable</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-stone-600">
          SachBazaar anchors a tomato crate's journey on Polygon: dual-signed custody handovers, a hash chain anyone can
          recompute, advisory AI grading, and settlement that pays the farmer instantly.
        </p>
        <form
          className="mx-auto mt-8 flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(query.trim() ? `/trace?q=${encodeURIComponent(query.trim())}` : '/trace');
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a batch short code…"
            aria-label="Batch short code"
            className="w-full rounded-lg border border-stone-300 px-4 py-2.5 font-mono text-sm uppercase focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:outline-none"
          />
          <button type="submit" className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">
            Trace
          </button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link to="/trace" className="font-medium text-orange-700 underline hover:text-orange-800">
            scan a QR / search batches →
          </Link>
          <span className="text-stone-300">|</span>
          <Link to="/console" className="font-medium text-orange-700 underline hover:text-orange-800">
            try the journey console →
          </Link>
        </div>
      </section>

      {/* Why it matters */}
      <section>
        <h2 className="text-center text-2xl font-bold">The mandi chain runs on trust. Farmers pay for it.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <span className="text-2xl" aria-hidden>
                {p.icon}
              </span>
              <h3 className="mt-3 font-bold">{p.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-600 font-bold text-white">{s.n}</span>
              <div>
                <h3 className="font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-stone-600">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Privacy stance */}
      <section>
        <div className="rounded-2xl bg-stone-900 p-8 text-white">
          <h2 className="text-center text-xl font-bold sm:text-2xl">The chain is an audit anchor, not a database.</h2>
          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-stone-800 p-5">
              <h3 className="font-bold text-green-400">On-chain</h3>
              <ul className="mt-2 list-disc pl-4 text-stone-300">
                <li>Hash commitments for photos, metadata, location</li>
                <li>Stage transitions and custody records</li>
                <li>Escrow amounts and payout splits</li>
              </ul>
            </div>
            <div className="rounded-xl bg-stone-800 p-5">
              <h3 className="font-bold text-orange-400">Off-chain</h3>
              <ul className="mt-2 list-disc pl-4 text-stone-300">
                <li>Photos and documents</li>
                <li>Farmer personal data (pseudonymous IDs only)</li>
                <li>Anything heavy, private, or deletable</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* For every actor */}
      <section>
        <h2 className="text-center text-2xl font-bold">Built for everyone the crate passes through</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACTORS.map((a) => (
            <div key={a.role} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <span className="text-2xl" aria-hidden>
                {a.icon}
              </span>
              <h3 className="mt-2 font-bold">{a.role}</h3>
              <p className="mt-1 text-sm text-stone-600">{a.benefit}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live demo strip */}
      <section>
        <h2 className="text-center text-2xl font-bold">
          Live on the testnet <span className="align-middle text-base font-normal text-stone-400">— click a batch to verify its chain</span>
        </h2>
        {batches.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {batches.map((b) => (
              <Link
                key={b.batchId}
                to={`/trace/${b.batchId}`}
                className="rounded-xl border border-stone-200 bg-white p-4 text-center shadow-sm transition hover:border-orange-400 hover:shadow"
              >
                <span className="font-mono text-lg font-bold">{b.shortCode}</span>
                <span className="mt-1 block text-xs text-stone-500">{stageLabel(b.stage)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-stone-400">Demo chain not reachable — start the local stack to see live batches.</p>
        )}
      </section>

      {/* Tech band */}
      <section className="pb-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {TECH.map((t) => (
            <span key={t} className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500">
              {t}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
