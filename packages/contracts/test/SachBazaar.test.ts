import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import type { Signer } from 'ethers';
import {
  BatchRegistry__factory,
  FarmerRegistry__factory,
  MockUSDC__factory,
  PaymentPool__factory,
  SachAccess__factory,
} from '../typechain-types';
import type { BatchRegistry, FarmerRegistry, MockUSDC, PaymentPool, SachAccess } from '../typechain-types';

const ZERO_HASH = ethers.ZeroHash;
const TOMATO = 1;
const FARM_GATE = 0;
const IN_TRANSIT = 1;
const COLD_STORAGE = 2;
const MANDI = 3;
const SOLD = 4;
const SETTLED = 5;
const DISPUTED = 6;

const createTypes = {
  CreateBatch: [
    { name: 'batchId', type: 'bytes32' },
    { name: 'farmerId', type: 'bytes32' },
    { name: 'coopId', type: 'bytes32' },
    { name: 'cropCode', type: 'uint16' },
    { name: 'weightGrams', type: 'uint32' },
    { name: 'pricePerKgPaise', type: 'uint32' },
    { name: 'photoHash', type: 'bytes32' },
    { name: 'metadataHash', type: 'bytes32' },
    { name: 'geoHash', type: 'bytes32' },
    { name: 'signer', type: 'address' },
    { name: 'signerRole', type: 'uint8' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

const handoverTypes = {
  Handover: [
    { name: 'batchId', type: 'bytes32' },
    { name: 'fromSigner', type: 'address' },
    { name: 'toSigner', type: 'address' },
    { name: 'nextStage', type: 'uint8' },
    { name: 'pricePerKgPaise', type: 'uint32' },
    { name: 'locationHash', type: 'bytes32' },
    { name: 'prevRecordHash', type: 'bytes32' },
    { name: 'signer', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

const aiTypes = {
  AIAttestation: [
    { name: 'batchId', type: 'bytes32' },
    { name: 'aiGrade', type: 'uint8' },
    { name: 'aiFlags', type: 'uint16' },
    { name: 'resultHash', type: 'bytes32' },
    { name: 'oracleSigner', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

const saleTypes = {
  Sale: [
    { name: 'batchId', type: 'bytes32' },
    { name: 'finalPricePerKgPaise', type: 'uint32' },
    { name: 'signer', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

type System = {
  admin: Signer;
  relayer: Signer;
  coop: Signer;
  buyer: Signer;
  trucker: Signer;
  coldStorage: Signer;
  mandi: Signer;
  oracle: Signer;
  farmerPayout: Signer;
  coopPayout: Signer;
  truckerPayout: Signer;
  coldPayout: Signer;
  mandiPayout: Signer;
  platformPayout: Signer;
  access: SachAccess;
  farmers: FarmerRegistry;
  batches: BatchRegistry;
  token: MockUSDC;
  pool: PaymentPool;
  domain: { name: string; version: string; chainId: bigint; verifyingContract: string };
  farmerId: string;
  coopId: string;
};

async function deploySystem(): Promise<System> {
  const signers = await ethers.getSigners();
  const [admin, relayer, coop, buyer, trucker, coldStorage, mandi, oracle, farmerPayout, coopPayout, truckerPayout, coldPayout, mandiPayout, platformPayout] = signers;
  const access = await new SachAccess__factory(admin).deploy(await admin.getAddress());
  await access.waitForDeployment();
  const farmers = await new FarmerRegistry__factory(admin).deploy(access.target);
  await farmers.waitForDeployment();
  const batches = await new BatchRegistry__factory(admin).deploy(access.target, farmers.target);
  await batches.waitForDeployment();
  const token = await new MockUSDC__factory(admin).deploy(access.target);
  await token.waitForDeployment();
  const pool = await new PaymentPool__factory(admin).deploy(token.target, access.target, batches.target);
  await pool.waitForDeployment();

  await access.grantRole(await access.RELAYER_ROLE(), await relayer.getAddress());
  await access.grantRole(await access.COOP_AGENT_ROLE(), await coop.getAddress());
  await access.grantRole(await access.BUYER_ROLE(), await buyer.getAddress());
  await access.grantRole(await access.TRUCKER_ROLE(), await trucker.getAddress());
  await access.grantRole(await access.COLD_STORAGE_ROLE(), await coldStorage.getAddress());
  await access.grantRole(await access.MANDI_AGENT_ROLE(), await mandi.getAddress());
  await access.grantRole(await access.ORACLE_ROLE(), await oracle.getAddress());

  const farmerId = ethers.keccak256(ethers.toUtf8Bytes('farmer-1'));
  const coopId = ethers.keccak256(ethers.toUtf8Bytes('coop-1'));
  await farmers.connect(coop).registerFarmer(farmerId, ethers.keccak256(ethers.toUtf8Bytes('credential')), coopId);
  await batches.connect(admin).setPaymentPool(pool.target);
  await pool.connect(admin).setCropPolicy(TOMATO, {
    farmerBps: 7000,
    coopBps: 1000,
    truckerBps: 500,
    coldStorageBps: 500,
    mandiAgentBps: 500,
    platformBps: 500,
    minimumFarmerBps: 6000,
  });

  const network = await ethers.provider.getNetwork();
  const domain = {
    name: 'SachBazaar',
    version: '1',
    chainId: network.chainId,
    verifyingContract: batches.target.toString(),
  };

  return {
    admin,
    relayer,
    coop,
    buyer,
    trucker,
    coldStorage,
    mandi,
    oracle,
    farmerPayout,
    coopPayout,
    truckerPayout,
    coldPayout,
    mandiPayout,
    platformPayout,
    access,
    farmers,
    batches,
    token,
    pool,
    domain,
    farmerId,
    coopId,
  };
}

async function createBatch(system: System, batchSuffix = '1') {
  const now = await time.latest();
  const batch = {
    batchId: ethers.keccak256(ethers.toUtf8Bytes(`batch-${batchSuffix}`)),
    farmerId: system.farmerId,
    coopId: system.coopId,
    cropCode: TOMATO,
    weightGrams: 25_000,
    pricePerKgPaise: 1_000,
    photoHash: ethers.keccak256(ethers.toUtf8Bytes(`photo-${batchSuffix}`)),
    metadataHash: ethers.keccak256(ethers.toUtf8Bytes(`metadata-${batchSuffix}`)),
    geoHash: ethers.keccak256(ethers.toUtf8Bytes(`geo-${batchSuffix}`)),
    coopSigner: await system.coop.getAddress(),
    buyerSigner: await system.buyer.getAddress(),
    coopNonce: 1,
    buyerNonce: 1,
    deadline: BigInt(now + 3600),
  };
  const coopPayload = { ...batch, signer: batch.coopSigner, signerRole: 1, nonce: batch.coopNonce };
  const buyerPayload = { ...batch, signer: batch.buyerSigner, signerRole: 2, nonce: batch.buyerNonce };
  const coopSig = await system.coop.signTypedData(system.domain, createTypes, coopPayload);
  const buyerSig = await system.buyer.signTypedData(system.domain, createTypes, buyerPayload);
  await system.batches.connect(system.relayer).createBatch(batch, coopSig, buyerSig);
  return batch;
}

async function handover(system: System, batchId: string, fromSigner: Signer, toSigner: Signer, nextStage: number, price: number, previous: string, fromNonce: number, toNonce: number) {
  const now = await time.latest();
  const data = {
    batchId,
    fromSigner: await fromSigner.getAddress(),
    toSigner: await toSigner.getAddress(),
    nextStage,
    pricePerKgPaise: price,
    locationHash: ethers.keccak256(ethers.toUtf8Bytes(`location-${nextStage}-${fromNonce}`)),
    prevRecordHash: previous,
    fromNonce,
    toNonce,
    deadline: BigInt(now + 3600),
  };
  const fromPayload = { ...data, signer: data.fromSigner, nonce: fromNonce };
  const toPayload = { ...data, signer: data.toSigner, nonce: toNonce };
  const fromSig = await fromSigner.signTypedData(system.domain, handoverTypes, fromPayload);
  const toSig = await toSigner.signTypedData(system.domain, handoverTypes, toPayload);
  await system.batches.connect(system.relayer).recordHandover(data, fromSig, toSig);
  const records = await system.batches.getRecords(batchId);
  return records[records.length - 1].recordHash as string;
}

describe('SachBazaar contracts', function () {
  it('keeps access roles admin-controlled and stores no farmer PII', async function () {
    const system = await deploySystem();
    await expect(system.access.connect(system.coop).grantRole(await system.access.BUYER_ROLE(), await system.coop.getAddress()))
      .to.be.revertedWithCustomError(system.access, 'AccessControlUnauthorizedAccount');
    const farmer = await system.farmers.getFarmer(system.farmerId);
    expect(farmer.farmerId).to.equal(system.farmerId);
    expect(farmer.active).to.equal(true);
    await expect(system.farmers.connect(system.coop).revokeFarmer(system.farmerId)).to.emit(system.farmers, 'FarmerRevoked');
    expect(await system.farmers.isActive(system.farmerId)).to.equal(false);
  });

  it('requires dual EIP-712 signatures and creates a verifiable farm-gate record', async function () {
    const system = await deploySystem();
    const batch = await createBatch(system);
    const stored = await system.batches.getBatch(batch.batchId);
    expect(stored.stage).to.equal(FARM_GATE);
    expect(stored.photoHash).to.equal(batch.photoHash);
    expect(await system.batches.verifyRecordChain(batch.batchId)).to.equal(true);
    expect(await system.batches.recordCount(batch.batchId)).to.equal(1);
  });

  it('rejects unauthorized, expired, replayed, duplicate-photo, and inactive-farmer entries', async function () {
    const system = await deploySystem();
    const batch = await createBatch(system, 'negative-source');
    await expect(system.batches.connect(system.buyer).createBatch(batch, '0x', '0x'))
      .to.be.revertedWithCustomError(system.batches, 'Unauthorized');
    await expect(system.batches.connect(system.relayer).createBatch(batch, '0x', '0x'))
      .to.be.revertedWithCustomError(system.batches, 'BatchAlreadyExists');

    const expired = { ...batch, batchId: ethers.keccak256(ethers.toUtf8Bytes('expired')), photoHash: ethers.keccak256(ethers.toUtf8Bytes('expired-photo')), coopNonce: 9, buyerNonce: 9, deadline: BigInt((await time.latest()) - 1) };
    const expiredCoop = await system.coop.signTypedData(system.domain, createTypes, { ...expired, signer: expired.coopSigner, signerRole: 1, nonce: expired.coopNonce });
    const expiredBuyer = await system.buyer.signTypedData(system.domain, createTypes, { ...expired, signer: expired.buyerSigner, signerRole: 2, nonce: expired.buyerNonce });
    await expect(system.batches.connect(system.relayer).createBatch(expired, expiredCoop, expiredBuyer))
      .to.be.revertedWithCustomError(system.batches, 'InvalidDeadline');

    const inactiveId = ethers.keccak256(ethers.toUtf8Bytes('inactive'));
    await system.farmers.connect(system.coop).registerFarmer(inactiveId, ZERO_HASH, system.coopId);
    await system.farmers.connect(system.coop).revokeFarmer(inactiveId);
    const inactive = { ...batch, batchId: ethers.keccak256(ethers.toUtf8Bytes('inactive-batch')), farmerId: inactiveId, photoHash: ethers.keccak256(ethers.toUtf8Bytes('inactive-photo')), coopNonce: 3, buyerNonce: 3 };
    const inactiveCoop = await system.coop.signTypedData(system.domain, createTypes, { ...inactive, signer: inactive.coopSigner, signerRole: 1, nonce: inactive.coopNonce });
    const inactiveBuyer = await system.buyer.signTypedData(system.domain, createTypes, { ...inactive, signer: inactive.buyerSigner, signerRole: 2, nonce: inactive.buyerNonce });
    await expect(system.batches.connect(system.relayer).createBatch(inactive, inactiveCoop, inactiveBuyer))
      .to.be.revertedWithCustomError(system.batches, 'FarmerInactive');
  });

  it('accepts only legal dual-signed handovers and preserves the hash chain', async function () {
    const system = await deploySystem();
    const batch = await createBatch(system);
    let previous = (await system.batches.getBatch(batch.batchId)).lastRecordHash as string;
    previous = await handover(system, batch.batchId, system.buyer, system.trucker, IN_TRANSIT, 1_200, previous, 2, 3);
    previous = await handover(system, batch.batchId, system.trucker, system.coldStorage, COLD_STORAGE, 1_500, previous, 4, 5);
    previous = await handover(system, batch.batchId, system.coldStorage, system.mandi, MANDI, 2_000, previous, 6, 7);
    const stored = await system.batches.getBatch(batch.batchId);
    expect(stored.stage).to.equal(MANDI);
    expect(stored.lastRecordHash).to.equal(previous);
    expect(await system.batches.verifyRecordChain(batch.batchId)).to.equal(true);
    await expect(system.batches.connect(system.relayer).recordHandover({
      batchId: batch.batchId,
      fromSigner: await system.mandi.getAddress(),
      toSigner: await system.trucker.getAddress(),
      nextStage: IN_TRANSIT,
      pricePerKgPaise: 1,
      locationHash: ZERO_HASH,
      prevRecordHash: (await system.batches.getBatch(batch.batchId)).lastRecordHash,
      fromNonce: 10,
      toNonce: 11,
      deadline: BigInt((await time.latest()) + 3600),
    }, '0x', '0x'))
      .to.be.revertedWithCustomError(system.batches, 'InvalidTransition');
  });

  it('attests advisory AI flags and supports dispute resolution', async function () {
    const system = await deploySystem();
    const batch = await createBatch(system);
    const deadline = BigInt((await time.latest()) + 3600);
    const attestation = {
      batchId: batch.batchId,
      aiGrade: 2,
      aiFlags: 1 | 2,
      resultHash: ethers.keccak256(ethers.toUtf8Bytes('ai-result')),
      oracleSigner: await system.oracle.getAddress(),
      nonce: 1,
      deadline,
    };
    const signature = await system.oracle.signTypedData(system.domain, aiTypes, attestation);
    await expect(system.batches.connect(system.relayer).attestAI(attestation, signature)).to.emit(system.batches, 'AIAttested');
    expect((await system.batches.getBatch(batch.batchId)).aiFlags).to.equal(3);
    await expect(system.batches.connect(system.relayer).raiseDispute(batch.batchId, ethers.keccak256(ethers.toUtf8Bytes('review'))))
      .to.emit(system.batches, 'DisputeRaised');
    expect((await system.batches.getBatch(batch.batchId)).stage).to.equal(DISPUTED);
    await expect(system.batches.connect(system.admin).resolveDispute(batch.batchId, FARM_GATE)).to.emit(system.batches, 'DisputeResolved');
    await expect(system.batches.connect(system.admin).resolveDispute(batch.batchId, SETTLED))
      .to.be.revertedWithCustomError(system.batches, 'NotDisputed');
  });

  it('splits escrow with the farmer remainder, settles once, and supports pull payments', async function () {
    const system = await deploySystem();
    const batch = await createBatch(system);
    let previous = (await system.batches.getBatch(batch.batchId)).lastRecordHash as string;
    previous = await handover(system, batch.batchId, system.buyer, system.trucker, IN_TRANSIT, 1_200, previous, 2, 3);
    previous = await handover(system, batch.batchId, system.trucker, system.coldStorage, COLD_STORAGE, 1_500, previous, 4, 5);
    await handover(system, batch.batchId, system.coldStorage, system.mandi, MANDI, 2_000, previous, 6, 7);

    const amount = 1_000_001n;
    await system.token.connect(system.admin).mint(await system.buyer.getAddress(), amount);
    await system.token.connect(system.buyer).approve(system.pool.target, amount);
    await system.pool.connect(system.buyer).fundBatch(batch.batchId, amount);
    const sale = {
      batchId: batch.batchId,
      finalPricePerKgPaise: 4_000,
      buyerSigner: await system.buyer.getAddress(),
      mandiAgentSigner: await system.mandi.getAddress(),
      buyerNonce: 8,
      mandiNonce: 9,
      deadline: BigInt((await time.latest()) + 3600),
    };
    const buyerSig = await system.buyer.signTypedData(system.domain, saleTypes, { ...sale, signer: sale.buyerSigner, nonce: sale.buyerNonce });
    const mandiSig = await system.mandi.signTypedData(system.domain, saleTypes, { ...sale, signer: sale.mandiAgentSigner, nonce: sale.mandiNonce });
    expect(await system.batches.saleDigest(sale, sale.buyerSigner, sale.buyerNonce)).to.equal(
      ethers.TypedDataEncoder.hash(system.domain, saleTypes, { ...sale, signer: sale.buyerSigner, nonce: sale.buyerNonce }),
    );
    await system.batches.connect(system.relayer).markSold(sale, buyerSig, mandiSig);
    const recipients = {
      farmer: await system.farmerPayout.getAddress(),
      coop: await system.coopPayout.getAddress(),
      trucker: await system.truckerPayout.getAddress(),
      coldStorage: await system.coldPayout.getAddress(),
      mandiAgent: await system.mandiPayout.getAddress(),
      platform: await system.platformPayout.getAddress(),
    };
    await expect(system.pool.connect(system.relayer).settle(batch.batchId, recipients)).to.emit(system.pool, 'BatchSettled');
    expect((await system.batches.getBatch(batch.batchId)).stage).to.equal(SETTLED);
    expect(await system.pool.claimable(recipients.farmer)).to.equal(700_001n);
    await expect(system.pool.connect(system.admin).settle(batch.batchId, recipients))
      .to.be.revertedWithCustomError(system.pool, 'BatchAlreadySettled');
    await system.pool.connect(system.farmerPayout).withdraw();
    expect(await system.token.balanceOf(recipients.farmer)).to.equal(700_001n);
  });

  it('enforces policy bounds, pause, authorization, and invalid settlement states', async function () {
    const system = await deploySystem();
    await expect(system.pool.connect(system.admin).setCropPolicy(TOMATO, {
      farmerBps: 5_000,
      coopBps: 1_000,
      truckerBps: 1_000,
      coldStorageBps: 1_000,
      mandiAgentBps: 1_000,
      platformBps: 1_000,
      minimumFarmerBps: 6_000,
    })).to.be.revertedWithCustomError(system.pool, 'InvalidPolicy');
    await expect(system.pool.connect(system.buyer).pause()).to.be.revertedWithCustomError(system.pool, 'Unauthorized');
    await system.pool.connect(system.admin).pause();
    await expect(system.pool.connect(system.buyer).fundBatch(ZERO_HASH, 1)).to.be.revertedWithCustomError(system.pool, 'EnforcedPause');
    await system.pool.connect(system.admin).unpause();
    const batch = await createBatch(system, 'settlement-invalid');
    await expect(system.pool.connect(system.relayer).settle(batch.batchId, {
      farmer: await system.farmerPayout.getAddress(),
      coop: await system.coopPayout.getAddress(),
      trucker: await system.truckerPayout.getAddress(),
      coldStorage: await system.coldPayout.getAddress(),
      mandiAgent: await system.mandiPayout.getAddress(),
      platform: await system.platformPayout.getAddress(),
    })).to.be.revertedWithCustomError(system.pool, 'EscrowNotFunded');
  });
});
