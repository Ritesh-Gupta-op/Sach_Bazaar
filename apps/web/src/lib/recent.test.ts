import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addRecent, clearRecent, getRecent } from './recent';

function stubLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
}

describe('recent batches', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubLocalStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts empty and survives corrupt storage', () => {
    expect(getRecent()).toEqual([]);
    localStorage.setItem('sachbazaar.recent', 'not-json');
    expect(getRecent()).toEqual([]);
  });

  it('prepends, deduplicates, and caps the list', () => {
    const a = { batchId: '0xa', shortCode: 'AAAAAAAAAAAAA', stage: 'FARM_GATE' };
    const b = { batchId: '0xb', shortCode: 'BBBBBBBBBBBBB', stage: 'MANDI' };
    addRecent(a);
    addRecent(b);
    addRecent(a); // dedupe moves it to the front
    expect(getRecent()).toEqual([a, b]);
    for (let i = 0; i < 12; i++) {
      addRecent({ batchId: `0x${i}`, shortCode: 'CCCCCCCCCCCCC', stage: 'FARM_GATE' });
    }
    expect(getRecent().length).toBeLessThanOrEqual(8);
    expect(getRecent()[0].batchId).toBe('0x11');
  });

  it('clears', () => {
    addRecent({ batchId: '0xa', shortCode: 'AAAAAAAAAAAAA', stage: 'FARM_GATE' });
    clearRecent();
    expect(getRecent()).toEqual([]);
  });
});
