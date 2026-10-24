# API contract (Phase 0 placeholder)

The NestJS API is versioned under `/v1`. Public consumer access is limited to `GET /v1/trace/:batchId`; actor mutations require JWT role guards and an idempotency key.

## Health

`GET /health` returns:

```json
{"status":"ok","service":"sachbazaar-api"}
```

## Planned public trace response

```json
{
  "batchId": "0x...",
  "verified": true,
  "stage": "SOLD",
  "crop": "tomato",
  "ai": {"grade": 1, "flags": []},
  "records": [{"recordHash":"0x...","verified":true}],
  "priceSplit": []
}
```

The complete OpenAPI export is added with the Phase 3 NestJS routes. This file keeps the frontend team's initial response shape explicit without pretending that the future endpoint is already implemented.
