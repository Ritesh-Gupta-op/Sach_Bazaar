import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ethers } from 'ethers';
import type { ChainService } from '../src/chain/chain.service';
import { RelayService } from '../src/relay/relay.service';

type Captured = { method: string; args: unknown[] };

function stubChain(options: { revertWith?: string } = {}): { chain: ChainService; captured: Captured[] } {
  const captured: Captured[] = [];
  const fn = (method: string) => ({
    staticCall: async (...args: unknown[]) => {
      captured.push({ method, args });
      if (options.revertWith) {
        throw Object.assign(new Error('execution reverted'), { errorName: options.revertWith, errorArgs: ['0x1'] });
      }
      return undefined;
    },
     send: async () => ({ hash: '0xtxhash', wait: async () => ({ status: 1, blockNumber: 42 }) }),
  });
  // RelayService calls contract.connect(relayer) first and then indexes the
  // method on the connected instance — the stub mirrors that shape.
  const makeContract = (methods: Record<string, ReturnType<typeof fn>>) => ({ ...methods, connect: () => methods });
  const chain = {
    deployment: { chainId: '31337', network: 'local', contracts: {} },
    relayer: { address: ethers.Wallet.createRandom().address },
    relayerOrThrow: () => ({ address: '0xrelayer' }),
    batchRegistry: makeContract({ createBatch: fn('createBatch'), recordHandover: fn('recordHandover'), attestAI: fn('attestAI'), markSold: fn('markSold') }),
    paymentPool: makeContract({ settle: fn('settle') }),
  } as unknown as ChainService;
  return { chain, captured };
}

const SIG = () => '0x' + 'ab'.repeat(65);
const FUTURE = Math.floor(Date.now() / 1000) + 3600;

describe('RelayService.submit', () => {
  let service: RelayService;
  let captured: Captured[];

  beforeEach(() => {
    const stub = stubChain();
    service = new RelayService(stub.chain);
    captured = stub.captured;
  });

  it('dispatches a create-batch payload with both signatures in order', async () => {
    const result = await service.submit('create-batch', {
      data: {
        batchId: ethers.id('b'),
        farmerId: ethers.id('f'),
        coopId: ethers.id('c'),
        cropCode: 1,
        weightGrams: 25_000,
        pricePerKgPaise: 1_000,
        photoHash: ethers.id('p'),
        metadataHash: ethers.id('m'),
        geoHash: ethers.id('g'),
        coopSigner: ethers.Wallet.createRandom().address,
        buyerSigner: ethers.Wallet.createRandom().address,
        coopNonce: 1,
        buyerNonce: 2,
        deadline: FUTURE,
      },
      signatures: { coop: SIG(), buyer: SIG() },
    });
    assert.equal(result.txHash, '0xtxhash');
    assert.equal(result.confirmed, true);
    assert.equal(result.blockNumber, 42);
    assert.equal(captured[0].method, 'createBatch');
    assert.equal(captured[0].args.length, 3);
    assert.equal((captured[0].args[1] as string), SIG());
    assert.equal((captured[0].args[2] as string), SIG());
  });

  it('rejects a missing data field with the field name', async () => {
    await assert.rejects(
      service.submit('mark-sold', { data: { batchId: ethers.id('b') }, signatures: {} }),
      (e: BadRequestException) => e instanceof BadRequestException && e.message.includes('finalPricePerKgPaise'),
    );
  });

  it('rejects malformed signatures before touching the chain', async () => {
    await assert.rejects(
      service.submit('ai-attest', {
        data: { batchId: ethers.id('b'), aiGrade: 1, aiFlags: 0, resultHash: ethers.id('r'), oracleSigner: ethers.Wallet.createRandom().address, nonce: 1, deadline: FUTURE },
        signatures: { oracle: '0x1234' },
      }),
      (e: BadRequestException) => e instanceof BadRequestException && e.message.includes('signatures.oracle'),
    );
    assert.equal(captured.length, 0);
  });

  it('rejects deadlines in the past', async () => {
    await assert.rejects(
      service.submit('ai-attest', {
        data: { batchId: ethers.id('b'), aiGrade: 1, aiFlags: 0, resultHash: ethers.id('r'), oracleSigner: ethers.Wallet.createRandom().address, nonce: 1, deadline: FUTURE - 7200 },
        signatures: { oracle: SIG() },
      }),
      (e: BadRequestException) => e instanceof BadRequestException && e.message.includes('deadline'),
    );
  });

  it('validates every settle recipient address', async () => {
    const good = ethers.Wallet.createRandom().address;
    await assert.rejects(
      service.submit('settle', { data: { batchId: ethers.id('b'), recipients: { farmer: '0xnope', coop: good, trucker: good, coldStorage: good, mandiAgent: good, platform: good } } }),
      (e: BadRequestException) => e instanceof BadRequestException && e.message.includes('recipients.farmer'),
    );
  });

  it('maps contract reverts to a 400 carrying the decoded error name', async () => {
    const reverting = new RelayService(stubChain({ revertWith: 'InvalidDeadline(uint256)' }).chain);
    await assert.rejects(
      reverting.submit('ai-attest', {
        data: { batchId: ethers.id('b'), aiGrade: 1, aiFlags: 0, resultHash: ethers.id('r'), oracleSigner: ethers.Wallet.createRandom().address, nonce: 1, deadline: FUTURE },
        signatures: { oracle: SIG() },
      }),
      (e: BadRequestException) => e instanceof BadRequestException && e.message.includes('InvalidDeadline(uint256)'),
    );
  });

  it('reports its configuration state', () => {
    const info = service.info();
    assert.equal(info.configured, true);
    assert.equal(info.network, 'local');
    assert.equal(info.eip712.name, 'SachBazaar');
  });

  it('replays a confirmed response for the same idempotency key', async () => {
    const body = {
      data: {
        batchId: ethers.id('b'),
        aiGrade: 1,
        aiFlags: 0,
        resultHash: ethers.id('r'),
        oracleSigner: ethers.Wallet.createRandom().address,
        nonce: 1,
        deadline: FUTURE,
      },
      signatures: { oracle: SIG() },
    };
    const first = await service.submit('ai-attest', body, 'test-idempotency-key');
    const second = await service.submit('ai-attest', body, 'test-idempotency-key');
    assert.deepEqual(second, first);
    assert.equal(captured.filter((entry) => entry.method === 'attestAI').length, 1);
  });
});
