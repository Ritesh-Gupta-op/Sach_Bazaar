import { formatTimestamp, rupeesPerKg, shortenHex } from '../lib/format';
import type { TraceRecord } from '../lib/types';
import { VerifiedBadge } from './VerifiedBadge';
import { stageLabel } from './StageTimeline';

export function RecordCard({ record }: { record: TraceRecord }) {
  return (
    <li className="relative pl-8">
      <span
        className={`absolute top-1.5 left-2 h-3 w-3 rounded-full ring-4 ${record.verified ? 'bg-moss ring-sage' : 'bg-red-500 ring-red-100'}`}
        aria-hidden
      />
      <div className="rounded-3xl border border-stone-100 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{stageLabel(record.stage)}</span>
            <VerifiedBadge verified={record.verified} />
          </div>
          <span className="text-xs text-stone-500">{formatTimestamp(record.timestamp)}</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-stone-400">From</dt>
            <dd className="font-mono">{shortenHex(record.from)}</dd>
          </div>
          <div>
            <dt className="text-stone-400">To</dt>
            <dd className="font-mono">{shortenHex(record.to)}</dd>
          </div>
          <div>
            <dt className="text-stone-400">Price at hop</dt>
            <dd>{rupeesPerKg(record.pricePerKgPaise)}/kg</dd>
          </div>
          <div>
            <dt className="text-stone-400">Record</dt>
            <dd className="font-mono" title={record.recordHash}>
              {shortenHex(record.recordHash, 4)}
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}
