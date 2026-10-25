# SachBazaar 🍅

Farm-to-mandi traceability pilot for tomatoes on Polygon. The blockchain serves strictly as an **audit anchor and escrow settler**, not the application database: supply-chain actors (farmers, co-ops, truckers, cold storage operators, mandi agents) sign EIP-712 structured actions client-side, an automated gas-paying relayer submits them on-chain, and every custody hop forms a cryptographically hash-chained record. Photos, PII, and bulk metadata remain off-chain.

Users sign off-chain; the relayer pays network gas; the smart contracts strictly enforce roles, nonces, deadlines, and state transitions; the public trace engine recomputes every record hash before granting a `verified` status.

---

## 🏛️ System & Product Architecture

SachBazaar decouples high-throughput Web2 operational speeds from Web3 zero-trust auditability using a modular, service-oriented architecture:

```
                                  ┌────────────────────────┐
                                  │      Client Layer      │
                                  │  (Web Trace & Console) │
                                  └───────────┬────────────┘
                                              │
                         ┌────────────────────┼───────────────────┐
                         │ HTTP /api          │ Direct Web3       │ AI Photo Upload
                         ▼                    │ (Escrow / Pull)   ▼
             ┌─────────────────────────┐      │         ┌───────────────────┐
             │   NestJS API Gateway    │      │         │   FastAPI AI      │
             │   (apps/api)            │      │         │   Advisory Svc    │
             └───────────┬─────────────┘      │         │   (apps/ai-svc)   │
                         │                    │         └─────────┬─────────┘
        ┌────────────────┼────────────────┐   │                   │ (Quality score)
        ▼                ▼                ▼   ▼                   │
 ┌─────────────┐  ┌─────────────┐   ┌──────────────────────────┐  │
 │  Postgres   │  │    Redis    │   │      Polygon / EVM       │◄─┘
 │  (Indexer)  │  │   (Queue)   │   │  (Contracts Core)        │  (Attestation)
 └─────────────┘  └─────────────┘   │                          │
                                    │ • SachAccess (Roles)     │
                                    │ • BatchRegistry (Hops)   │
                                    │ • FarmerRegistry         │
                                    │ • PaymentPool (Escrow)   │
                                    │ • MockUSDC (Settlement)  │
                                    └──────────────────────────┘
```

### Component Breakdown

| Layer / Workspace | Tech Stack | Responsibility & Architecture Role |
|---|---|---|
| **`packages/contracts`** | Solidity 0.8.24, Hardhat, Ethers.js | **Audit Anchor & Escrow Engine**: Non-upgradeable contracts enforcing dual-signed state transitions (`BatchRegistry`), role-based access control (`SachAccess`), and multi-recipient escrow settlement (`PaymentPool`). |
| **`packages/shared`** | TypeScript, Ethers.js | **Single Source of Truth**: EIP-712 typed-data definitions matching Solidity `keccak256` typehashes, shared contract ABIs, and 13-character Crockford-base32 short-code algorithms. |
| **`apps/api`** | NestJS, TypeScript, Ethers.js | **Relayer & Trace Gateway**: Recomputes off-chain record hashes to detect tampering, manages the gas-sponsoring relayer wallet, proxies advisory AI grading, and discovers on-chain batches. |
| **`apps/web`** | React 19, Vite, TailwindCSS | **Public Trace & Simulator Console**: Interactive public search by QR or short code, verified custody timeline, and a full role-simulator console supporting both demo keys and Web3 browser wallets. |
| **`apps/ai-service`** | FastAPI, Python 3.12+, Pydantic | **Computer Vision Advisory Engine**: Analyzes produce photos for quality grading, defect detection, and anomaly scoring before on-chain oracle attestation. |
| **`infra`** | Docker Compose | Optional local infrastructure: Postgres (indexer storage), Redis (task queues), and IPFS (decentralized image anchoring). |

---

## 🔄 Supply-Chain Lifecycle Workflow

Each tomato crate navigates an immutable 5-stage lifecycle:

```
[ Farm Gate ] ──(Dual-Signed)──► [ In Transit ] ──(Dual-Signed)──► [ Cold Storage ]
 (Co-op + Buyer)                  (Trucker)                         (Storage Agent)
        │                                                                  │
        ▼                                                                  ▼
 [ AI Quality Grade ]                                              [ Mandi Market ]
 (Oracle Attestation)                                                (Mandi Agent)
                                                                           │
                                                                           ▼
                                                                 [ Settled / Escrow Payout ]
                                                                   (Farmer, Co-op, Logistics)
```

1. **Farm Gate**: Co-op agent and buyer dual-sign the initial batch details (weight, base price, geo-coordinates, photo hash).
2. **Custody Hops**: Every handover (Trucker $\rightarrow$ Cold Storage $\rightarrow$ Mandi) generates an on-chain record linked to the previous record hash (`prevRecordHash`).
3. **AI Grading**: Photo is evaluated by the advisory AI service; score and flags are signed by an authorized oracle address.
4. **Escrow Funding**: Buyer deposits USDC into the `PaymentPool` contract.
5. **Settlement**: Upon final sale at the Mandi, the contract splits escrowed funds directly to farmer, co-op, trucker, cold storage, and market fees via non-reentrant pull payments.

---

## 🚀 CI / CD & Deployment Pipeline

SachBazaar employs automated multi-tiered CI/CD pipelines ensuring contract security, cross-workspace TypeScript compilation, and monorepo cloud deployment.

### 1. Continuous Integration (GitHub Actions)

Defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml), triggered on every push and pull request:

```
GitHub Push / Pull Request
  ├── Job 1: Contracts Pipeline (Ubuntu, Node 20)
  │    ├── Install workspace dependencies (pnpm)
  │    ├── Compile Solidity 0.8.24 contracts (Hardhat)
  │    ├── Execute smart contract test suite
  │    ├── Generate code coverage reports
  │    └── Static Analysis: Crytic Slither Action (security audit)
  │
  ├── Job 2: Node Workspaces Pipeline (Ubuntu, Node 20)
  │    ├── Monorepo-wide strict TypeScript typechecking (`pnpm typecheck`)
  │    ├── Unit & integration tests for `@sachbazaar/shared` (typehash drift guards)
  │    ├── Unit & integration tests for `@sachbazaar/api` (relay, trace, hash validation)
  │    └── Unit & component tests for `@sachbazaar/web` (Vitest test suite)
  │
  └── Job 3: AI Service Pipeline (Ubuntu, Python 3.12)
       ├── Install dependencies (`requirements.txt` + `requirements-dev.txt`)
       └── Execute pytest test suite (grading determinism & health checks)
```

### 2. Continuous Delivery & Hosting (Vercel Multi-Service)

Configured via [`vercel.json`](vercel.json), enabling single-project deployment across multiple micro-services:

```
                                  Internet Requests
                                          │
                        ┌─────────────────┴─────────────────┐
                 /api/* │                                   │ /* (catch-all)
                        ▼                                   ▼
              ┌──────────────────┐                ┌──────────────────┐
              │   Service: api   │                │   Service: web   │
              │  (NestJS Server) │                │  (React / Vite)  │
              └────────┬─────────┘                └──────────────────┘
                       │
                       │ Internal Binding (AI_SERVICE_URL)
                       ▼
              ┌──────────────────┐
              │ Service: ai-svc  │
              │  (FastAPI - INT) │
              └──────────────────┘
```

- **`web`**: Public root `/` served by Vite static bundle.
- **`api`**: Public backend routed through `/api/(.*)`.
- **`ai-service`**: **Internal-only service**. Protected from public web access; accessible exclusively from `api` via secure internal Vercel Service Bindings (`AI_SERVICE_URL`).

---

## ⚡ Quick Start — Full Local Demo

### Prerequisites
- **Node.js**: $\ge$ 20.18.0
- **Package Manager**: pnpm 9.15.5 (`corepack enable`)
- **Python**: 3.12+ (for `apps/ai-service`)

### 1. Clone & Install
```bash
git clone https://github.com/Ritesh-Gupta-op/Sach_Bazaar.git
cd Sach_Bazaar
cp .env.example .env
pnpm install
```

### 2. Run Local Chain & Seed Demo Data
```bash
# Terminal 1: Start local Hardhat chain
cd packages/contracts && npx hardhat node

# Terminal 2: Deploy contracts & seed demo batches
npx hardhat run scripts/demo-seed.ts --network localhost
```

### 3. Start Backend, AI Service, and Frontend
```bash
# Terminal 3: NestJS API (Port 3000)
pnpm dev:api

# Terminal 4: AI Service (Port 8001)
cd apps/ai-service && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --port 8001

# Terminal 5: Web Frontend (Port 5173)
pnpm dev:web
```

---

## 🧪 Testing & Verification

Run tests across all workspaces:

```bash
pnpm test                 # Run all unit tests across API, Web, Shared, and Contracts
pnpm typecheck            # Check TypeScript types across monorepo
pnpm contracts:compile    # Compile Solidity artifacts
pnpm contracts:test       # Execute Hardhat contract test suite
pnpm contracts:coverage   # Generate Solidity code coverage
pnpm contracts:slither    # Run Slither static security analyzer
```

---

## 📚 Technical Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System boundaries, trust rules, and state machines.
- [`docs/HASHING.md`](docs/HASHING.md) — Byte-level hashing formulas that off-chain clients and smart contracts must adhere to.
- [`docs/API.md`](docs/API.md) — Specification for the Trace, Relayer, and AI proxy endpoints.
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — Operational runbook: local demo stack, key management, testnet deployment, and key rotation.
- [`docs/SECURITY.md`](docs/SECURITY.md) — Slither exclusions, threat model, and key security postures.
- [`CHANGELOG.md`](CHANGELOG.md) — Chronological history of releases and enhancements.

---

## 🔒 Security & Environment Variables

- Secrets and private keys are kept strictly in `.env` (gitignored).
- Never commit private keys to version control.
- In production, set `VITE_DEMO_MODE=false` in the frontend to disable simulated Hardhat wallets and enforce standard Web3 wallet connections (MetaMask, Coinbase Wallet, etc.).
