import type { DemoBatch, TraceResponse } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000/v1' : '/api');

export class TraceNotFoundError extends Error {
  constructor() {
    super('Batch not found on chain');
  }
}

export async function fetchTrace(batchId: string): Promise<TraceResponse> {
  const res = await fetch(`${API_URL}/trace/${batchId}`);
  if (res.status === 404) throw new TraceNotFoundError();
  if (!res.ok) throw new Error(`Trace API error (HTTP ${res.status})`);
  return (await res.json()) as TraceResponse;
}

export async function fetchBatches(): Promise<DemoBatch[]> {
  const res = await fetch(`${API_URL}/batches`);
  if (!res.ok) throw new Error(`Batches API error (HTTP ${res.status})`);
  const body = (await res.json()) as { batches: DemoBatch[] };
  return body.batches;
}

export type AiGrade = { score: number; explanation: string; modelVersion: string };

export async function gradeWithAi(photoBase64: string): Promise<AiGrade> {
  const res = await fetch(`${API_URL}/ai/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoBase64 }),
  });
  const body = (await res.json().catch(() => null)) as (AiGrade & { message?: string }) | null;
  if (!res.ok || !body?.score) {
    throw new Error(body?.message ?? `AI grade failed (HTTP ${res.status})`);
  }
  return body;
}
