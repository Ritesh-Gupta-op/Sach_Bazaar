import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ethers } from 'ethers';
import { aiAttestationTypes, createBatchTypes, handoverTypes, saleTypes } from '@sachbazaar/shared';
import { attestAI, createBatch, markSold, recordHandover, settleBatch, td } from './relay';

const domain = { name: 'SachBazaar', version: '1', chainId: 31337, verifyingContract: '0x1234567890123456789012345678901234567890' } as const;
const OK = { accepted: true as const, txHash: '0xtx', relayedBy: '0xrelayer', chainId: '31337' };

let calls: { url: string; body: Record<string, unknown> }[];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
      return new Response(JSON.stringify(OK), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const bodyOf = (i = 0) => calls[i].body as { data: Record<string, unknown>; signatures: Record<string, string> };

describe('relay payload builders', () => {
  it('createBatch posts to the right action and both signatures recover to their signers', async () => {
    const coop = ethers.Wallet.createRandom();
    const buyer = ethers.Wallet.createRandom();
    const result = await createBatch(domain, { coop, buyer }, { farmerId: ethers.id('f'), coopId: ethers.id('c'), weightGrams: 25_000, pricePerKgPaise: 1_000 });

    expect(calls[0].url).toMatch(/\/relay\/create-batch$/);
    expect(result.batchId).toMatch(/^0x[0-9a-f]{64}$/);
    const { data, signatures } = bodyOf();
    expect(data.coopSigner).toBe(coop.address);
    expect(data.buyerSigner).toBe(buyer.address);
    expect(data.coopNonce).not.toBe(data.buyerNonce);
    expect(ethers.verifyTypedData(domain, td(createBatchTypes), { ...data, signer: data.coopSigner, signerRole: 1, nonce: data.coopNonce }, signatures.coop)).toBe(coop.address);
    expect(ethers.verifyTypedData(domain, td(createBatchTypes), { ...data, signer: data.buyerSigner, signerRole: 2, nonce: data.buyerNonce }, signatures.buyer)).toBe(buyer.address);
  });

  it('recordHandover signs the same struct for from/to with their own nonces', async () => {
    const from = ethers.Wallet.createRandom();
    const to = ethers.Wallet.createRandom();
    await recordHandover(domain, { from, to }, { batchId: ethers.id('b'), nextStage: 1, pricePerKgPaise: 1_200, prevRecordHash: ethers.ZeroHash });
    const { data, signatures } = bodyOf();
    expect(data.nextStage).toBe(1);
    expect(data.fromNonce).not.toBe(data.toNonce);
    expect(ethers.verifyTypedData(domain, td(handoverTypes), { ...data, signer: data.fromSigner, nonce: data.fromNonce }, signatures.from)).toBe(from.address);
    expect(ethers.verifyTypedData(domain, td(handoverTypes), { ...data, signer: data.toSigner, nonce: data.toNonce }, signatures.to)).toBe(to.address);
  });

  it('attestAI signs the attestation struct as the oracle', async () => {
    const oracle = ethers.Wallet.createRandom();
    await attestAI(domain, oracle, { batchId: ethers.id('b'), grade: 2, flags: 0b0101 });
    const { data, signatures } = bodyOf();
    expect(data.aiGrade).toBe(2);
    expect(data.aiFlags).toBe(5);
    expect(ethers.verifyTypedData(domain, td(aiAttestationTypes), data, signatures.oracle)).toBe(oracle.address);
  });

  it('markSold carries buyer and mandiAgent signatures over the sale struct', async () => {
    const buyer = ethers.Wallet.createRandom();
    const mandi = ethers.Wallet.createRandom();
    await markSold(domain, { buyer, mandi }, { batchId: ethers.id('b'), finalPricePerKgPaise: 4_000 });
    const { data, signatures } = bodyOf();
    expect(ethers.verifyTypedData(domain, td(saleTypes), { ...data, signer: data.buyerSigner, nonce: data.buyerNonce }, signatures.buyer)).toBe(buyer.address);
    expect(ethers.verifyTypedData(domain, td(saleTypes), { ...data, signer: data.mandiAgentSigner, nonce: data.mandiNonce }, signatures.mandiAgent)).toBe(mandi.address);
  });

  it('settleBatch posts batchId and recipients without signatures', async () => {
    const recipients = {
      farmer: '0x' + '11'.repeat(20),
      coop: '0x' + '22'.repeat(20),
      trucker: '0x' + '33'.repeat(20),
      coldStorage: '0x' + '44'.repeat(20),
      mandiAgent: '0x' + '55'.repeat(20),
      platform: '0x' + '66'.repeat(20),
    };
    await settleBatch(ethers.id('b'), recipients);
    expect(calls[0].url).toMatch(/\/relay\/settle$/);
    expect(bodyOf().data).toEqual({ batchId: ethers.id('b'), recipients });
  });

  it('surfaces the API error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Missing field data.batchId' }), { status: 400 })),
    );
    await expect(settleBatch('0x' + '00'.repeat(32), {} as never)).rejects.toThrow('Missing field data.batchId');
  });

  it('uses fresh, future deadlines and distinct nonces per signature', async () => {
    const from = ethers.Wallet.createRandom();
    const to = ethers.Wallet.createRandom();
    const before = Math.floor(Date.now() / 1000);
    await recordHandover(domain, { from, to }, { batchId: ethers.id('b'), nextStage: 2, pricePerKgPaise: 1, prevRecordHash: ethers.ZeroHash });
    const { data } = bodyOf();
    expect(Number(data.deadline)).toBeGreaterThan(before);
    expect(Number(data.fromNonce)).toBeGreaterThan(0);
  });
});
