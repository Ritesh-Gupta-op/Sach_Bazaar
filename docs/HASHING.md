# Hashing contract

The mobile apps, API, indexer, and contracts must use the same byte-level inputs.

## Photo hash

`photoHash = SHA-256(raw image bytes)`, represented as a `bytes32` hex string. EXIF and other metadata are not silently removed; the original bytes are hashed and the parsed EXIF is stored off-chain.

## Metadata hash

1. Remove all raw PII from the metadata object.
2. Canonicalize the JSON with RFC 8785 JSON Canonicalization Scheme (JCS), including stable key ordering and no insignificant whitespace.
3. Encode the UTF-8 canonical JSON bytes.
4. `metadataHash = keccak256(canonicalJsonBytes)`.

The canonical object includes the pseudonymous farmer/co-op IDs, photo CID/hash, crop, weight, price, geo/timestamp claim, and model version/flags.

## Batch ID

`batchId = keccak256(abi.encode(coopId, farmerId, cropCode, clientUuid))`.

The printed short code is the base32 encoding of the first 8 bytes of the batch ID.

## Record hash

The first farm-gate record uses a zero `prevRecordHash`. Every subsequent record uses the exact Solidity field order:

```text
keccak256(abi.encode(
  prevRecordHash,
  batchId,
  locationHash,
  pricePerKgPaise,
  uint8(stage),
  timestamp,
  from,
  to
))
```

The contract limits a batch to 32 records in the MVP. The API must compare the recomputed record hash and previous hash to the indexed chain values and expose a per-record `verified` flag.
