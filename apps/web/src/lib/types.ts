export type TraceRecord = {
  index: number;
  stage: string;
  from: string;
  to: string;
  pricePerKgPaise: number;
  timestamp: string;
  recordHash: string;
  prevRecordHash: string;
  verified: boolean;
};

export type TraceResponse = {
  batchId: string;
  shortCode: string;
  verified: boolean;
  stage: string;
  crop: string;
  farmerId: string;
  coopId: string;
  weightGrams: number;
  pricePerKgPaise: number;
  createdAt: string;
  lastRecordHash: string;
  ai: { grade: number; flags: number[]; rawFlags: number };
  records: TraceRecord[];
  settlement: { settled: boolean };
  priceSplit: unknown[];
};

export type DemoBatch = { batchId: string; shortCode: string; stage: string };
