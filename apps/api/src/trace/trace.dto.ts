export type TraceRecordDto = {
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

export type TraceResponseDto = {
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
  /** Current head of the record hash chain — the prevRecordHash the next handover must cite. */
  lastRecordHash: string;
  ai: { grade: number; flags: number[]; rawFlags: number };
  records: TraceRecordDto[];
  settlement: { settled: boolean };
  priceSplit: unknown[];
};
