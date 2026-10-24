import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ethers } from 'ethers';
import { STAGE_NAMES, recordHashOf, shortCodeOf, verifyRecordWalk, type ChainRecord } from '../src/trace/trace.logic';

function makeRecord(overrides: Partial<ChainRecord> = {}): ChainRecord {
  const base: ChainRecord = {
    prevRecordHash: ethers.ZeroHash,
    locationHash: ethers.id('location'),
    pricePerKgPaise: 1_000,
    stage: 0,
    timestamp: 1_700_000_000,
    from: '0x000000000000000000000000000000000000000A',
    to: '0x000000000000000000000000000000000000000B',
    recordHash: '',
  };
  const record = { ...base, ...overrides };
  return { ...record, recordHash: recordHashOf(ethers.id('batch'), record) };
}

describe('record hash recomputation', () => {
  it('verifies an intact chain and flags tampering per record', () => {
    const batchId = ethers.id('batch');
    const first = makeRecord();
    const second = makeRecord({ prevRecordHash: first.recordHash, stage: 1, pricePerKgPaise: 1_200 });
    const walk = verifyRecordWalk(batchId, [first, second]);
    assert.equal(walk.verified, true);
    assert.deepEqual(walk.perRecord, [true, true]);
  });

  it('detects a broken prevRecordHash link', () => {
    const batchId = ethers.id('batch');
    const first = makeRecord();
    const orphan = makeRecord({ prevRecordHash: ethers.id('not-the-real-previous'), stage: 1 });
    const walk = verifyRecordWalk(batchId, [first, orphan]);
    assert.equal(walk.verified, false);
    assert.deepEqual(walk.perRecord, [true, false]);
  });

  it('detects a mutated payload field (price)', () => {
    const batchId = ethers.id('batch');
    const first = makeRecord();
    const tampered: ChainRecord = { ...first, pricePerKgPaise: 9_999 };
    const walk = verifyRecordWalk(batchId, [tampered]);
    assert.equal(walk.verified, false);
    assert.deepEqual(walk.perRecord, [false]);
  });
});

describe('stage names', () => {
  it('covers the contract enum order', () => {
    assert.deepEqual([...STAGE_NAMES], ['FARM_GATE', 'IN_TRANSIT', 'COLD_STORAGE', 'MANDI', 'SOLD', 'SETTLED', 'DISPUTED']);
  });
});

describe('short code', () => {
  it('is 13 uppercase base32 chars over the first 8 bytes', () => {
    const batchId = ethers.id('demo-batch-settled');
    const code = shortCodeOf(batchId);
    assert.match(code, /^[A-Z2-7]{13}$/);
    // Deterministic and prefix-bound: same prefix, same code.
    assert.equal(code, shortCodeOf(batchId.slice(0, 18) + '00'.repeat(24)));
    assert.notEqual(code, shortCodeOf('0x' + 'ab'.repeat(32)));
  });
});
