# SachBazaar 🍅

Farm-to-mandi traceability pilot for tomatoes on Polygon. The chain is an **audit anchor**, not the application database: farmers, co-ops, truckers, cold storage, and mandi agents sign EIP-712 typed-data actions, a gas-paying relayer submits them, and every custody hop becomes a hash-chained on-chain record. Photos, PII, and heavy data stay off-chain.

Users sign; the relayer pays gas; the contracts verify roles, nonces, deadlines, and state transitions; the public trace view recomputes every record hash before showing a `verified` badge.

## What's in the repo

| Workspace | What it is |
|---|---|
| `packages/contracts` | Non-upgradeable Solidity 0.8.24 contracts (`SachAccess` role registry, `FarmerRegistry`, `BatchRegistry` state machine, `PaymentPool` escrow, `MockUSDC`), Hardhat tests, deploy + demo-seed scripts |
| `packages/shared` | EIP-712 typed-data definitions mirroring the contract typehashes, exported ABIs, batch short-code helpers |
| `apps/api` | NestJS API: `GET /v1/trace/:batchId` with off-chain hash verification, `POST /v1/relay/*` meta-transaction relayer, AI advisory proxy |
| `apps/web` | React + Vite frontend: public trace UI (short code / QR search, verified journey timeline) and the journey console that drives the full lifecycle as any role |
| `apps/ai-service` | FastAPI advisory service — deterministic sha256-seeded grading mock until the real model lands |
| `infra` | Docker Compose: Postgres, Redis, IPFS (for later phases) |
| `deployments` | Per-network contract address files (`local.example.json` is the schema; real files are gitignored) |

## Quick start — full local demo

Prerequisites: Node.js ≥ 20.18, pnpm 9.15.5 (`corepack enable`), Python 3.12+ for the AI service. Docker only needed for Postgres/Redis/IPFS (not required for the demo flow).

```bash
cp .env.example .env
pnpm install
```

Then five terminals (or see [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for details):

```bash
# 1. local chain
cd packages/contracts && npx hardhat node

# 2. deploy + seed demo batches (settled, mid-journey, farm-gate)
npx hardhat run scripts/demo-seed.ts --network localhost

# 3. API (trace + relayer + AI proxy + optional indexer) on :3000
pnpm dev:api

# 4. AI advisory service on :8001
cd apps/ai-service && .venv/Scripts/python -m uvicorn app.main:app --port 8001

# 5. web on :5173
pnpm dev:web
```

For durable batch listings and transaction status, start Postgres before the API:

```bash
docker compose -f infra/docker-compose.yml up -d postgres
```

The API creates its indexer schema automatically when `DATABASE_URL` is set. Without Postgres, it still discovers batches from on-chain `BatchCreated` events.

## What you can demo

- **Trace** (`http://localhost:5173`): scan or type a crate short code (e.g. `FAFYKNWYT2L34`) → verified journey timeline, stage progress, AI grade, per-record hash verification, QR code.
- **Console** (`/console`): act as any supply-chain role — create a dual-signed batch, walk it farm gate → truck → cold storage → mandi, grade a photo through the AI service and attest the result, fund USDC escrow, mark sold, settle the payout split, and withdraw. Demo mode uses the public Hardhat wallets locally; production mode uses configured browser-wallet accounts and never embeds private keys.

## Development

```bash
pnpm test                 # contracts + API unit tests
pnpm typecheck            # all workspaces
pnpm contracts:compile    # Hardhat compile
pnpm contracts:test       # contract suite only
pnpm contracts:coverage   # coverage
pnpm contracts:slither    # static analysis (optional)
```

Polygon Amoy (chainId 80002) is the development network; no testnet transaction is attempted without a funded `DEPLOYER_PRIVATE_KEY` and `AMOY_RPC_URL`. For production web signing, set `VITE_DEMO_MODE=false`, configure the public role/payout addresses from `.env.example`, and connect those accounts through a browser wallet. See the runbook for the deployment checklist, key rotation, and the mainnet migration notes.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system boundary and trust rules
- [`docs/HASHING.md`](docs/HASHING.md) — the byte-level hashing contract every client must match
- [`docs/API.md`](docs/API.md) — implemented endpoints and the planned trace shape
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — local demo stack, env vars, deployment, key rotation
- [`docs/SECURITY.md`](docs/SECURITY.md) — Slither exclusions and security posture
- [`CHANGELOG.md`](CHANGELOG.md) — notable changes

Secrets live in `.env` (gitignored). Never commit private keys; nothing `VITE_`-prefixed is treated as secret.
