import { Contract, ethers, type TypedDataField } from 'ethers';
import { aiAttestationTypes, createBatchTypes, handoverTypes, saleTypes } from '@sachbazaar/shared';
import { chainProvider, signerOf, type AppWallet } from './wallets';

/**
 * The shared package exports its typed-data definitions with `as const`
 * (readonly); ethers' signTypedData/verifyTypedData want the mutable shape.
 */
export const td = (types: Record<string, readonly { name: string; type: string }[]>): Record<string, TypedDataField[]> =>
  types as Record<string, TypedDataField[]>;

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/v1';

export type RelayInfo = {
  configured: boolean;
  relayerAddress: string | null;
  chainId: string;
  network: string;
  eip712: { name: string; version: string; chainId: number; verifyingContract: string };
  contracts: { batchRegistry: string; mockUsdc: string; paymentPool: string };
};

export type BatchesMeta = { farmerId: string; coopId: string; batches: { batchId: string; shortCode: string; stage: string }[] };

export type RelayResult = { accepted: true; txHash: string; relayedBy: string; chainId: string };

export async function fetchRelayInfo(): Promise<RelayInfo> {
  const res = await fetch(`${API_URL}/relay`);
  if (!res.ok) throw new Error(`Relay info error (HTTP ${res.status})`);
  return (await res.json()) as RelayInfo;
}

export async function fetchBatchesMeta(): Promise<BatchesMeta> {
  const res = await fetch(`${API_URL}/batches`);
  if (!res.ok) throw new Error(`Batches error (HTTP ${res.status})`);
  return (await res.json()) as BatchesMeta;
}

/**
 * Explicit nonce slots mean any unused value works; time-in-milliseconds is
 * effectively collision-free for demo signers and needs no chain query.
 */
const nextNonce = () => Date.now();
const nextDeadline = () => Math.floor(Date.now() / 1000) + 3600;

async function postRelay(action: string, data: unknown, signatures: Record<string, string>): Promise<RelayResult> {
  const idempotencyKey = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ action, data, signatures })));
  const res = await fetch(`${API_URL}/relay/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ data, signatures }),
  });
  const body = (await res.json()) as { message?: string } & RelayResult;
  if (!res.ok) {
    throw new Error(body.message ?? `Relay ${action} failed (HTTP ${res.status})`);
  }
  return body;
}

export async function createBatch(
  domain: RelayInfo['eip712'],
  signers: { coop: AppWallet; buyer: AppWallet },
  input: { farmerId: string; coopId: string; weightGrams: number; pricePerKgPaise: number },
): Promise<CreateBatchResult> {
  const data = {
    // batchId = keccak256(abi.encode(coopId, farmerId, cropCode, clientUuid)) per docs/HASHING.md
    batchId: ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32', 'uint16', 'bytes32'],
        [input.coopId, input.farmerId, 1, ethers.hexlify(ethers.randomBytes(32))],
      ),
    ),
    farmerId: input.farmerId,
    coopId: input.coopId,
    cropCode: 1,
    weightGrams: input.weightGrams,
    pricePerKgPaise: input.pricePerKgPaise,
    photoHash: ethers.hexlify(ethers.randomBytes(32)),
    metadataHash: ethers.hexlify(ethers.randomBytes(32)),
    geoHash: ethers.hexlify(ethers.randomBytes(32)),
    coopSigner: signers.coop.address,
    buyerSigner: signers.buyer.address,
    coopNonce: nextNonce(),
    buyerNonce: nextNonce() + 1,
    deadline: nextDeadline(),
  };
  const coopSig = await signers.coop.signTypedData(domain, td(createBatchTypes), { ...data, signer: data.coopSigner, signerRole: 1, nonce: data.coopNonce });
  const buyerSig = await signers.buyer.signTypedData(domain, td(createBatchTypes), { ...data, signer: data.buyerSigner, signerRole: 2, nonce: data.buyerNonce });
  const result = await postRelay('create-batch', data, { coop: coopSig, buyer: buyerSig });
  return { ...result, batchId: data.batchId };
}

export type CreateBatchResult = RelayResult & { batchId: string };

export async function recordHandover(
  domain: RelayInfo['eip712'],
  signers: { from: AppWallet; to: AppWallet },
  input: { batchId: string; nextStage: number; pricePerKgPaise: number; prevRecordHash: string },
): Promise<RelayResult> {
  const data = {
    batchId: input.batchId,
    fromSigner: signers.from.address,
    toSigner: signers.to.address,
    nextStage: input.nextStage,
    pricePerKgPaise: input.pricePerKgPaise,
    locationHash: ethers.hexlify(ethers.randomBytes(32)),
    prevRecordHash: input.prevRecordHash,
    fromNonce: nextNonce(),
    toNonce: nextNonce() + 1,
    deadline: nextDeadline(),
  };
  const fromSig = await signers.from.signTypedData(domain, td(handoverTypes), { ...data, signer: data.fromSigner, nonce: data.fromNonce });
  const toSig = await signers.to.signTypedData(domain, td(handoverTypes), { ...data, signer: data.toSigner, nonce: data.toNonce });
  return postRelay('handover', data, { from: fromSig, to: toSig });
}

export async function attestAI(
  domain: RelayInfo['eip712'],
  oracle: AppWallet,
  input: { batchId: string; grade: number; flags: number },
): Promise<RelayResult> {
  const data = {
    batchId: input.batchId,
    aiGrade: input.grade,
    aiFlags: input.flags,
    resultHash: ethers.hexlify(ethers.randomBytes(32)),
    oracleSigner: oracle.address,
    nonce: nextNonce(),
    deadline: nextDeadline(),
  };
  const signature = await oracle.signTypedData(domain, td(aiAttestationTypes), data);
  return postRelay('ai-attest', data, { oracle: signature });
}

export async function markSold(
  domain: RelayInfo['eip712'],
  signers: { buyer: AppWallet; mandi: AppWallet },
  input: { batchId: string; finalPricePerKgPaise: number },
): Promise<RelayResult> {
  const data = {
    batchId: input.batchId,
    finalPricePerKgPaise: input.finalPricePerKgPaise,
    buyerSigner: signers.buyer.address,
    mandiAgentSigner: signers.mandi.address,
    buyerNonce: nextNonce(),
    mandiNonce: nextNonce() + 1,
    deadline: nextDeadline(),
  };
  const buyerSig = await signers.buyer.signTypedData(domain, td(saleTypes), { ...data, signer: data.buyerSigner, nonce: data.buyerNonce });
  const mandiSig = await signers.mandi.signTypedData(domain, td(saleTypes), { ...data, signer: data.mandiAgentSigner, nonce: data.mandiNonce });
  return postRelay('mark-sold', data, { buyer: buyerSig, mandiAgent: mandiSig });
}

export async function settleBatch(
  batchId: string,
  recipients: { farmer: string; coop: string; trucker: string; coldStorage: string; mandiAgent: string; platform: string },
): Promise<RelayResult> {
  return postRelay('settle', { batchId, recipients }, {});
}

const ERC6_ABI = ['function approve(address, uint256) returns (bool)', 'function mint(address, uint256)', 'function balanceOf(address) view returns (uint256)'];
const POOL_ABI = ['function fundBatch(bytes32, uint256)', 'function claimable(address) view returns (uint256)', 'function withdraw()'];

/** Demo helper: admin mints test USDC (local chain only — the admin key is a public Hardhat account). */
export async function mintDemoUsdc(info: RelayInfo, admin: AppWallet, to: string, amount: number): Promise<string> {
  const token = new Contract(info.contracts.mockUsdc, ERC6_ABI, signerOf(admin));
  const tx = await token.mint(to, amount);
  return tx.hash as string;
}

/** Escrow funding is buyer-direct (BUYER_ROLE, not relayer-gated): approve + fundBatch. */
export async function fundEscrow(info: RelayInfo, buyer: AppWallet, batchId: string, amount: number): Promise<string[]> {
  const signer = signerOf(buyer);
  const token = new Contract(info.contracts.mockUsdc, ERC6_ABI, signer);
  const pool = new Contract(info.contracts.paymentPool, POOL_ABI, signer);
  const approveTx = await token.approve(info.contracts.paymentPool, amount);
  await approveTx.wait();
  const fundTx = await pool.fundBatch(batchId, amount);
  await fundTx.wait();
  return [approveTx.hash, fundTx.hash];
}

export async function claimableFor(info: RelayInfo, address: string): Promise<bigint> {
  const pool = new Contract(info.contracts.paymentPool, POOL_ABI, chainProvider);
  return (await pool.claimable(address)) as bigint;
}

export async function withdrawPayout(info: RelayInfo, payoutWallet: AppWallet): Promise<string> {
  const pool = new Contract(info.contracts.paymentPool, POOL_ABI, signerOf(payoutWallet));
  const tx = await pool.withdraw();
  return tx.hash as string;
}

export async function usdcBalanceOf(info: RelayInfo, address: string): Promise<bigint> {
  const token = new Contract(info.contracts.mockUsdc, ERC6_ABI, chainProvider);
  return (await token.balanceOf(address)) as bigint;
}
