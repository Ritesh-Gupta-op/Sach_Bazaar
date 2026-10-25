export type BatchSnapshot = {
  batchId: string;
  farmerId: string;
  coopId: string;
  cropCode: number;
  weightGrams: string;
  pricePerKgPaise: string;
  aiGrade: number;
  aiFlags: number;
  lastRecordHash: string;
  stage: string;
  createdAt: string;
  txHash?: string | null;
  blockNumber?: number | null;
};

export type IndexedBatch = Pick<BatchSnapshot, 'batchId' | 'stage'> & {
  shortCode: string;
};

export type IndexedEvent = {
  txHash: string;
  logIndex: number;
  batchId: string;
  eventName: string;
  blockNumber: number;
  payload: Record<string, unknown>;
};

export type TransactionRecord = {
  txHash: string;
  action: string;
  status: 'confirmed' | 'failed';
  blockNumber?: number | null;
  error?: string | null;
};
