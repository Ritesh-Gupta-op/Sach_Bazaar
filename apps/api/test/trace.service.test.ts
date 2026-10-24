import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ethers } from 'ethers';
import { ChainService } from '../src/chain/chain.service';
import { recordHashOf, type ChainRecord } from '../src/trace/trace.logic';
import { TraceService } from '../src/trace/trace.service';

function recordWith(overrides: Partial<ChainRecord> = {}): Record<string, unknown> {
  const base: ChainRecord = {
    recordHash: '',
    prevRecordHash: ethers.ZeroHash,
    locationHash: ethers.id('loc'),
    pricePerKgPaise: 1_000n,
    stage: 0n,
    timestamp: 1_700_000_000n,
    from: '0x000000000000000000000000000000000000000A',
    to: '0x000000000000000000000000000000000000000B',
    ...overrides,
  };
  base.recordHash = base.recordHash || recordHashOf(ethers.id('batch'), base);
  return { ...base };
}

function stubChain(batch: Record<string, unknown>, records: Record<string, unknown>[], chainVerified: boolean, settled: boolean): ChainService {
  return {
    batchRegistry: {
      getBatch: async () => batch,
      getRecords: async () => records,
      verifyRecordChain: async () => chainVerified,
    },
    paymentPool: { settled: async () => settled },
    isRevertWith: (error: unknown, signature: string) =>
      typeof (error as { data?: string }).data === 'string' && (error as { data: string }).data.startsWith(ethers.id(signature).slice(0, 10)),
    deployment: { demo: { batches: [] } },
  } as unknown as ChainService;
}

const BATCH = {
  batchId: ethers.id('batch'),
  farmerId: ethers.id('f'),
  coopId: ethers.id('c'),
  cropCode: 1n,
  weightGrams: 25_000n,
  pricePerKgPaise: 4_000n,
  photoHash: ethers.id('p'),
  metadataHash: ethers.id('m'),
  geoHash: ethers.id('g'),
  aiGrade: 1n,
  aiFlags: 5n,
  lastRecordHash: 'placeholder',
  stage: 2n,
  createdAt: 1_700_000_000n,
};

describe('TraceService.getTrace', () => {
  it('aggregates verification, decodes flags, and reports settlement', async () => {
    const first = recordWith();
    const second = recordWith({ prevRecordHash: first.recordHash as string, stage: 1n, pricePerKgPaise: 1_200n });
    const trace = await new TraceService(stubChain({ ...BATCH, lastRecordHash: second.recordHash }, [first, second], true, true)).getTrace(ethers.id('batch'));

    assert.equal(trace.verified, true);
    assert.equal(trace.stage, 'COLD_STORAGE');
    assert.equal(trace.crop, 'tomato');
    assert.deepEqual(trace.ai.flags, [0, 2]);
    assert.equal(trace.settlement.settled, true);
    assert.equal(trace.records.length, 2);
    assert.deepEqual(trace.records.map((r) => r.verified), [true, true]);
    assert.match(trace.shortCode, /^[A-Z2-7]{13}$/);
  });

  it('flags a tampered record without trusting the on-chain check alone', async () => {
    const first = recordWith();
    const tampered = recordWith({ prevRecordHash: first.recordHash as string, stage: 1n, pricePerKgPaise: 9_999n, recordHash: '0x' + '99'.repeat(32) });
    const trace = await new TraceService(stubChain({ ...BATCH, lastRecordHash: tampered.recordHash }, [first, tampered], true, false)).getTrace(ethers.id('batch'));
    assert.equal(trace.verified, false);
    assert.deepEqual(trace.records.map((r) => r.verified), [true, false]);
  });

  it('maps BatchNotFound reverts to 404 and malformed ids to 400', async () => {
    const notFoundChain = {
      batchRegistry: {
        getBatch: async () => {
          throw Object.assign(new Error('revert'), { data: ethers.id('BatchNotFound(bytes32)').slice(0, 10) + '0'.repeat(56) });
        },
      },
      paymentPool: {},
      isRevertWith: ChainService.prototype.isRevertWith,
      deployment: {},
    } as unknown as ChainService;
    await assert.rejects(new TraceService(notFoundChain).getTrace(ethers.id('missing')), NotFoundException);
    await assert.rejects(new TraceService(notFoundChain).getTrace('not-hex'), BadRequestException);
  });
});
