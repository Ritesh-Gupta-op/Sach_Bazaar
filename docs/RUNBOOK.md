# Runbook

## Local setup

1. Copy `.env.example` to `.env` and replace development secrets.
2. Install the pinned package manager and dependencies: `pnpm install`.
3. Start infrastructure with `docker compose -f infra/docker-compose.yml up -d`.
4. Run contracts with `pnpm contracts:compile`, `pnpm contracts:test`, and `pnpm contracts:coverage`.

The Hardhat test network is in-memory. No keys are needed for local tests.

## Local demo stack (chain + API + web)

1. `npx hardhat node` (from `packages/contracts`) — local chain on `http://127.0.0.1:8545`.
2. `npx hardhat run scripts/demo-seed.ts --network localhost` — deploys the five contracts, grants roles to the deterministic accounts, seeds demo batches at different stages, and writes `deployments/local.json`.
3. `pnpm dev:api` — NestJS API on `:3000` (`NETWORK=local`, `RPC_URL`, `RELAYER_PRIVATE_KEY` from `.env`; the demo seed grants `RELAYER_ROLE` to Hardhat account #1, whose key ships in the local `.env`). If Postgres is running, set `DATABASE_URL`; the API creates its schema automatically and indexes confirmed contract events.
4. Start the AI advisory service: `cd apps/ai-service && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt && .venv/Scripts/python -m uvicorn app.main:app --port 8001` (or `docker build -t sach-ai . && docker run -p 8001:8001 sach-ai`). The console's AI card calls it through `POST /v1/ai/grade`; without it, grading photos returns a clear 502 and grades can still be entered manually.
5. `pnpm dev:web` — frontend on `:5173`; search a short code (e.g. from the seed output) or open a demo batch. The **Console** tab drives the full lifecycle as any role (create batch → handovers → AI grade → fund escrow → mark sold → settle → withdraw): in demo mode actions use the public Hardhat wallets; with `VITE_DEMO_MODE=false`, configured role addresses must be connected through an EIP-1193 browser wallet. Relayed actions wait for confirmation before refreshing the trace; escrow funding and payouts are submitted directly by the buyer/payout wallets.

To reset the chain: stop the node, restart it (accounts reset), and re-run the seed. `deployments/local.json` is overwritten each time and is gitignored.

## Persistence and indexer

The API can run without Postgres and will discover batches directly from `BatchCreated` logs. For durable listings, transaction status, and an indexed read model, start the database from `infra/docker-compose.yml`, set `DATABASE_URL`, and configure `INDEXER_FROM_BLOCK`, `INDEXER_CONFIRMATIONS`, `INDEXER_POLL_MS`, and `INDEXER_CHUNK_SIZE`. The storage service creates the tables on startup; the chain remains the source of truth.

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
