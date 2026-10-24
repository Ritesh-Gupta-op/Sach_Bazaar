import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Contract, JsonRpcProvider, Wallet, ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

export type DeploymentFile = {
  network: string;
  chainId: string;
  deployedAt: string;
  contracts: {
    sachAccess: string;
    farmerRegistry: string;
    batchRegistry: string;
    mockUsdc: string;
    paymentPool: string;
  };
  demo?: {
    farmerId: string;
    coopId: string;
    batches: { batchId: string; shortCode: string; stage: string }[];
  };
};

/**
 * Single place where chain connectivity is assembled: RPC provider, contract
 * instances built from the shared ABIs, and the server-side relayer wallet.
 * The relayer private key never leaves this process.
 */
@Injectable()
export class ChainService implements OnModuleInit {
  private readonly logger = new Logger(ChainService.name);

  readonly deployment: DeploymentFile;
  readonly provider: JsonRpcProvider;
  readonly relayer: Wallet | null;

  readonly batchRegistry: Contract;
  readonly paymentPool: Contract;
  readonly farmerRegistry: Contract;
  readonly sachAccess: Contract;
  readonly mockUsdc: Contract;

  constructor() {
    const network = process.env.NETWORK ?? 'local';
    // __dirname is <api>/src/chain under ts-node and <api>/dist/chain when built — both 4 levels below the repo root.
    const file = process.env.DEPLOYMENTS_FILE ?? path.join(__dirname, '..', '..', '..', '..', 'deployments', `${network}.json`);
    if (!fs.existsSync(file)) {
      throw new Error(
        `Deployment file not found: ${file}. Run "pnpm --filter @sachbazaar/contracts run seed:demo --network localhost" first or set DEPLOYMENTS_FILE.`,
      );
    }
    this.deployment = JSON.parse(fs.readFileSync(file, 'utf8')) as DeploymentFile;

    this.provider = new JsonRpcProvider(process.env.RPC_URL ?? 'http://127.0.0.1:8545');

    const relayerKey = process.env.RELAYER_PRIVATE_KEY;
    this.relayer = relayerKey && relayerKey !== 'replace-me' ? new Wallet(relayerKey, this.provider) : null;

    const c = this.deployment.contracts;
    this.batchRegistry = new Contract(c.batchRegistry, this.abi('BatchRegistry'), this.provider);
    this.paymentPool = new Contract(c.paymentPool, this.abi('PaymentPool'), this.provider);
    this.farmerRegistry = new Contract(c.farmerRegistry, this.abi('FarmerRegistry'), this.provider);
    this.sachAccess = new Contract(c.sachAccess, this.abi('SachAccess'), this.provider);
    this.mockUsdc = new Contract(c.mockUsdc, this.abi('MockUSDC'), this.provider);
  }

  async onModuleInit(): Promise<void> {
    const chainId = (await this.provider.getNetwork()).chainId.toString();
    if (chainId !== this.deployment.chainId) {
      this.logger.warn(`RPC chainId ${chainId} != deployment chainId ${this.deployment.chainId} — wrong network?`);
    } else {
      this.logger.log(`Connected to ${this.deployment.network} (chainId ${chainId})`);
    }
    if (!this.relayer) {
      this.logger.warn('RELAYER_PRIVATE_KEY is not set — POST /v1/relay/* endpoints will return 503');
    }
  }

  relayerOrThrow(): Wallet {
    if (!this.relayer) {
      throw new Error('Relayer is not configured (RELAYER_PRIVATE_KEY missing)');
    }
    return this.relayer;
  }

  isRevertWith(error: unknown, errorSignature: string): boolean {
    const selector = ethers.id(errorSignature).slice(0, 10);
    const data = error as { data?: string; info?: { error?: { data?: string } } };
    const revertData = data?.data ?? data?.info?.error?.data;
    return typeof revertData === 'string' && revertData.startsWith(selector);
  }

  private abi(name: string): ethers.InterfaceAbi {
    const file = require.resolve(`@sachbazaar/shared/abis/${name}.json`);
    return JSON.parse(fs.readFileSync(file, 'utf8')) as ethers.InterfaceAbi;
  }
}
