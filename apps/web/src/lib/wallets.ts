import { BaseWallet, BrowserProvider, JsonRpcProvider, JsonRpcSigner, type TypedDataDomain, type TypedDataField } from 'ethers';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export type ActorRole = 'coop' | 'buyer' | 'trucker' | 'coldStorage' | 'mandi' | 'oracle' | 'admin';

export type AppWallet = BaseWallet | ConnectedWallet;

export class ConnectedWallet {
  constructor(
    public readonly signer: JsonRpcSigner,
    public readonly address: string,
  ) {}

  signTypedData(domain: TypedDataDomain, types: Record<string, TypedDataField[]>, value: Record<string, unknown>): Promise<string> {
    return this.signer.signTypedData(domain, types, value);
  }
}

/** Payout recipient roles for settlement, in PaymentPool.PayoutRecipients field order. */
export const PAYOUT_ROLES = ['farmer', 'coop', 'trucker', 'coldStorage', 'mandiAgent', 'platform'] as const;
export type PayoutRole = (typeof PAYOUT_ROLES)[number];

const provider = new JsonRpcProvider(import.meta.env.VITE_RPC_URL ?? 'http://127.0.0.1:8545');

export const chainProvider = provider;

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== 'false');

export type WalletConfig = {
  actors: Record<ActorRole, AppWallet>;
  payouts: Record<PayoutRole, AppWallet>;
};

const ACTOR_ADDRESS_ENV: Record<ActorRole, string> = {
  admin: 'VITE_ADMIN_ADDRESS',
  coop: 'VITE_COOP_ADDRESS',
  buyer: 'VITE_BUYER_ADDRESS',
  trucker: 'VITE_TRUCKER_ADDRESS',
  coldStorage: 'VITE_COLD_STORAGE_ADDRESS',
  mandi: 'VITE_MANDI_ADDRESS',
  oracle: 'VITE_ORACLE_ADDRESS',
};

const PAYOUT_ADDRESS_ENV: Record<PayoutRole, string> = {
  farmer: 'VITE_FARMER_PAYOUT_ADDRESS',
  coop: 'VITE_COOP_PAYOUT_ADDRESS',
  trucker: 'VITE_TRUCKER_PAYOUT_ADDRESS',
  coldStorage: 'VITE_COLD_STORAGE_PAYOUT_ADDRESS',
  mandiAgent: 'VITE_MANDI_PAYOUT_ADDRESS',
  platform: 'VITE_PLATFORM_PAYOUT_ADDRESS',
};

function configuredAddress(name: string): string {
  const value = import.meta.env[name] as string | undefined;
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${name} must be configured as a wallet address`);
  return value;
}

export async function connectConfiguredWallets(expectedChainId?: string): Promise<WalletConfig> {
  if (!window.ethereum) throw new Error('No browser wallet detected. Install MetaMask or another EIP-1193 wallet.');
  const provider = new BrowserProvider(window.ethereum);
  const accounts = (await provider.send('eth_requestAccounts', [])) as string[];
  const network = await provider.getNetwork();
  if (expectedChainId && network.chainId.toString() !== expectedChainId) {
    throw new Error(`Wrong wallet network. Connect chain ${expectedChainId}, not ${network.chainId.toString()}.`);
  }
  const connected = new Set(accounts.map((address) => address.toLowerCase()));

  const connect = async (name: string): Promise<ConnectedWallet> => {
    const address = configuredAddress(name);
    if (!connected.has(address.toLowerCase())) {
      throw new Error(`Connect ${address} in the browser wallet before using the ${name.replace('VITE_', '').replace('_ADDRESS', '').toLowerCase()} role`);
    }
    return new ConnectedWallet(await provider.getSigner(address), address);
  };

  const actors = {} as Record<ActorRole, AppWallet>;
  for (const role of Object.keys(ACTOR_ADDRESS_ENV) as ActorRole[]) actors[role] = await connect(ACTOR_ADDRESS_ENV[role]);
  const payouts = {} as Record<PayoutRole, AppWallet>;
  for (const role of Object.keys(PAYOUT_ADDRESS_ENV) as PayoutRole[]) payouts[role] = await connect(PAYOUT_ADDRESS_ENV[role]);
  return { actors, payouts };
}

export function signerOf(wallet: AppWallet): BaseWallet | JsonRpcSigner {
  return wallet instanceof ConnectedWallet ? wallet.signer : wallet;
}

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
