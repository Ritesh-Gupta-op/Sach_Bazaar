# API contract

The NestJS API is versioned under `/v1`. Public consumer access is limited to `GET /v1/trace/:batchId`; actor mutations go through the relayer endpoints and require signed EIP-712 payloads. The API reads chain state directly through the RPC node (no indexer yet).

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

`GET /v1/batches` returns the demo farmer/co-op IDs (needed to sign batch creation) and the batch IDs seeded by `demo-seed` (read from `deployments/<network>.json`):

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

Actor actions follow the architecture rule that users sign EIP-712 typed data and a relayer submits. The relayer private key lives only in the API process (`RELAYER_PRIVATE_KEY`).

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

`POST /v1/relay/{create-batch|handover|ai-attest|mark-sold|settle}` accepts `{ "data": {...struct fields...}, "signatures": {...} }`. `data` carries the exact contract struct fields (camelCase as in the ABI); `signatures` carries the actor signatures per action (`coop`+`buyer`, `from`+`to`, `oracle`, `buyer`+`mandiAgent`, or none for `settle`, which takes `recipients`). The API sanity-checks shapes and deadlines, does a `staticCall` first to surface contract reverts as `400` with the custom-error name, then submits and returns:

```json
{"accepted":true,"txHash":"0x...","relayedBy":"0x...","chainId":"31337"}
```

## Future

The complete OpenAPI export arrives with the Phase 3 NestJS routes (JWT role guards, idempotency keys, indexer-backed listings).
