import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { ChainService } from '../chain/chain.service';
import { STAGE_NAMES } from '../trace/trace.logic';
import { StorageService } from './storage.service';
import type { BatchSnapshot } from './storage.types';

/**
 * Confirmation-aware event indexer. It is intentionally small for the pilot:
 * Postgres is a read model, while the contracts remain the source of truth.
 */
@Injectable()
export class IndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);
  private timer: NodeJS.Timeout | null = null;
  private syncing = false;

  constructor(
    private readonly chain: ChainService,
    private readonly storage: StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.storage.whenReady();
    if (!this.storage.isAvailable()) return;

    await this.syncOnce().catch((error) => this.logger.warn(`Initial index sync failed: ${(error as Error).message}`));
    const interval = Math.max(1_000, Number(process.env.INDEXER_POLL_MS ?? 5_000));
    this.timer = setInterval(() => {
      void this.syncOnce().catch((error) => this.logger.warn(`Index sync failed: ${(error as Error).message}`));
    }, interval);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async syncOnce(): Promise<void> {
    if (this.syncing || !this.storage.isAvailable()) return;
    this.syncing = true;
    try {
      const latest = await this.chain.provider.getBlockNumber();
      const confirmations = Math.max(0, Number(process.env.INDEXER_CONFIRMATIONS ?? 1));
      const safeHead = latest - confirmations;
      if (safeHead < 0) return;

      const configuredStart = Number(process.env.INDEXER_FROM_BLOCK ?? 0);
      let nextBlock = (await this.storage.getIndexerCursor()) ?? configuredStart;
      const chunkSize = Math.max(1, Number(process.env.INDEXER_CHUNK_SIZE ?? 2_000));

      while (nextBlock <= safeHead) {
        const toBlock = Math.min(safeHead, nextBlock + chunkSize - 1);
        const logs = await this.chain.provider.getLogs({
          address: this.chain.deployment.contracts.batchRegistry,
          fromBlock: nextBlock,
          toBlock,
        });

        for (const log of logs) {
          const parsed = this.chain.batchRegistry.interface.parseLog({ topics: [...log.topics], data: log.data });
          if (!parsed || !this.hasBatchId(parsed.args)) continue;
          const batchId = String(parsed.args.batchId);
          const batch = await this.chain.batchRegistry.getBatch(batchId);
          const snapshot = this.snapshot(batch, batchId, log.transactionHash, log.blockNumber);
          await this.storage.recordEvent({
            txHash: log.transactionHash,
            logIndex: log.index,
            batchId,
            eventName: parsed.name,
            blockNumber: log.blockNumber,
            payload: this.serializeArgs(parsed.args),
          });
          await this.storage.upsertBatch(snapshot);
        }

        nextBlock = toBlock + 1;
        await this.storage.setIndexerCursor(nextBlock);
      }
    } finally {
      this.syncing = false;
    }
  }

  private snapshot(batch: ethers.Result, batchId: string, txHash: string, blockNumber: number): BatchSnapshot {
    return {
      batchId,
      farmerId: String(batch.farmerId),
      coopId: String(batch.coopId),
      cropCode: Number(batch.cropCode),
      weightGrams: String(batch.weightGrams),
      pricePerKgPaise: String(batch.pricePerKgPaise),
      aiGrade: Number(batch.aiGrade),
      aiFlags: Number(batch.aiFlags),
      lastRecordHash: String(batch.lastRecordHash),
      stage: STAGE_NAMES[Number(batch.stage)] ?? `UNKNOWN_${String(batch.stage)}`,
      createdAt: String(batch.createdAt),
      txHash,
      blockNumber,
    };
  }

  private hasBatchId(args: ethers.Result): args is ethers.Result & { batchId: string } {
    return typeof args?.batchId === 'string' && ethers.isHexString(args.batchId, 32);
  }

  private serializeArgs(args: ethers.Result): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(args)) {
      if (/^\d+$/.test(key)) continue;
      const value = args[key];
      output[key] = typeof value === 'bigint' ? value.toString() : String(value);
    }
    return output;
  }
}
