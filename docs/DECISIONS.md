# Decisions

This file records implementation defaults made while requirements were still broad. Each entry is intentionally short and should be updated when product owners choose a different behavior.

## 2026-10-24 — Initial Phase 0/1 defaults

- **Solidity package layout:** use one Hardhat package under `packages/contracts`, with a shared package for generated artifacts. This keeps contract compilation independent from the future NestJS build.
- **Contract versioning:** contracts are non-upgradeable and expose `VERSION = "1.0.0"`. A future migration deploys a new registry/pool and migrates by events; no proxy storage is introduced in the MVP.
- **Signature nonces:** signatures use explicit `(signer, nonce)` replay slots instead of requiring sequential nonces. Offline clients can sign while disconnected and the relayer can submit in any order.
- **Farm-gate custodian:** the buyer signer is the initial custodian. Later handovers require the stored custodian as the sender and make the receiver the new custodian.
- **Record storage:** records are retained as compact structs for deterministic local verification and emitted in events. A future gas optimization can rely on events only once the indexer is production-ready.
- **Disputes:** a dispute stores the prior stage, moves the batch to `DISPUTED`, and an admin resolves it by selecting a non-final stage. A batch must be marked sold again after a dispute resolved before sale.
- **Settlement amount:** the payment pool distributes the escrow balance. INR price fields remain informational for the payment policy; stablecoin/INR conversion is outside the contract.
- **Sale signatures:** the final buyer and mandi-agent signatures are independent of the last physical custodian. The handover custodian is still required for each hop; a mandi buyer can approve a sale after the mandi agent receives the batch.
- **Deployment:** no testnet transaction is attempted without a funded key and RPC URL. Local Hardhat tests are the Phase 1 acceptance environment.
