export const CHAIN_IDS = {
  hardhat: 31337,
  amoy: 80002,
  polygon: 137,
} as const;

export type SettlementMode = 'ONCHAIN_STABLECOIN' | 'OFFCHAIN_RECORD_ONLY';

export const CONTRACT_VERSION = '1.0.0';

export * from './eip712.js';
