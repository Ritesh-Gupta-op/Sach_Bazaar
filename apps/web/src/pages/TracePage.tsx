import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TraceNotFoundError, fetchTrace } from '../lib/api';
import { formatTimestamp, kg, rupeesPerKg, shortenHex } from '../lib/format';
import { addRecent } from '../lib/recent';
import type { TraceResponse } from '../lib/types';
import { QrCode } from '../components/QrCode';
import { RecordCard } from '../components/RecordCard';
import { StageTimeline, stageLabel } from '../components/StageTimeline';
import { VerifiedBadge } from '../components/VerifiedBadge';

export function TracePage() {
  const { batchId } = useParams<{ batchId: string }>();
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTrace(id);
      setTrace(result);
      addRecent({ batchId: result.batchId, shortCode: result.shortCode, stage: result.stage });
    } catch (e) {
      setTrace(null);
      setError(e instanceof TraceNotFoundError ? `No batch ${shortenHex(id, 4)} exists on chain.` : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (batchId) void load(batchId);
  }, [batchId, load]);

  if (loading) {
    return <p className="py-20 text-center text-stone-400">Reading the chain…</p>;
  }

  if (error || !trace) {
    return (
      <div className="rounded-[2rem] border border-red-200 bg-red-50 p-8 text-center">
        <p className="font-semibold text-red-800">{error ?? 'Something went wrong'}</p>
        <button onClick={() => batchId && void load(batchId)} className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream">
          Retry
        </button>
      </div>
    );
  }

  const traceUrl = `${window.location.origin}/trace/${trace.batchId}`;

  return (
    <div className="space-y-6">
      <div
        className={`rounded-[2rem] px-6 py-4 text-center text-lg font-bold ${trace.verified ? 'bg-sage text-ink' : 'bg-coral text-ink'}`}
      >
        {trace.verified ? '✓ Every journey record matches the on-chain hash chain' : '✗ Hash chain mismatch — do not trust this journey'}
      </div>

      <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold capitalize">{trace.crop}</h1>
              <span className="rounded-full bg-coral-soft px-3 py-1 text-xs font-bold text-ink">{stageLabel(trace.stage)}</span>
              {trace.settlement.settled && (
                <span className="rounded-full bg-sage px-3 py-1 text-xs font-bold text-ink">escrow settled</span>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-stone-400">Weight</dt>
                <dd className="font-semibold">{kg(trace.weightGrams)}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Price</dt>
                <dd className="font-semibold">{rupeesPerKg(trace.pricePerKgPaise)}/kg</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Created</dt>
                <dd className="font-semibold">{formatTimestamp(trace.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Farmer / co-op</dt>
                <dd className="font-mono text-xs font-semibold" title={`${trace.farmerId} ${trace.coopId}`}>
                  {shortenHex(trace.farmerId, 4)} / {shortenHex(trace.coopId, 4)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-col items-center gap-2">
            <QrCode value={traceUrl} size={120} />
            <span className="font-mono text-lg font-bold tracking-widest">{trace.shortCode}</span>
            <span className="text-[10px] text-stone-400">scan to open this page</span>
          </div>
        </div>
        <div className="mt-6">
          <StageTimeline stage={trace.stage} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-soft">
        <h2 className="text-sm font-bold tracking-wide text-stone-500 uppercase">AI advisory grade</h2>
        {trace.ai.grade === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Not graded yet.</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-3xl font-bold">{trace.ai.grade}<span className="text-base text-stone-400">/4</span></span>
            {trace.ai.flags.length > 0 && (
              <span className="text-xs text-stone-500">
                advisory flags: {trace.ai.flags.map((f) => `bit ${f}`).join(', ')}
              </span>
            )}
            {trace.ai.flags.length === 0 && <span className="text-xs text-stone-500">no advisory flags</span>}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-stone-500 uppercase">
          Journey — {trace.records.length} record{trace.records.length === 1 ? '' : 's'}
        </h2>
        <ol className="relative space-y-4 before:absolute before:inset-y-2 before:left-[0.68rem] before:w-0.5 before:bg-stone-200">
          {trace.records.map((record) => (
            <RecordCard key={record.index} record={record} />
          ))}
        </ol>
      </section>

      <p className="break-all text-center text-[10px] text-stone-400">batch id: {trace.batchId}</p>
    </div>
  );
}
