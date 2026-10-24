import { ethers } from 'ethers';

export const STAGE_NAMES = ['FARM_GATE', 'IN_TRANSIT', 'COLD_STORAGE', 'MANDI', 'SOLD', 'SETTLED', 'DISPUTED'] as const;

export type StageName = (typeof STAGE_NAMES)[number];

export type ChainRecord = {
  recordHash: string;
  prevRecordHash: string;
  locationHash: string;
  pricePerKgPaise: number | bigint;
  stage: number | bigint;
  timestamp: number | bigint;
  from: string;
  to: string;
};

/**
 * Record hash recomputation per docs/HASHING.md — the exact Solidity field
 * order: keccak256(abi.encode(prevRecordHash, batchId, locationHash, price,
 * uint8(stage), timestamp, from, to)).
 */
export function recordHashOf(batchId: string, r: ChainRecord): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint32', 'uint8', 'uint40', 'address', 'address'],
      [r.prevRecordHash, batchId, r.locationHash, r.pricePerKgPaise, r.stage, r.timestamp, r.from, r.to],
    ),
  );
}

/** Walks the hash chain off-chain and flags each record as verified or not. */
export function verifyRecordWalk(batchId: string, records: ChainRecord[]): { verified: boolean; perRecord: boolean[] } {
  const perRecord: boolean[] = [];
  let previous = ethers.ZeroHash;
  let verified = true;
  for (const r of records) {
    const ok = r.prevRecordHash === previous && recordHashOf(batchId, r) === r.recordHash;
    perRecord.push(ok);
    verified = verified && ok;
    previous = r.recordHash;
  }
  return { verified, perRecord };
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Mirrors shortCodeOf in packages/shared/src/shortCode.ts (kept API-side to avoid an ESM import). */
export function shortCodeOf(batchId: string): string {
  const hex = batchId.replace(/^0x/, '').toLowerCase();
  let bits = 0n;
  for (let i = 0; i < 8; i++) bits = (bits << 8n) | BigInt(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  let code = '';
  for (let i = 12; i >= 0; i--) code += ALPHABET[Number((bits >> BigInt(i * 5)) & 31n)];
  return code;
}
