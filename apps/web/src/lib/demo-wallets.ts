import { BaseWallet, HDNodeWallet, Mnemonic } from 'ethers';
import { chainProvider, type ActorRole, type PayoutRole, PAYOUT_ROLES, type WalletConfig } from './wallets';

/**
 * Local-only Hardhat wallets. This module is dynamically loaded only when
 * VITE_DEMO_MODE=true, keeping the demo mnemonic out of production bundles.
 */
const HARDHAT_MNEMONIC = 'test test test test test test test test test test test junk';
const DERIVATION_PATH = "m/44'/60'/0'/0";

const ACTOR_INDEX: Record<ActorRole, number> = {
  admin: 0,
  coop: 2,
  buyer: 3,
  trucker: 4,
  coldStorage: 5,
  mandi: 6,
  oracle: 7,
};

const PAYOUT_INDEX: Record<PayoutRole, number> = {
  farmer: 8,
  coop: 9,
  trucker: 10,
  coldStorage: 11,
  mandiAgent: 12,
  platform: 13,
};

function accountAt(index: number): BaseWallet {
  return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(HARDHAT_MNEMONIC), `${DERIVATION_PATH}/${index}`).connect(chainProvider);
}

export const actorWallets: Record<ActorRole, BaseWallet> = Object.fromEntries(
  (Object.keys(ACTOR_INDEX) as ActorRole[]).map((role) => [role, accountAt(ACTOR_INDEX[role])]),
) as Record<ActorRole, BaseWallet>;

export const payoutWallets: Record<PayoutRole, BaseWallet> = Object.fromEntries(
  PAYOUT_ROLES.map((role) => [role, accountAt(PAYOUT_INDEX[role])]),
) as Record<PayoutRole, BaseWallet>;

export const demoWalletConfig: WalletConfig = { actors: actorWallets, payouts: payoutWallets };
