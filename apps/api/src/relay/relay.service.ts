import { BadRequestException, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { Contract, Wallet } from 'ethers';
import { ethers } from 'ethers';
import { ChainService } from '../chain/chain.service';
import { StorageService, type IdempotencyRecord } from '../storage/storage.service';

export const RELAY_ACTIONS = ['create-batch', 'handover', 'ai-attest', 'mark-sold', 'settle'] as const;
export type RelayAction = (typeof RELAY_ACTIONS)[number];

const REQUIRED_FIELDS: Record<RelayAction, { data: string[]; signatures: string[] }> = {
  'create-batch': {
    data: ['batchId', 'farmerId', 'coopId', 'cropCode', 'weightGrams', 'pricePerKgPaise', 'photoHash', 'metadataHash', 'geoHash', 'coopSigner', 'buyerSigner', 'coopNonce', 'buyerNonce', 'deadline'],
    signatures: ['coop', 'buyer'],
  },
  handover: {
    data: ['batchId', 'fromSigner', 'toSigner', 'nextStage', 'pricePerKgPaise', 'locationHash', 'prevRecordHash', 'fromNonce', 'toNonce', 'deadline'],
    signatures: ['from', 'to'],
  },
  'ai-attest': {
    data: ['batchId', 'aiGrade', 'aiFlags', 'resultHash', 'oracleSigner', 'nonce', 'deadline'],
    signatures: ['oracle'],
  },
  'mark-sold': {
    data: ['batchId', 'finalPricePerKgPaise', 'buyerSigner', 'mandiAgentSigner', 'buyerNonce', 'mandiNonce', 'deadline'],
    signatures: ['buyer', 'mandiAgent'],
  },
  settle: {
    data: ['batchId', 'recipients'],
    signatures: [],
  },
};

/**
 * Minimal meta-transaction relayer: clients submit EIP-712 typed-data payloads
 * plus the actor signatures; the contract enforces the real rules (roles,
 * nonces, deadlines, state machine). This service only sanity-checks shapes
 * and forwards through the server-held relayer wallet.
 */
@Injectable()
export class RelayService {
  private readonly idempotency = new Map<string, IdempotencyRecord>();

  constructor(
    private readonly chain: ChainService,
    @Optional() private readonly storage?: StorageService,
  ) {}

  info() {
    return {
      configured: this.chain.relayer !== null,
      relayerAddress: this.chain.relayer?.address ?? null,
      chainId: this.chain.deployment.chainId,
      network: this.chain.deployment.network,
      // Everything a client needs to build the EIP-712 signing domain locally.
      eip712: {
        name: 'SachBazaar',
        version: '1',
        chainId: Number(this.chain.deployment.chainId),
        verifyingContract: this.chain.deployment.contracts.batchRegistry,
      },
      contracts: {
        batchRegistry: this.chain.deployment.contracts.batchRegistry,
        mockUsdc: this.chain.deployment.contracts.mockUsdc,
        paymentPool: this.chain.deployment.contracts.paymentPool,
      },
    };
  }

  async submit(
    action: RelayAction,
    body: unknown,
    idempotencyKey?: string,
  ): Promise<{ accepted: true; confirmed: true; txHash: string; blockNumber: number | null; relayedBy: string; chainId: string }> {
    let relayer: Wallet;
    try {
      relayer = this.chain.relayerOrThrow();
    } catch {
      throw new ServiceUnavailableException('Relayer is not configured on this API instance');
    }

    const { data, signatures } = this.validate(action, body);
    const fingerprint = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ action, data, signatures })));
    if (idempotencyKey) {
      if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
        throw new BadRequestException('Idempotency-Key must be 8-128 ASCII letters, numbers, dots, underscores, colons, or hyphens');
      }
      const stored = this.idempotency.get(idempotencyKey) ?? (await this.storage?.getIdempotency(idempotencyKey)) ?? null;
      if (stored) {
        if (stored.fingerprint !== fingerprint) throw new BadRequestException('Idempotency-Key was already used for a different request');
        return stored.response;
      }
    }
    const args: unknown[] = action === 'settle' ? [data.batchId, data.recipients] : [data, ...signatures];

    const [contract, method] = this.target(action);
    const fn = (contract.connect(relayer) as unknown as Record<
      string,
      {
        staticCall: (...a: unknown[]) => Promise<unknown>;
        send: (...a: unknown[]) => Promise<{ hash: string; wait: () => Promise<{ status?: number; blockNumber?: number }> }>;
      }
    >)[method];

    try {
      await fn.staticCall(...args);
    } catch (error) {
      throw new BadRequestException(`Transaction would revert: ${revertReason(error)}`);
    }
    let tx: { hash: string; wait: () => Promise<{ status?: number; blockNumber?: number }> } | undefined;
    try {
      tx = await fn.send(...args);
      const receipt = await tx.wait();
      if (receipt.status === 0) throw new Error('transaction was mined with a failed status');
      const response = {
        accepted: true as const,
        confirmed: true as const,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber ?? null,
        relayedBy: relayer.address,
        chainId: this.chain.deployment.chainId,
      };
      await this.storage?.recordTransaction({
        txHash: tx.hash,
        action,
        status: 'confirmed',
        blockNumber: receipt.blockNumber ?? null,
      });
      if (idempotencyKey) {
        const record = { fingerprint, response };
        this.idempotency.set(idempotencyKey, record);
        await this.storage?.setIdempotency(idempotencyKey, record);
      }
      return response;
    } catch (error) {
      if (tx?.hash) {
        await this.storage?.recordTransaction({ txHash: tx.hash, action, status: 'failed', error: revertReason(error) });
      }
      throw new ServiceUnavailableException(`Transaction submission failed: ${revertReason(error)}`);
    }
  }

  private target(action: RelayAction): [Contract, string] {
    switch (action) {
      case 'settle':
        return [this.chain.paymentPool, 'settle'];
      case 'create-batch':
        return [this.chain.batchRegistry, 'createBatch'];
      case 'handover':
        return [this.chain.batchRegistry, 'recordHandover'];
      case 'ai-attest':
        return [this.chain.batchRegistry, 'attestAI'];
      case 'mark-sold':
        return [this.chain.batchRegistry, 'markSold'];
    }
  }

  private validate(action: RelayAction, body: unknown): { data: Record<string, unknown>; signatures: string[] } {
    const spec = REQUIRED_FIELDS[action];
    if (typeof body !== 'object' || body === null || typeof (body as { data?: unknown }).data !== 'object') {
      throw new BadRequestException('Body must be { data: {...}, signatures: {...} }');
    }
    const payload = body as { data: Record<string, unknown>; signatures?: Record<string, unknown> };
    for (const field of spec.data) {
      if (payload.data[field] === undefined || payload.data[field] === null) {
        throw new BadRequestException(`Missing field data.${field}`);
      }
    }
    const sigs: string[] = [];
    for (const name of spec.signatures) {
      const sig = payload.signatures?.[name];
      if (typeof sig !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(sig)) {
        throw new BadRequestException(`signatures.${name} must be a 0x-prefixed 65-byte signature`);
      }
      sigs.push(sig);
    }

    const deadline = Number(payload.data.deadline);
    if (Number.isFinite(deadline) && deadline > 0 && deadline < Math.floor(Date.now() / 1000) - 60) {
      throw new BadRequestException('data.deadline is in the past');
    }
    for (const key of Object.keys(payload.data)) {
      if (key.endsWith('Signer') && typeof payload.data[key] === 'string' && !ethers.isAddress(payload.data[key])) {
        throw new BadRequestException(`data.${key} is not a valid address`);
      }
    }
    if (action === 'settle') {
      const r = payload.data.recipients as Record<string, unknown> | undefined;
      for (const role of ['farmer', 'coop', 'trucker', 'coldStorage', 'mandiAgent', 'platform']) {
        if (typeof r?.[role] !== 'string' || !ethers.isAddress(r[role])) {
          throw new BadRequestException(`data.recipients.${role} must be a valid address`);
        }
      }
    }
    return { data: payload.data, signatures: sigs };
  }
}

function revertReason(error: unknown): string {
  const e = error as { errorName?: string; errorArgs?: unknown[]; shortMessage?: string; reason?: string; message?: string };
  if (e?.errorName) {
    const args = Array.isArray(e.errorArgs) && e.errorArgs.length > 0 ? `(${e.errorArgs.map((a) => String(a)).join(', ')})` : '';
    return `${e.errorName}${args}`;
  }
  return e?.shortMessage ?? e?.reason ?? e?.message ?? 'unknown revert';
}
