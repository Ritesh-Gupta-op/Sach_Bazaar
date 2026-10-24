# SachBazaar architecture

## System boundary

The chain is an audit anchor, not the application database. Heavy data, PII, images, model inputs, and user-facing localized content remain off-chain. Polygon Amoy is the development network (`chainId 80002`); the network is configured rather than hard-coded so another EVM testnet can be selected later.

```text
Farmer / co-op / buyer apps
          |
          v
NestJS API ---- Postgres (PII encrypted, outbox, indexer state)
    |  \---- Redis + BullMQ
    |  \---- StorageProvider (local/IPFS)
    |  \---- FastAPI AI service
    v
Relayer ---- SachAccess / FarmerRegistry / BatchRegistry / PaymentPool
                                  |
                                  v
                           Polygon Amoy
```

## Trust and data rules

1. Users sign EIP-712 actions; a relayer submits transactions and pays gas.
2. Smart contracts verify signer roles, nonce, deadline, and state transitions.
3. Hashes are commitments only. Personal data hashes include a random off-chain salt so deletion can invalidate the commitment.
4. The indexer waits for confirmations and writes events idempotently.
5. The public trace endpoint recomputes off-chain hashes before returning `verified`.

## Phase boundaries

- Phase 0: repository, infrastructure, documentation, CI, and runnable service shells.
- Phase 1: non-upgradeable contract core with role control, dual-signature batch actions, AI attestations, disputes, escrow, pull payments, and tests.
- Later phases: NestJS modules, Prisma schema, AI models, indexer, offline sync, deployment, and end-to-end trace flow.
