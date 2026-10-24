import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("====================================================");
  console.log("Deploying SachBazaar contracts to network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "POL/MATIC");
  console.log("====================================================\n");

  if (balance === 0n) {
    throw new Error("Deployer account has 0 balance. Please fund your wallet with testnet tokens.");
  }

  // 1. Deploy SachAccess
  console.log("1. Deploying SachAccess...");
  const SachAccessFactory = await ethers.getContractFactory("SachAccess");
  const access = await SachAccessFactory.deploy(deployer.address);
  await access.waitForDeployment();
  const accessAddress = await access.getAddress();
  console.log("   SachAccess deployed to:", accessAddress);

  // 2. Deploy FarmerRegistry
  console.log("2. Deploying FarmerRegistry...");
  const FarmerRegistryFactory = await ethers.getContractFactory("FarmerRegistry");
  const farmers = await FarmerRegistryFactory.deploy(accessAddress);
  await farmers.waitForDeployment();
  const farmersAddress = await farmers.getAddress();
  console.log("   FarmerRegistry deployed to:", farmersAddress);

  // 3. Deploy BatchRegistry
  console.log("3. Deploying BatchRegistry...");
  const BatchRegistryFactory = await ethers.getContractFactory("BatchRegistry");
  const batches = await BatchRegistryFactory.deploy(accessAddress, farmersAddress);
  await batches.waitForDeployment();
  const batchesAddress = await batches.getAddress();
  console.log("   BatchRegistry deployed to:", batchesAddress);

  // 4. Deploy MockUSDC
  console.log("4. Deploying MockUSDC...");
  const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
  const token = await MockUSDCFactory.deploy(accessAddress);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("   MockUSDC deployed to:", tokenAddress);

  // 5. Deploy PaymentPool
  console.log("5. Deploying PaymentPool...");
  const PaymentPoolFactory = await ethers.getContractFactory("PaymentPool");
  const pool = await PaymentPoolFactory.deploy(tokenAddress, accessAddress, batchesAddress);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("   PaymentPool deployed to:", poolAddress);

  // 6. Link BatchRegistry with PaymentPool
  console.log("6. Linking BatchRegistry to PaymentPool...");
  const linkTx = await batches.setPaymentPool(poolAddress);
  await linkTx.wait();
  console.log("   Linked successfully!\n");

  const deploymentSummary = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      SachAccess: accessAddress,
      FarmerRegistry: farmersAddress,
      BatchRegistry: batchesAddress,
      MockUSDC: tokenAddress,
      PaymentPool: poolAddress,
    },
    explorerUrls: {
      SachAccess: `https://amoy.polygonscan.com/address/${accessAddress}`,
      FarmerRegistry: `https://amoy.polygonscan.com/address/${farmersAddress}`,
      BatchRegistry: `https://amoy.polygonscan.com/address/${batchesAddress}`,
      MockUSDC: `https://amoy.polygonscan.com/address/${tokenAddress}`,
      PaymentPool: `https://amoy.polygonscan.com/address/${poolAddress}`,
    },
  };

  const outputPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentSummary, null, 2));

  console.log("====================================================");
  console.log("Deployment Complete! Summary saved to deployed-addresses.json");
  console.log(JSON.stringify(deploymentSummary, null, 2));
  console.log("====================================================");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
