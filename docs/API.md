# API contract

The NestJS API is versioned under `/v1`. Public consumer access is provided by `GET /v1/trace/:batchId` and `GET /v1/batches`; actor mutations go through the relayer endpoints and require signed EIP-712 payloads. The API reads chain state directly through the RPC node and can maintain a Postgres read model through the event indexer when `DATABASE_URL` is configured.

## Health

`GET /health` returns:

```json
{"status":"ok","service":"sachbazaar-api"}
```

## Trace

`GET /v1/trace/:batchId` returns the public trace view. `batchId` must be a `0x`-prefixed 32-byte hex string; unknown batches return `404`, malformed IDs `400`. Every record hash is recomputed off-chain (per `docs/HASHING.md` field order) and compared with the stored chain values; `verified` is only true when the entire walk matches, the on-chain `verifyRecordChain` agrees, and the last record equals `lastRecordHash`.

```json
{
  "batchId": "0x...",
  "shortCode": "FAFYKNWYT2L34",
  "verified": true,
  "stage": "SETTLED",
  "crop": "tomato",
  "farmerId": "0x...",
  "coopId": "0x...",
  "weightGrams": 25000,
  "pricePerKgPaise": 4000,
  "createdAt": "2026-10-24T17:43:23.000Z",
  "ai": {"grade": 1, "flags": [0, 2], "rawFlags": 5},
  "records": [
    {
      "index": 0,
      "stage": "FARM_GATE",
      "from": "0x...",
      "to": "0x...",
      "pricePerKgPaise": 1000,
      "timestamp": "2026-10-24T17:43:23.000Z",
      "recordHash": "0x...",
      "prevRecordHash": "0x000...000",
      "verified": true
    }
  ],
  "settlement": {"settled": true},
  "priceSplit": []
}
```

`priceSplit` stays empty until an indexer exists: payout recipients are passed to `settle` and are not reconstructible from chain state alone.

## Demo batches

`GET /v1/batches` returns the demo farmer/co-op IDs (needed to sign batch creation) and all batches discovered from `BatchCreated` events. Deployment metadata is used as a fallback, so fresh batches remain discoverable after a browser refresh even without Postgres:

```json
{"farmerId":"0x...","coopId":"0x...","batches":[{"batchId":"0x...","shortCode":"FAFYKNWYT2L34","stage":"SETTLED"}]}
```

The trace response also includes `lastRecordHash` — the chain head the next handover's `prevRecordHash` must cite.

## AI advisory

`POST /v1/ai/grade` proxies the FastAPI advisory service (`apps/ai-service`, `AI_SERVICE_URL`): the client sends the photo base64-encoded, the API forwards it upstream as multipart, and the advisory score/explanation come back. Scores are advisory only — they never gate a state transition; the client maps them to the on-chain grade/flags before the oracle signs.

```json
// request
{"photoBase64":"..."}
// response
{"score":0.422,"explanation":"sha256-seeded quality score (64-byte sample) places this batch in the fair band.","modelVersion":"baseline-mock-0.2"}
```

`GET /v1/ai/health` reports whether the AI service is reachable.

## Relayer

Actor actions follow the architecture rule that users sign EIP-712 typed data and a relayer submits. The relayer private key lives only in the API process (`RELAYER_PRIVATE_KEY`). Relay responses wait for a mined successful receipt and include `confirmed` and `blockNumber`.

`GET /v1/relay` reports relayer readiness and everything a client needs to build the EIP-712 signing domain locally:

```json
{
  "configured": true,
  "relayerAddress": "0x...",
  "chainId": "31337",
  "network": "local",
  "eip712": {"name": "SachBazaar", "version": "1", "chainId": 31337, "verifyingContract": "0x..."},
  "contracts": {"batchRegistry": "0x...", "mockUsdc": "0x...", "paymentPool": "0x..."}
}
```

`POST /v1/relay/{create-batch|handover|ai-attest|mark-sold|settle}` accepts `{ "data": {...struct fields...}, "signatures": {...} }`. `data` carries the exact contract struct fields (camelCase as in the ABI); `signatures` carries the actor signatures per action (`coop`+`buyer`, `from`+`to`, `oracle`, `buyer`+`mandiAgent`, or none for `settle`, which takes `recipients`). The API sanity-checks shapes and deadlines, does a `staticCall` first to surface contract reverts as `400` with the custom-error name, waits for a mined receipt, and returns:

```json
{"accepted":true,"confirmed":true,"txHash":"0x...","blockNumber":123,"relayedBy":"0x...","chainId":"31337"}
```

`GET /v1/relay/transactions/:txHash` returns a persisted transaction status when Postgres storage is enabled. The indexer stores `BatchCreated`, `HandoverRecorded`, `AIAttested`, `BatchSold`, and `BatchSettled` events idempotently after the configured confirmation depth.

Clients may send an `Idempotency-Key` header (8–128 safe ASCII characters). Repeating the same key and payload returns the original confirmed response instead of submitting a duplicate transaction; reusing a key for a different payload returns `400`. Keys are in-memory without Postgres and durable across API restarts when Postgres is enabled. The API also applies a configurable in-process request limit using `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW_MS`; deploy an edge/API-gateway limiter for horizontally scaled production instances.

## Future

The remaining production hardening includes JWT role guards, idempotency keys, and external secret management for the relayer.
