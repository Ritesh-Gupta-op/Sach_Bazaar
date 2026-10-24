const STAGES = ['FARM_GATE', 'IN_TRANSIT', 'COLD_STORAGE', 'MANDI', 'SOLD', 'SETTLED'] as const;

const LABELS: Record<string, string> = {
  FARM_GATE: 'Farm gate',
  IN_TRANSIT: 'In transit',
  COLD_STORAGE: 'Cold storage',
  MANDI: 'Mandi',
  SOLD: 'Sold',
  SETTLED: 'Settled',
  DISPUTED: 'Disputed',
};

export function stageLabel(stage: string): string {
  return LABELS[stage] ?? stage;
}

export function StageTimeline({ stage }: { stage: string }) {
  if (stage === 'DISPUTED') {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
        ⚠ This batch is under dispute — journey paused
      </div>
    );
  }
  const current = STAGES.indexOf(stage as (typeof STAGES)[number]);
  return (
    <ol className="flex flex-wrap items-center gap-1">
      {STAGES.map((s, i) => {
        const done = i <= current;
        const isCurrent = i === current;
        return (
          <li key={s} className="flex items-center gap-1">
            {i > 0 && <span className={`h-0.5 w-4 ${done ? 'bg-green-500' : 'bg-stone-300'}`} aria-hidden />}
            <span
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap',
                isCurrent
                  ? 'bg-orange-600 text-white ring-2 ring-orange-600 ring-offset-2'
                  : done
                    ? 'bg-green-100 text-green-800'
                    : 'bg-stone-100 text-stone-400',
              ].join(' ')}
            >
              {done && !isCurrent ? '✓ ' : ''}
              {LABELS[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
