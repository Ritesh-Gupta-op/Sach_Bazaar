import type { DemoBatch } from './types';

const KEY = 'sachbazaar.recent';
const LIMIT = 8;

export function getRecent(): DemoBatch[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as DemoBatch[];
  } catch {
    return [];
  }
}

export function addRecent(batch: DemoBatch): void {
  const next = [batch, ...getRecent().filter((b) => b.batchId !== batch.batchId)].slice(0, LIMIT);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearRecent(): void {
  localStorage.removeItem(KEY);
}
