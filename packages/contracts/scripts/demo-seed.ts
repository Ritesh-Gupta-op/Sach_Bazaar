import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { Signer } from "ethers";
import {
  BatchRegistry__factory,
  FarmerRegistry__factory,
  MockUSDC__factory,
  PaymentPool__factory,
  SachAccess__factory,
} from "../typechain-types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function shortCodeOf(batchId: string): string {
  const hex = batchId.replace(/^0x/, "").toLowerCase();
  let bits = 0n;
  for (let i = 0; i < 8; i++) bits = (bits << 8n) | BigInt(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  let code = "";
  for (let i = 12; i >= 0; i--) code += ALPHABET[Number((bits >> BigInt(i * 5)) & 31n)];
  return code;
}

const createTypes = {
  CreateBatch: [
    { name: "batchId", type: "bytes32" },
    { name: "farmerId", type: "bytes32" },
    { name: "coopId", type: "bytes32" },
    { name: "cropCode", type: "uint16" },
    { name: "weightGrams", type: "uint32" },
    { name: "pricePerKgPaise", type: "uint32" },
    { name: "photoHash", type: "bytes32" },
    { name: "metadataHash", type: "bytes32" },
    { name: "geoHash", type: "bytes32" },
    { name: "signer", type: "address" },
    { name: "signerRole", type: "uint8" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const handoverTypes = {
  Handover: [
    { name: "batchId", type: "bytes32" },
    { name: "fromSigner", type: "address" },
    { name: "toSigner", type: "address" },
    { name: "nextStage", type: "uint8" },
    { name: "pricePerKgPaise", type: "uint32" },
    { name: "locationHash", type: "bytes32" },
    { name: "prevRecordHash", type: "bytes32" },
    { name: "signer", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const aiTypes = {
  AIAttestation: [
    { name: "batchId", type: "bytes32" },
    { name: "aiGrade", type: "uint8" },
    { name: "aiFlags", type: "uint16" },
    { name: "resultHash", type: "bytes32" },
    { name: "oracleSigner", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const saleTypes = {
  Sale: [
    { name: "batchId", type: "bytes32" },
    { name: "finalPricePerKgPaise", type: "uint32" },
    { name: "signer", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const TOMATO = 1;
const FARM_GATE = 0;
const IN_TRANSIT = 1;
const COLD_STORAGE = 2;
const MANDI = 3;

type Roles = {
  admin: Signer;
  relayer: Signer;
  coop: Signer;
  buyer: Signer;
  trucker: Signer;
  coldStorage: Signer;
  mandi: Signer;
  oracle: Signer;
  payouts: Signer[];
};

async function main() {
  const signers = await ethers.getSigners();
  // On a network with a single configured account every role cycles back to the deployer.
  const pick = (i: number) => signers[Math.min(i, signers.length - 1)];
  const roles: Roles = {
    admin: pick(0),
    relayer: pick(1),
    coop: pick(2),
    buyer: pick(3),
    trucker: pick(4),
    coldStorage: pick(5),
    mandi: pick(6),
    oracle: pick(7),
    payouts: [pick(8), pick(9), pick(10), pick(11), pick(12), pick(13)],
  };

  console.log("Deploying SachBazaar demo system on network:", network.name);
  const access = await new SachAccess__factory(roles.admin).deploy(await roles.admin.getAddress());
  await access.waitForDeployment();
  const farmers = await new FarmerRegistry__factory(roles.admin).deploy(access.target);
  await farmers.waitForDeployment();
  const batches = await new BatchRegistry__factory(roles.admin).deploy(access.target, farmers.target);
  await batches.waitForDeployment();
  const token = await new MockUSDC__factory(roles.admin).deploy(access.target);
  await token.waitForDeployment();
  const pool = await new PaymentPool__factory(roles.admin).deploy(token.target, access.target, batches.target);
  await pool.waitForDeployment();
  await batches.connect(roles.admin).setPaymentPool(pool.target);

  await access.connect(roles.admin).grantRole(await access.RELAYER_ROLE(), await roles.relayer.getAddress());
  await access.connect(roles.admin).grantRole(await access.COOP_AGENT_ROLE(), await roles.coop.getAddress());
  await access.connect(roles.admin).grantRole(await access.BUYER_ROLE(), await roles.buyer.getAddress());
  await access.connect(roles.admin).grantRole(await access.TRUCKER_ROLE(), await roles.trucker.getAddress());
  await access.connect(roles.admin).grantRole(await access.COLD_STORAGE_ROLE(), await roles.coldStorage.getAddress());
  await access.connect(roles.admin).grantRole(await access.MANDI_AGENT_ROLE(), await roles.mandi.getAddress());
  await access.connect(roles.admin).grantRole(await access.ORACLE_ROLE(), await roles.oracle.getAddress());
  // Degenerate single-account networks need the deployer to hold every role for dual signatures.
  if (signers.length < 14) {
    const all = [await roles.relayer.getAddress(), await roles.coop.getAddress(), await roles.buyer.getAddress()];
    for (const addr of all) {
      if (addr === (await roles.admin.getAddress())) {
        for (const role of [access.RELAYER_ROLE(), access.COOP_AGENT_ROLE(), access.BUYER_ROLE(), access.TRUCKER_ROLE(), access.COLD_STORAGE_ROLE(), access.MANDI_AGENT_ROLE(), access.ORACLE_ROLE()]) {
          await access.connect(roles.admin).grantRole(await role, addr);
        }
      }
    }
  }

  const farmerId = ethers.keccak256(ethers.toUtf8Bytes("demo-farmer-1"));
  const coopId = ethers.keccak256(ethers.toUtf8Bytes("demo-coop-1"));
  await farmers.connect(roles.coop).registerFarmer(farmerId, ethers.keccak256(ethers.toUtf8Bytes("demo-credential")), coopId);
  await pool.connect(roles.admin).setCropPolicy(TOMATO, {
    farmerBps: 7000,
    coopBps: 1000,
    truckerBps: 500,
    coldStorageBps: 500,
    mandiAgentBps: 500,
    platformBps: 500,
    minimumFarmerBps: 6000,
  });

  const net = await ethers.provider.getNetwork();
  const domain = { name: "SachBazaar", version: "1", chainId: net.chainId, verifyingContract: batches.target.toString() };
  const nonces = new Map<string, number>();
  const nextNonce = (addr: string) => {
    const n = (nonces.get(addr) ?? 0) + 1;
    nonces.set(addr, n);
    return n;
  };
  const future = async () => BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600);

  async function createBatch(suffix: string, weightGrams: number, pricePaise: number) {
    const batch = {
      batchId: ethers.keccak256(ethers.toUtf8Bytes(`demo-batch-${suffix}`)),
      farmerId,
      coopId,
      cropCode: TOMATO,
      weightGrams,
      pricePerKgPaise: pricePaise,
      photoHash: ethers.keccak256(ethers.toUtf8Bytes(`demo-photo-${suffix}`)),
      metadataHash: ethers.keccak256(ethers.toUtf8Bytes(`demo-metadata-${suffix}`)),
      geoHash: ethers.keccak256(ethers.toUtf8Bytes(`demo-geo-${suffix}`)),
      coopSigner: await roles.coop.getAddress(),
      buyerSigner: await roles.buyer.getAddress(),
      coopNonce: nextNonce(await roles.coop.getAddress()),
      buyerNonce: nextNonce(await roles.buyer.getAddress()),
      deadline: await future(),
    };
    const coopSig = await roles.coop.signTypedData(domain, createTypes, { ...batch, signer: batch.coopSigner, signerRole: 1, nonce: batch.coopNonce });
    const buyerSig = await roles.buyer.signTypedData(domain, createTypes, { ...batch, signer: batch.buyerSigner, signerRole: 2, nonce: batch.buyerNonce });
    await (await batches.connect(roles.relayer).createBatch(batch, coopSig, buyerSig)).wait();
    return batch.batchId;
  }

  async function handover(batchId: string, from: Signer, to: Signer, nextStage: number, pricePaise: number) {
    const data = {
      batchId,
      fromSigner: await from.getAddress(),
      toSigner: await to.getAddress(),
      nextStage,
      pricePerKgPaise: pricePaise,
      locationHash: ethers.keccak256(ethers.toUtf8Bytes(`demo-location-${batchId.slice(-6)}-${nextStage}`)),
      prevRecordHash: (await batches.getBatch(batchId)).lastRecordHash,
      fromNonce: nextNonce(await from.getAddress()),
      toNonce: nextNonce(await to.getAddress()),
      deadline: await future(),
    };
    const fromSig = await from.signTypedData(domain, handoverTypes, { ...data, signer: data.fromSigner, nonce: data.fromNonce });
    const toSig = await to.signTypedData(domain, handoverTypes, { ...data, signer: data.toSigner, nonce: data.toNonce });
    await (await batches.connect(roles.relayer).recordHandover(data, fromSig, toSig)).wait();
  }

  const results: { batchId: string; shortCode: string; stage: string }[] = [];
  const record = async (batchId: string, stage: string) => {
    results.push({ batchId, shortCode: shortCodeOf(batchId), stage });
    console.log(`  ${shortCodeOf(batchId)}  ${stage.padEnd(12)} ${batchId}`);
  };

  console.log("\nSeeding demo batches:");

  // Batch 1: full journey through sale and settlement.
  const b1 = await createBatch("settled", 25_000, 1_000);
  await handover(b1, roles.buyer, roles.trucker, IN_TRANSIT, 1_200);
  await handover(b1, roles.trucker, roles.coldStorage, COLD_STORAGE, 1_500);
  await handover(b1, roles.coldStorage, roles.mandi, MANDI, 2_000);
  const escrow = 250_000_000n;
  await (await token.connect(roles.admin).mint(await roles.buyer.getAddress(), escrow)).wait();
  await (await token.connect(roles.buyer).approve(pool.target, escrow)).wait();
  await (await pool.connect(roles.buyer).fundBatch(b1, escrow)).wait();
  const sale = {
    batchId: b1,
    finalPricePerKgPaise: 4_000,
    buyerSigner: await roles.buyer.getAddress(),
    mandiAgentSigner: await roles.mandi.getAddress(),
    buyerNonce: nextNonce(await roles.buyer.getAddress()),
    mandiNonce: nextNonce(await roles.mandi.getAddress()),
    deadline: await future(),
  };
  const buyerSig = await roles.buyer.signTypedData(domain, saleTypes, { ...sale, signer: sale.buyerSigner, nonce: sale.buyerNonce });
  const mandiSig = await roles.mandi.signTypedData(domain, saleTypes, { ...sale, signer: sale.mandiAgentSigner, nonce: sale.mandiNonce });
  await (await batches.connect(roles.relayer).markSold(sale, buyerSig, mandiSig)).wait();
  await (
    await pool.connect(roles.relayer).settle(b1, {
      farmer: await roles.payouts[0].getAddress(),
      coop: await roles.payouts[1].getAddress(),
      trucker: await roles.payouts[2].getAddress(),
      coldStorage: await roles.payouts[3].getAddress(),
      mandiAgent: await roles.payouts[4].getAddress(),
      platform: await roles.payouts[5].getAddress(),
    })
  ).wait();
  await record(b1, "SETTLED");

  // Batch 2: mid-journey with an AI attestation.
  const b2 = await createBatch("graded", 18_000, 1_100);
  await handover(b2, roles.buyer, roles.trucker, IN_TRANSIT, 1_200);
  await handover(b2, roles.trucker, roles.coldStorage, COLD_STORAGE, 1_400);
  const attestation = {
    batchId: b2,
    aiGrade: 1,
    aiFlags: 0b0101,
    resultHash: ethers.keccak256(ethers.toUtf8Bytes("demo-ai-result")),
    oracleSigner: await roles.oracle.getAddress(),
    nonce: nextNonce(await roles.oracle.getAddress()),
    deadline: await future(),
  };
  const oracleSig = await roles.oracle.signTypedData(domain, aiTypes, attestation);
  await (await batches.connect(roles.relayer).attestAI(attestation, oracleSig)).wait();
  await record(b2, "COLD_STORAGE");

  // Batch 3: freshly created at the farm gate.
  const b3 = await createBatch("fresh", 30_000, 900);
  await record(b3, "FARM_GATE");

  const deploymentName = ["localhost", "hardhat"].includes(network.name) ? "local" : network.name;
  const summary = {
    network: deploymentName,
    chainId: net.chainId.toString(),
    deployedAt: new Date().toISOString(),
    contracts: {
      sachAccess: access.target.toString(),
      farmerRegistry: farmers.target.toString(),
      batchRegistry: batches.target.toString(),
      mockUsdc: token.target.toString(),
      paymentPool: pool.target.toString(),
    },
    demo: {
      farmerId,
      coopId,
      batches: results,
    },
  };
  const outDir = path.join(__dirname, "..", "..", "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${deploymentName}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`\nDeployment summary written to ${outFile}`);
}

main().catch((error) => {
  console.error("Demo seed failed:", error);
  process.exitCode = 1;
});
