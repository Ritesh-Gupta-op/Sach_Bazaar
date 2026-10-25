import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { STORAGE_SCHEMA } from './schema';
import type { BatchSnapshot, IndexedBatch, IndexedEvent, TransactionRecord } from './storage.types';

export type IdempotencyRecord = {
  fingerprint: string;
  response: {
    accepted: true;
    confirmed: true;
    txHash: string;
    blockNumber: number | null;
    relayedBy: string;
    chainId: string;
  };
};

/**
 * Optional Postgres persistence for indexed batches and relayed transactions.
 * Chain reads remain the source of truth when DATABASE_URL is not configured or
 * when the local database is temporarily unavailable.
 */
@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private pool: Pool | null = null;
  private ready: Promise<void> = Promise.resolve();

  onModuleInit(): void {
    this.ready = this.initialize();
  }

  async onModuleDestroy(): Promise<void> {
    await this.ready;
    await this.pool?.end();
    this.pool = null;
  }

  async whenReady(): Promise<void> {
    await this.ready;
  }

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async listBatches(): Promise<IndexedBatch[]> {
    const pool = await this.getPool();
    if (!pool) return [];
    const result = await pool.query<{ batch_id: string; stage: string }>(
      'SELECT batch_id, stage FROM batches ORDER BY created_at DESC, batch_id DESC',
    );
    return result.rows.map((row) => ({ batchId: row.batch_id, shortCode: '', stage: row.stage }));
  }

  async upsertBatch(batch: BatchSnapshot): Promise<void> {
    const pool = await this.getPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO batches (
        batch_id, farmer_id, coop_id, crop_code, weight_grams, price_per_kg_paise,
        ai_grade, ai_flags, last_record_hash, stage, created_at, tx_hash, block_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_timestamp($11), $12, $13)
      ON CONFLICT (batch_id) DO UPDATE SET
        farmer_id = EXCLUDED.farmer_id,
        coop_id = EXCLUDED.coop_id,
        crop_code = EXCLUDED.crop_code,
        weight_grams = EXCLUDED.weight_grams,
        price_per_kg_paise = EXCLUDED.price_per_kg_paise,
        ai_grade = EXCLUDED.ai_grade,
        ai_flags = EXCLUDED.ai_flags,
        last_record_hash = EXCLUDED.last_record_hash,
        stage = EXCLUDED.stage,
        created_at = EXCLUDED.created_at,
        tx_hash = COALESCE(EXCLUDED.tx_hash, batches.tx_hash),
        block_number = COALESCE(EXCLUDED.block_number, batches.block_number),
        updated_at = NOW()`,
      [
        batch.batchId,
        batch.farmerId,
        batch.coopId,
        batch.cropCode,
        batch.weightGrams,
        batch.pricePerKgPaise,
        batch.aiGrade,
        batch.aiFlags,
        batch.lastRecordHash,
        batch.stage,
        batch.createdAt,
        batch.txHash ?? null,
        batch.blockNumber ?? null,
      ],
    );
  }

  async recordEvent(event: IndexedEvent): Promise<void> {
    const pool = await this.getPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO batch_events (tx_hash, log_index, batch_id, event_name, block_number, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tx_hash, log_index) DO NOTHING`,
      [event.txHash, event.logIndex, event.batchId, event.eventName, event.blockNumber, JSON.stringify(event.payload)],
    );
  }

  async getIndexerCursor(): Promise<number | null> {
    const pool = await this.getPool();
    if (!pool) return null;
    const result = await pool.query<{ value: string }>('SELECT value FROM indexer_state WHERE key = $1', ['batch-registry-block']);
    const value = result.rows[0]?.value;
    return value === undefined ? null : Number(value);
  }

  async setIndexerCursor(blockNumber: number): Promise<void> {
    const pool = await this.getPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO indexer_state (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      ['batch-registry-block', String(blockNumber)],
    );
  }

  async recordTransaction(transaction: TransactionRecord): Promise<void> {
    const pool = await this.getPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO transactions (tx_hash, action, status, block_number, error)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tx_hash) DO UPDATE SET
         status = EXCLUDED.status,
         block_number = EXCLUDED.block_number,
         error = EXCLUDED.error,
         updated_at = NOW()`,
      [transaction.txHash, transaction.action, transaction.status, transaction.blockNumber ?? null, transaction.error ?? null],
    );
  }

  async getTransaction(txHash: string): Promise<TransactionRecord | null> {
    const pool = await this.getPool();
    if (!pool) return null;
    const result = await pool.query<{
      tx_hash: string;
      action: string;
      status: 'confirmed' | 'failed';
      block_number: number | null;
      error: string | null;
    }>('SELECT tx_hash, action, status, block_number, error FROM transactions WHERE tx_hash = $1', [txHash]);
    const row = result.rows[0];
    return row
      ? { txHash: row.tx_hash, action: row.action, status: row.status, blockNumber: row.block_number, error: row.error }
      : null;
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const pool = await this.getPool();
    if (!pool) return null;
    const result = await pool.query<{ fingerprint: string; response: IdempotencyRecord['response'] }>(
      'SELECT fingerprint, response FROM idempotency_keys WHERE idempotency_key = $1',
      [key],
    );
    const row = result.rows[0];
    return row ? { fingerprint: row.fingerprint, response: row.response } : null;
  }

  async setIdempotency(key: string, record: IdempotencyRecord): Promise<void> {
    const pool = await this.getPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO idempotency_keys (idempotency_key, fingerprint, response)
       VALUES ($1, $2, $3)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [key, record.fingerprint, JSON.stringify(record.response)],
    );
  }

  private async initialize(): Promise<void> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      this.logger.warn('DATABASE_URL is not set — using chain-backed discovery without Postgres persistence');
      return;
    }

    const pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 10),
    });
    try {
      await pool.query(STORAGE_SCHEMA);
      this.pool = pool;
      this.logger.log('Postgres storage is ready');
    } catch (error) {
      await pool.end().catch(() => undefined);
      this.logger.warn(`Postgres unavailable — using chain-backed discovery: ${(error as Error).message}`);
    }
  }

  private async getPool(): Promise<Pool | null> {
    await this.whenReady();
    return this.pool;
  }
}
