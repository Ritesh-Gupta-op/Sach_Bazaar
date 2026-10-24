import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  attestAI,
  claimableFor,
  createBatch,
  fetchBatchesMeta,
  fetchRelayInfo,
  fundEscrow,
  markSold,
  mintDemoUsdc,
  recordHandover,
  settleBatch,
  usdcBalanceOf,
  withdrawPayout,
  type BatchesMeta,
  type RelayInfo,
} from '../lib/relay';
import { TraceNotFoundError, fetchTrace, gradeWithAi, type AiGrade } from '../lib/api';
import { rupeesPerKg, shortenHex } from '../lib/format';
import type { TraceResponse } from '../lib/types';
import { ACTOR_LABELS, PAYOUT_LABELS, PAYOUT_ROLES, actorWallets, payoutWallets } from '../lib/wallets';
import { stageLabel } from '../components/StageTimeline';
import { VerifiedBadge } from '../components/VerifiedBadge';

type LogEntry = { label: string; detail: string; ok: boolean };

const HANDOVER_PATHS: Record<string, { from: keyof typeof actorWallets; to: keyof typeof actorWallets; next: number; label: string }[]> = {
  FARM_GATE: [{ from: 'buyer', to: 'trucker', next: 1, label: 'Load onto truck → In transit' }],
  IN_TRANSIT: [{ from: 'trucker', to: 'coldStorage', next: 2, label: 'Receive at cold storage' }],
  COLD_STORAGE: [{ from: 'coldStorage', to: 'mandi', next: 3, label: 'Deliver to mandi agent' }],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const usdc = (micro: number) => `${(micro / 1_000_000).toFixed(2)} USDC`;

export function ConsolePage() {
  const [info, setInfo] = useState<RelayInfo | null>(null);
  const [meta, setMeta] = useState<BatchesMeta | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [claimable, setClaimable] = useState<Record<string, bigint> | null>(null);
  const [buyerBalance, setBuyerBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  // form state
  const [newWeightKg, setNewWeightKg] = useState('25');
  const [newPriceRs, setNewPriceRs] = useState('10');
  const [hopPrice, setHopPrice] = useState('');
  const [grade, setGrade] = useState('1');
  const [flagBits, setFlagBits] = useState<number[]>([0]);
  const [fundAmount, setFundAmount] = useState('250');
  const [salePrice, setSalePrice] = useState('');
  const [aiGradeResult, setAiGradeResult] = useState<AiGrade | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    fetchRelayInfo()
      .then((i) => {
        setInfo(i);
        if (!i.configured) setError('Relayer is not configured — mutations disabled.');
      })
      .catch((e: Error) => setError(e.message));
    fetchBatchesMeta()
      .then(setMeta)
      .catch((e: Error) => setError(e.message));
  }, []);

  const refresh = useCallback(async (batchId: string | null) => {
    const m = await fetchBatchesMeta().catch(() => null);
    if (m) setMeta(m);
    if (!batchId) return;
    try {
      const t = await fetchTrace(batchId);
      setTrace(t);
      if (!hopPrice) setHopPrice(String(Math.round(t.pricePerKgPaise / 100) + 2));
      if (!salePrice) setSalePrice(String(Math.round(t.pricePerKgPaise / 100) + 5));
      if (t.settlement.settled && info) {
        const entries = await Promise.all(
          PAYOUT_ROLES.map(async (role) => [role, await claimableFor(info, payoutWallets[role].address).catch(() => 0n)] as const),
        );
        setClaimable(Object.fromEntries(entries));
      } else {
        setClaimable(null);
      }
    } catch (e) {
      if (!(e instanceof TraceNotFoundError)) throw e;
      setTrace(null);
    }
    if (info) {
      setBuyerBalance(Number(await usdcBalanceOf(info, actorWallets.buyer.address).catch(() => 0n)));
    }
  }, [hopPrice, salePrice, info]);

  useEffect(() => {
    if (selected) void refresh(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const run = useCallback(
    async (label: string, fn: () => Promise<string | string[] | void>) => {
      setBusy(label);
      setError(null);
      try {
        const result = await fn();
        const hashes = Array.isArray(result) ? result : result ? [result] : [];
        setLog((l) => [{ label, detail: hashes.length ? hashes.map((h) => shortenHex(h, 6)).join(' · ') : 'done', ok: true }, ...l].slice(0, 12));
        await sleep(1800); // let the transaction mine before re-reading the chain
        await refresh(selected);
      } catch (e) {
        setLog((l) => [{ label, detail: (e as Error).message, ok: false }, ...l].slice(0, 12));
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [refresh, selected],
  );

  const domain = info?.eip712;
  const stage = trace?.stage;
  const handoverPath = stage ? (HANDOVER_PATHS[stage] ?? [])[0] : undefined;
  const canAct = info?.configured === true;

  /** Score → advisory grade bands (1 best … 4 worst) + a quality-concern flag under 0.5. */
  const applyAiResult = (result: AiGrade) => {
    setAiGradeResult(result);
    const g = result.score >= 0.75 ? 1 : result.score >= 0.5 ? 2 : result.score >= 0.25 ? 3 : 4;
    setGrade(String(g));
    setFlagBits(result.score < 0.5 ? [0] : []);
  };

  const runAiGrade = async (base64: string) => {
    setAiBusy(true);
    setError(null);
    try {
      applyAiResult(await gradeWithAi(base64));
    } catch (e) {
      setError(`AI service: ${(e as Error).message}`);
    } finally {
      setAiBusy(false);
    }
  };

  const onPhotoPicked = async (file: File | undefined) => {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    await runAiGrade(btoa(binary));
  };

  const gradeWithSamplePhoto = () => {
    const sample = new Uint8Array(64);
    crypto.getRandomValues(sample);
    let binary = '';
    for (let i = 0; i < sample.length; i++) binary += String.fromCharCode(sample[i]);
    void runAiGrade(btoa(binary));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">Journey console</h1>
        <p className="mt-1 text-sm text-stone-500">
          Act as any supply-chain role. Actions are signed locally with the demo wallets and submitted through the gas-paying relayer —
          exactly the flow real actor apps will use.
        </p>
        {info && (
          <p className="mt-2 text-xs text-stone-400">
            network {info.network} (chain {info.chainId}) · relayer {info.relayerAddress ? shortenHex(info.relayerAddress) : 'not configured'}
          </p>
        )}
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-stone-500 uppercase">Batches</h2>
        <div className="flex flex-wrap gap-2">
          {(meta?.batches ?? []).map((b) => (
            <button
              key={b.batchId}
              onClick={() => {
                setSelected(b.batchId);
                setHopPrice('');
                setSalePrice('');
              }}
              className={[
                'rounded-full px-4 py-2 text-sm font-semibold',
                selected === b.batchId ? 'bg-orange-600 text-white' : 'bg-white text-stone-700 border border-stone-200 hover:border-orange-400',
              ].join(' ')}
            >
              <span className="font-mono">{b.shortCode}</span> · {stageLabel(b.stage)}
            </button>
          ))}
          {meta && meta.batches.length === 0 && <span className="text-sm text-stone-400">No batches yet — create one below.</span>}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold tracking-wide text-stone-500 uppercase">Create batch</h2>
        <p className="mt-1 text-xs text-stone-400">
          Dual-signed by {ACTOR_LABELS.coop} + {ACTOR_LABELS.buyer}. Batch ID derived per docs/HASHING.md.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-stone-400">Weight (kg)</span>
            <input value={newWeightKg} onChange={(e) => setNewWeightKg(e.target.value)} inputMode="decimal" className="mt-1 w-24 rounded-lg border border-stone-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-stone-400">Farm-gate price (₹/kg)</span>
            <input value={newPriceRs} onChange={(e) => setNewPriceRs(e.target.value)} inputMode="decimal" className="mt-1 w-28 rounded-lg border border-stone-300 px-3 py-2" />
          </label>
          <button
            disabled={!canAct || busy !== null || !domain || !meta}
            onClick={() =>
              run('Create batch', async () => {
                const result = await createBatch(domain!, actorWallets, {
                  farmerId: meta!.farmerId,
                  coopId: meta!.coopId,
                  weightGrams: Math.round(parseFloat(newWeightKg || '0') * 1000),
                  pricePerKgPaise: Math.round(parseFloat(newPriceRs || '0') * 100),
                });
                setSelected(result.batchId);
                setHopPrice('');
                setSalePrice('');
                return result.txHash;
              })
            }
            className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-40"
          >
            {busy === 'Create batch' ? 'Signing & submitting…' : 'Create batch'}
          </button>
        </div>
      </section>

      {trace && (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-lg font-bold">{trace.shortCode}</h2>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">{stageLabel(trace.stage)}</span>
              <VerifiedBadge verified={trace.verified} />
              {trace.settlement.settled && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">escrow settled</span>}
            </div>
            <Link to={`/trace/${trace.batchId}`} className="text-sm font-medium text-orange-700 underline">
              open trace view →
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {handoverPath && trace.stage !== 'DISPUTED' && (
              <ActionCard
                title={`Handover — ${handoverPath.label}`}
                signerNote={`${ACTOR_LABELS[handoverPath.from]} + ${ACTOR_LABELS[handoverPath.to]} sign`}
                busy={busy === 'handover'}
                disabled={!canAct || !domain}
                inputs={
                  <label className="text-sm">
                    <span className="block text-xs text-stone-400">Price at hop (₹/kg)</span>
                    <input value={hopPrice} onChange={(e) => setHopPrice(e.target.value)} inputMode="decimal" className="mt-1 w-24 rounded-lg border border-stone-300 px-3 py-2" />
                  </label>
                }
                buttonLabel="Record handover"
                onRun={() =>
                  run('handover', () =>
                    recordHandover(domain!, { from: actorWallets[handoverPath.from], to: actorWallets[handoverPath.to] }, {
                      batchId: trace.batchId,
                      nextStage: handoverPath.next,
                      pricePerKgPaise: Math.round(parseFloat(hopPrice || '0') * 100),
                      prevRecordHash: trace.lastRecordHash,
                    }).then((r) => r.txHash),
                  )
                }
              />
            )}

            {trace.stage !== 'SETTLED' && trace.stage !== 'DISPUTED' && (
              <ActionCard
                title="AI advisory attestation"
                signerNote={`${ACTOR_LABELS.oracle} signs (advisory, not a gate)`}
                busy={busy === 'attest'}
                disabled={!canAct || !domain}
                inputs={
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="text-sm">
                        <span className="block text-xs text-stone-400">Grade</span>
                        <select value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 rounded-lg border border-stone-300 px-3 py-2">
                          {[1, 2, 3, 4].map((g) => (
                            <option key={g} value={g}>
                              {g}/4
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="text-sm">
                        <span className="block text-xs text-stone-400">Advisory flags</span>
                        <div className="mt-1 flex gap-2">
                          {[0, 1, 2, 3].map((bit) => (
                            <label key={bit} className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={flagBits.includes(bit)}
                                onChange={(e) => setFlagBits((prev) => (e.target.checked ? [...prev, bit] : prev.filter((b) => b !== bit)))}
                              />
                              bit {bit}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                      <label className="cursor-pointer rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50">
                        {aiBusy ? 'Grading…' : '📷 Grade photo with AI service'}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => void onPhotoPicked(e.target.files?.[0])} />
                      </label>
                      <button
                        onClick={gradeWithSamplePhoto}
                        disabled={aiBusy}
                        className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                      >
                        use sample photo
                      </button>
                      {aiGradeResult && (
                        <span className="text-xs text-stone-500">
                          score <b>{aiGradeResult.score}</b> → grade <b>{grade}/4</b> · {aiGradeResult.explanation} ({aiGradeResult.modelVersion})
                        </span>
                      )}
                    </div>
                  </div>
                }
                buttonLabel="Attest"
                onRun={() =>
                  run('attest', () =>
                    attestAI(domain!, actorWallets.oracle, {
                      batchId: trace.batchId,
                      grade: Number(grade),
                      flags: flagBits.reduce((mask, bit) => mask | (1 << bit), 0),
                    }).then((r) => r.txHash),
                  )
                }
              />
            )}

            {trace.stage === 'MANDI' && (
              <ActionCard
                title="Fund escrow"
                signerNote={`${ACTOR_LABELS.buyer} submits directly (USDC approve + fund)`}
                busy={busy === 'fund'}
                disabled={!info}
                inputs={
                  <div className="flex items-end gap-3">
                    <label className="text-sm">
                      <span className="block text-xs text-stone-400">Amount (USDC)</span>
                      <input value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} inputMode="decimal" className="mt-1 w-28 rounded-lg border border-stone-300 px-3 py-2" />
                    </label>
                    <button
                      disabled={busy !== null}
                      onClick={() => run('mint USDC', () => mintDemoUsdc(info!, actorWallets.admin, actorWallets.buyer.address, 500_000_000))}
                      className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                    >
                      mint 500 (demo)
                    </button>
                    {buyerBalance !== null && <span className="pb-2 text-xs text-stone-400">buyer holds {usdc(buyerBalance)}</span>}
                  </div>
                }
                buttonLabel="Fund escrow"
                onRun={() => run('fund', () => fundEscrow(info!, actorWallets.buyer, trace.batchId, Math.round(parseFloat(fundAmount || '0') * 1_000_000)))}
              />
            )}

            {trace.stage === 'MANDI' && (
              <ActionCard
                title="Mark sold at mandi"
                signerNote={`${ACTOR_LABELS.buyer} + ${ACTOR_LABELS.mandi} sign`}
                busy={busy === 'mark sold'}
                disabled={!canAct || !domain}
                inputs={
                  <label className="text-sm">
                    <span className="block text-xs text-stone-400">Final price (₹/kg)</span>
                    <input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} inputMode="decimal" className="mt-1 w-28 rounded-lg border border-stone-300 px-3 py-2" />
                  </label>
                }
                buttonLabel="Mark sold"
                onRun={() =>
                  run('mark sold', () =>
                    markSold(domain!, { buyer: actorWallets.buyer, mandi: actorWallets.mandi }, {
                      batchId: trace.batchId,
                      finalPricePerKgPaise: Math.round(parseFloat(salePrice || '0') * 100),
                    }).then((r) => r.txHash),
                  )
                }
              />
            )}

            {trace.stage === 'SOLD' && (
              <ActionCard
                title="Settle escrow & split payouts"
                signerNote="relayer/admin action · farmer 70% (config), remainder to supply chain"
                busy={busy === 'settle'}
                disabled={!canAct}
                inputs={
                  <ul className="space-y-0.5 text-xs text-stone-500">
                    {PAYOUT_ROLES.map((role) => (
                      <li key={role}>
                        {PAYOUT_LABELS[role]}: <span className="font-mono">{shortenHex(payoutWallets[role].address, 4)}</span>
                      </li>
                    ))}
                  </ul>
                }
                buttonLabel="Settle"
                onRun={() =>
                  run('settle', () =>
                    settleBatch(trace.batchId, {
                      farmer: payoutWallets.farmer.address,
                      coop: payoutWallets.coop.address,
                      trucker: payoutWallets.trucker.address,
                      coldStorage: payoutWallets.coldStorage.address,
                      mandiAgent: payoutWallets.mandiAgent.address,
                      platform: payoutWallets.platform.address,
                    }).then((r) => r.txHash),
                  )
                }
              />
            )}

            {trace.stage === 'SETTLED' && (
              <div className="rounded-xl border border-stone-200 p-4">
                <h3 className="text-sm font-bold">Payouts</h3>
                <ul className="mt-2 space-y-1 text-xs">
                  {PAYOUT_ROLES.map((role) => {
                    const amount = claimable?.[role] ?? null;
                    const withdrawn = amount === null && claimable !== null;
                    return (
                      <li key={role} className="flex items-center justify-between gap-2">
                        <span>
                          {PAYOUT_LABELS[role]} — <span className="font-mono text-stone-400">{shortenHex(payoutWallets[role].address, 4)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          {amount !== null ? <span className="font-semibold">{usdc(Number(amount))}</span> : withdrawn ? <span className="text-stone-400">withdrawn / none</span> : '…'}
                          <button
                            disabled={busy !== null || amount === null || amount === 0n}
                            onClick={() => run(`withdraw ${role}`, () => withdrawPayout(info!, payoutWallets[role]))}
                            className="rounded bg-stone-800 px-2 py-1 font-semibold text-white hover:bg-stone-700 disabled:opacity-30"
                          >
                            withdraw
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {trace.stage === 'DISPUTED' && (
              <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                Batch is disputed — an admin must resolve it on-chain before the journey can continue.
              </p>
            )}
          </div>
        </section>
      )}

      {log.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold tracking-wide text-stone-500 uppercase">Transaction log</h2>
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white text-sm">
            {log.map((entry, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-semibold">
                  {entry.ok ? '✓' : '✗'} {entry.label}
                </span>
                <span className={`font-mono text-xs ${entry.ok ? 'text-stone-500' : 'text-red-600'}`}>{entry.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ActionCard({
  title,
  signerNote,
  inputs,
  buttonLabel,
  onRun,
  busy,
  disabled,
}: {
  title: string;
  signerNote: string;
  inputs: ReactNode;
  buttonLabel: string;
  onRun: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-0.5 text-xs text-stone-400">{signerNote}</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        {inputs}
        <button
          onClick={onRun}
          disabled={busy || disabled}
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-40"
        >
          {busy ? 'Working…' : buttonLabel}
        </button>
      </div>
    </div>
  );
}
