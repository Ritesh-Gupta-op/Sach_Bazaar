# Changelog

All notable changes to SachBazaar are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project is pre-1.0 and versions track development phases.

## [Unreleased] — 2026-10-24

Trace frontend, trace/relay API, journey console, AI advisory integration, and local demo tooling.

### Added

- **AI advisory service integration** — the mock FastAPI service is now checked, running, and actually used:
  - `apps/ai-service`: `/grade` upgraded from a constant `0.0` to a deterministic sha256-seeded quality score (same photo → same grade, different photos spread across bands) with band explanation; requirements moved to `>=` pins because `pydantic 2.10.x` has no Python 3.14 wheels.
  - API proxy: `POST /v1/ai/grade` (base64 photo in, advisory score/explanation out, forwarded upstream as multipart) and `GET /v1/ai/health`, with clear 502s when the service is down.
  - Journey console AI card: "Grade photo with AI service" (real file upload) or "use sample photo" buttons call the service, display the score/explanation, and auto-fill the on-chain grade (score bands 1–4) plus the quality-concern flag bit (score < 0.5) before the oracle signs. Verified end-to-end: photo → score 0.422 → grade 3/4 + flag → attestation → public trace page.

- **Journey console** (`apps/web` `/console`) — the mutation side of the demo, verified end-to-end in the browser through a full lifecycle (create → 3 handovers → AI attestation → escrow funding → sale → settlement → farmer withdrawal):
  - Role wallets derived in-browser from Hardhat's public mnemonic, matching the seed's role assignment (co-op, buyer, trucker, cold storage, mandi, oracle, admin + six payout recipients). Local demo only — real users would sign with their own wallets.
  - Create-batch form (batch ID derived per `docs/HASHING.md`, dual coop+buyer EIP-712 signatures), stage-aware action cards (handover hops with price, AI advisory attestation with grade/flags, USDC mint/fund, mark sold, settle with payout preview, per-recipient withdrawal with live claimable balances), and a transaction log.
  - All relayed actions sign EIP-712 typed data locally and submit through `POST /v1/relay/*`; escrow funding and withdrawals submit directly with the buyer/payout wallets (not relayer-gated).
- **`apps/web`** — public trace frontend (Vite + React + TypeScript + Tailwind CSS):
  - Search page: batch short code (13-char base32) or full `0x…` batch ID, camera QR scanning via `BarcodeDetector` with manual-entry fallback, clickable demo-batch list from `GET /v1/batches`, and a recently-viewed list in `localStorage`.
  - Trace page: overall chain-verification banner, batch header (crop, stage, weight, ₹/kg, created date, pseudonymous farmer/co-op IDs, escrow state), stage timeline (farm gate → in transit → cold storage → mandi → sold → settled, with dispute state), AI advisory-grade panel, per-hop journey records each with its own verified badge and hashes, and a QR code + short code for the scan-the-crate demo.
- **Trace API** (`apps/api`, NestJS under `/v1`):
  - `GET /v1/trace/:batchId` — public trace response per `docs/API.md`; recomputes every record hash off-chain in the exact `docs/HASHING.md` field order and returns `verified` only when the full walk, the on-chain `verifyRecordChain`, and the stored chain head all agree. `404` for unknown batches, `400` for malformed IDs.
  - `GET /v1/batches` — demo batch IDs/short codes read from the active deployment file.
  - `POST /v1/relay/{create-batch|handover|ai-attest|mark-sold|settle}` — meta-transaction relayer holding `RELAYER_PRIVATE_KEY` server-side; validates payload shape/deadlines, `staticCall`s first so contract reverts surface as `400` with the decoded custom-error name, then submits and returns the tx hash.
  - `GET /v1/relay` — relayer readiness/info, including the EIP-712 signing domain (`name`, `version`, `chainId`, `verifyingContract`) and contract addresses so clients can build typed-data payloads without extra configuration.
  - `GET /v1/batches` — demo farmer/co-op IDs plus seeded batch IDs/short codes read from the active deployment file; the trace response now also returns `lastRecordHash` (the chain head the next handover must cite).
- **Demo seed** (`packages/contracts/scripts/demo-seed.ts`, `pnpm --filter @sachbazaar/contracts seed:demo`): deploys all five contracts, grants roles to the deterministic local accounts, registers a farmer, configures the tomato payout policy, and seeds three batches at different lifecycle stages (fully settled, mid-journey with an AI attestation, fresh at farm gate). Writes the gitignored `deployments/<network>.json` consumed by the API (`NETWORK` env).
- **Deployment files convention**: `deployments/local.example.json` schema committed; per-network address files are gitignored (`deployments/local.json`, `deployments/amoy.json`).
- **Short-code utility** (`packages/shared`): `shortCodeOf` / `isValidShortCode` / `batchIdMatchesShortCode` — RFC 4648 base32 of the first 8 bytes of the batch ID per `docs/HASHING.md`.
- API unit tests (record-hash recomputation, tamper detection, chain-link validation, short-code format) and API `dev`/`start` scripts (`ts-node`, `node dist/main.js`); root convenience scripts `pnpm dev:api` / `pnpm dev:web`.
- Docs: `docs/API.md` rewritten around the implemented endpoints; `docs/RUNBOOK.md` gained a "Local demo stack" section; README links both and the changelog.

### Fixed

- API was never runnable: added the missing `@nestjs/platform-express` HTTP driver.
- Deployment-file path resolution from `apps/api` (wrong directory depth) and `.env` loading — dotenv now reads the repo-root `.env` explicitly since workspace script runs have `cwd` inside the app directory.
- `pnpm typecheck` now passes in every workspace by declaring direct dependencies that pnpm's isolated layout doesn't hoist: `@types/node`, `@types/mocha`, `@nomicfoundation/hardhat-network-helpers` (contracts).

### Security

- Removed a real-looking `DEPLOYER_PRIVATE_KEY` value from `.env.example` (committed in the deployment changes); replaced with a `replace-me` placeholder. **If that key was or will be funded, rotate it.** No `VITE_`-prefixed variable holds a secret — the frontend only talks to the API.

## [0.1.0] — 2026-10-24

Phase 0/1 foundation: repository, contracts, deployment tooling.

### Added

- pnpm monorepo scaffold: `apps/api` (NestJS health shell), `apps/ai-service` (FastAPI mock advisory endpoints), `packages/contracts` (Hardhat), `packages/shared` (EIP-712 types + exported ABIs), `infra/docker-compose.yml` (Postgres 16, Redis 7, IPFS kubo), GitHub Actions CI (compile, test, coverage, Slither).
- Non-upgradeable Solidity 0.8.24 contracts:
  - `SachAccess` — shared role registry (admin, oracle, co-op agent, buyer, trucker, cold storage, mandi agent, relayer).
  - `FarmerRegistry` — pseudonymous farmer commitments, no PII on-chain.
  - `BatchRegistry` — batch state machine (farm gate → in transit → cold storage → mandi → sold → settled, plus disputes), dual-signature EIP-712 actions with explicit replay nonces and deadlines, hash-chained custody records with on-chain verification, AI attestations.
  - `PaymentPool` — USDC escrow with basis-point payout splits (farmer minimum enforced, remainder to farmer), pull payments, pause.
  - `MockUSDC` — six-decimal test token.
  - Hardhat test suite covering roles, dual signatures, negative paths (expired, replayed, duplicate photo, inactive farmer), handover legality, disputes, escrow splits, and policy enforcement.
- Shared EIP-712 typed-data definitions mirroring the contract typehashes (`createBatchTypes`, `handoverTypes`, `aiAttestationTypes`, `saleTypes`).
- Hardhat deployment script targeting Polygon Amoy (chainId 80002) with balance pre-check and a deployment summary JSON; deployment is intentionally not run until a funded key and RPC URL are supplied.
- Project docs: `ARCHITECTURE.md`, `DECISIONS.md`, `HASHING.md`, `RUNBOOK.md`, `SECURITY.md`, `API.md`.
