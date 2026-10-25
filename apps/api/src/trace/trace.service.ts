import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ethers } from 'ethers';
import { ChainService } from '../chain/chain.service';
import { STAGE_NAMES, shortCodeOf, verifyRecordWalk, type ChainRecord } from './trace.logic';
import type { TraceRecordDto, TraceResponseDto } from './trace.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class TraceService {
  constructor(
    private readonly chain: ChainService,
    @Optional() private readonly storage?: StorageService,
  ) {}

  async getTrace(batchId: string): Promise<TraceResponseDto> {
    if (!ethers.isHexString(batchId, 32)) {
      throw new BadRequestException('batchId must be a 0x-prefixed 32-byte hex string');
    }

    let batch: ethers.Result;
    try {
      batch = await this.chain.batchRegistry.getBatch(batchId);
    } catch (error) {
      if (this.chain.isRevertWith(error, 'BatchNotFound(bytes32)')) {
        throw new NotFoundException(`Batch ${batchId} not found`);
      }
      throw error;
    }

    const rawRecords = (await this.chain.batchRegistry.getRecords(batchId)) as ethers.Result[];
    const records: ChainRecord[] = rawRecords.map((r) => ({
      recordHash: String(r.recordHash),
      prevRecordHash: String(r.prevRecordHash),
      locationHash: String(r.locationHash),
      pricePerKgPaise: r.pricePerKgPaise,
      stage: r.stage,
      timestamp: r.timestamp,
      from: String(r.from),
      to: String(r.to),
    }));

    // Off-chain recomputation is the source of the `verified` flag; the on-chain
    // check is a second opinion (ARCHITECTURE.md trust rule 5).
    const walk = verifyRecordWalk(batchId, records);
    const chainVerified = Boolean(await this.chain.batchRegistry.verifyRecordChain(batchId));
    const settled = Boolean(await this.chain.paymentPool.settled(batchId));

    const recordDtos: TraceRecordDto[] = records.map((r, i) => ({
      index: i,
      stage: STAGE_NAMES[Number(r.stage)] ?? `UNKNOWN_${String(r.stage)}`,
      from: r.from,
      to: r.to,
      pricePerKgPaise: Number(r.pricePerKgPaise),
      timestamp: new Date(Number(r.timestamp) * 1000).toISOString(),
      recordHash: r.recordHash,
      prevRecordHash: r.prevRecordHash,
      verified: walk.perRecord[i] ?? false,
    }));

    const rawFlags = Number(batch.aiFlags);
    return {
      batchId,
      shortCode: shortCodeOf(batchId),
      verified: walk.verified && chainVerified && String(batch.lastRecordHash) === (records.at(-1)?.recordHash ?? ethers.ZeroHash),
      stage: STAGE_NAMES[Number(batch.stage)] ?? `UNKNOWN_${String(batch.stage)}`,
      crop: Number(batch.cropCode) === 1 ? 'tomato' : 'unknown',
      farmerId: String(batch.farmerId),
      coopId: String(batch.coopId),
      weightGrams: Number(batch.weightGrams),
      pricePerKgPaise: Number(batch.pricePerKgPaise),
      createdAt: new Date(Number(batch.createdAt) * 1000).toISOString(),
      lastRecordHash: String(batch.lastRecordHash),
      ai: {
        grade: Number(batch.aiGrade),
        flags: Array.from({ length: 16 }, (_, bit) => (rawFlags & (1 << bit) ? bit : -1)).filter((b) => b >= 0),
        rawFlags,
      },
      records: recordDtos,
      settlement: { settled },
      priceSplit: [],
    };
  }

  async listBatches(): Promise<{ farmerId: string; coopId: string; batches: { batchId: string; shortCode: string; stage: string }[] }> {
    const batches = new Map<string, { batchId: string; shortCode: string; stage: string }>();
    for (const batch of this.chain.deployment.demo?.batches ?? []) {
      batches.set(batch.batchId, batch);
    }

    if (this.storage) {
      for (const batch of await this.storage.listBatches()) {
        batches.set(batch.batchId, {
          batchId: batch.batchId,
          shortCode: shortCodeOf(batch.batchId),
          stage: batch.stage,
        });
      }
    }

    try {
      const fromBlock = Number(process.env.INDEXER_FROM_BLOCK ?? 0);
      const events = await this.chain.batchRegistry.queryFilter(this.chain.batchRegistry.filters.BatchCreated(), fromBlock, 'latest');
      for (const event of events) {
        const args = (event as ethers.EventLog).args;
        const batchId = String(args?.batchId ?? args?.[0] ?? '');
        if (!ethers.isHexString(batchId, 32)) continue;
        const batch = await this.chain.batchRegistry.getBatch(batchId);
        batches.set(batchId, {
          batchId,
          shortCode: shortCodeOf(batchId),
          stage: STAGE_NAMES[Number(batch.stage)] ?? `UNKNOWN_${String(batch.stage)}`,
        });
      }
    } catch {
      // Deployment metadata remains a useful fallback when the RPC is unavailable.
    }

    return {
      farmerId: this.chain.deployment.demo?.farmerId ?? ethers.ZeroHash,
      coopId: this.chain.deployment.demo?.coopId ?? ethers.ZeroHash,
      batches: [...batches.values()],
    };
  }

  /** Backwards-compatible name used by older callers. */
  listDemoBatches() {
    return this.listBatches();
  }
}
