import { BaseWallet, HDNodeWallet, JsonRpcProvider, Mnemonic } from 'ethers';

/**
 * Demo role wallets for the local Hardhat chain. They are derived from Hardhat's
 * public, well-known mnemonic and match the role assignment in
 * packages/contracts/scripts/demo-seed.ts (account #1 = server-side relayer).
 * Never use this scheme on a live network — replace with real user signers.
 */
const HARDHAT_MNEMONIC = 'test test test test test test test test test test test junk';
const DERIVATION_PATH = "m/44'/60'/0'/0";

export type ActorRole = 'coop' | 'buyer' | 'trucker' | 'coldStorage' | 'mandi' | 'oracle' | 'admin';

/** Hardhat account index per actor role (see demo-seed.ts pick()). */
const ACTOR_INDEX: Record<ActorRole, number> = {
  admin: 0,
  coop: 2,
  buyer: 3,
  trucker: 4,
  coldStorage: 5,
  mandi: 6,
  oracle: 7,
};

/** Payout recipient roles for settlement, in PaymentPool.PayoutRecipients field order. */
export const PAYOUT_ROLES = ['farmer', 'coop', 'trucker', 'coldStorage', 'mandiAgent', 'platform'] as const;
export type PayoutRole = (typeof PAYOUT_ROLES)[number];

const PAYOUT_INDEX: Record<PayoutRole, number> = {
  farmer: 8,
  coop: 9,
  trucker: 10,
  coldStorage: 11,
  mandiAgent: 12,
  platform: 13,
};

const provider = new JsonRpcProvider(import.meta.env.VITE_RPC_URL ?? 'http://127.0.0.1:8545');

function accountAt(index: number): BaseWallet {
  return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(HARDHAT_MNEMONIC), `${DERIVATION_PATH}/${index}`).connect(provider);
}

export const actorWallets: Record<ActorRole, BaseWallet> = Object.fromEntries(
  (Object.keys(ACTOR_INDEX) as ActorRole[]).map((role) => [role, accountAt(ACTOR_INDEX[role])]),
) as Record<ActorRole, BaseWallet>;

export const payoutWallets: Record<PayoutRole, BaseWallet> = Object.fromEntries(
  PAYOUT_ROLES.map((role) => [role, accountAt(PAYOUT_INDEX[role])]),
) as Record<PayoutRole, BaseWallet>;

export const chainProvider = provider;

export const ACTOR_LABELS: Record<ActorRole, string> = {
  admin: 'Admin (deployer)',
  coop: 'Co-op agent',
  buyer: 'Buyer',
  trucker: 'Trucker',
  coldStorage: 'Cold storage',
  mandi: 'Mandi agent',
  oracle: 'AI oracle',
};

export const PAYOUT_LABELS: Record<PayoutRole, string> = {
  farmer: 'Farmer',
  coop: 'Co-op',
  trucker: 'Trucker',
  coldStorage: 'Cold storage',
  mandiAgent: 'Mandi agent',
  platform: 'Platform',
};
