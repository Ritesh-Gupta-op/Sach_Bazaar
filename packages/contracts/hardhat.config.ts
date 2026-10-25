import 'dotenv/config';
import '@nomicfoundation/hardhat-toolbox';
import 'solidity-coverage';

import type { HardhatUserConfig } from 'hardhat/config';

const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: {
      url: process.env.LOCAL_RPC_URL ?? 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    amoy: {
      url: process.env.AMOY_RPC_URL ?? '',
      chainId: 80002,
      accounts,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL ?? '',
      chainId: 137,
      accounts,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
};

export default config;
