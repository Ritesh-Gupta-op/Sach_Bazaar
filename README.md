# SachBazaar

SachBazaar is a farm-to-mandi traceability pilot for tomatoes. The repository is a pnpm monorepo containing the Polygon smart contracts, backend service scaffold, AI service scaffold, shared contract artifacts, infrastructure, and project documentation.

## Current phase

Phase 0 and Phase 1 build the local development foundation and the non-upgradeable contracts. Amoy deployment is intentionally not performed until a funded deployer key and RPC URL are supplied through environment variables.

## Prerequisites

- Node.js 20.18 or newer
- pnpm 9.15.5 (`corepack enable` or install pnpm through your preferred package manager)
- Docker and Docker Compose for Postgres, Redis, and IPFS
- Python 3.11+ for the AI service
- Slither for static analysis (optional locally; CI attempts it when available)

## Quick start

```bash
cp .env.example .env
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm test
```

Contract-specific commands:

```bash
pnpm contracts:compile
pnpm contracts:test
pnpm contracts:coverage
pnpm contracts:slither
```

See [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for environment variables, local chain usage, future Amoy deployment, key rotation, and the mainnet migration checklist.
