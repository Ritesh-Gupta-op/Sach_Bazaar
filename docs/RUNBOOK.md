# Runbook

## Local setup

1. Copy `.env.example` to `.env` and replace development secrets.
2. Install the pinned package manager and dependencies: `pnpm install`.
3. Start infrastructure with `docker compose -f infra/docker-compose.yml up -d`.
4. Run contracts with `pnpm contracts:compile`, `pnpm contracts:test`, and `pnpm contracts:coverage`.

The Hardhat test network is in-memory. No keys are needed for local tests.

## Environment variables

`AMOY_RPC_URL`, `POLYGON_RPC_URL`, and the private key variables are never committed. API secrets and PII encryption keys are also environment-only. Use a KMS-backed secret in a deployed environment; the `.env` fallback is for local development only.

## Deployment checklist (future Phase 2)

1. Fund a deployer with Amoy POL using a current third-party faucet or provider.
2. Set `AMOY_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, and `POLYGONSCAN_API_KEY`.
3. Run the deployment script from `packages/contracts` with the Amoy network.
4. Grant the relayer and oracle roles, set the payment pool, and export addresses/ABIs to `packages/shared`.
5. Run the smoke script and wait for the configured confirmation count.

Polygon PoS mainnet is chain ID 137; Amoy is chain ID 80002. The network is selected through Hardhat and backend configuration, not source-code edits.

## Key rotation

Rotate relayer/oracle keys by granting the replacement role, updating the backend secret, draining/replacing the old relayer, then revoking the old role. Rotate the PII encryption key through an envelope-key migration; do not overwrite ciphertext without a migration record.

## Mainnet migration

Deploy a new version with a Safe as admin, configure the real USDC address, verify every address and role, and run a dry-run against a fork. Do not reuse Amoy private keys or test tokens.
