# Contract security notes

Phase 1 runs Slither against the Solidity sources. The following detector exclusions are deliberate and reviewed:

- `incorrect-equality`: `BatchRegistry.verifyRecordChain` must use exact equality for the hash-chain head; changing it to an inequality would make a tampered chain look valid.
- `timestamp`: deadlines intentionally compare against `block.timestamp`, and record timestamps intentionally anchor the on-chain record. A deadline is not used for value transfer or randomness.
- `reentrancy-events`: `PaymentPool.fundBatch` is `nonReentrant`, writes the escrow state before the ERC-20 call, and uses `SafeERC20`; the detector's remaining report is the event emitted after the token transfer.

The uninitialized hash-chain cursor was fixed by explicitly starting `previous` at `bytes32(0)`. The settlement and withdrawal paths use `nonReentrant`, checks-effects-interactions, and pull payments. A future audit should re-run Slither without exclusions and review these decisions against the deployed token and relayer configuration.
