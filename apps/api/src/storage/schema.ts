export const STORAGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS indexer_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
  batch_id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  coop_id TEXT NOT NULL,
  crop_code INTEGER NOT NULL,
  weight_grams NUMERIC NOT NULL,
  price_per_kg_paise NUMERIC NOT NULL,
  ai_grade INTEGER NOT NULL DEFAULT 0,
  ai_flags INTEGER NOT NULL DEFAULT 0,
  last_record_hash TEXT NOT NULL,
  stage TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  tx_hash TEXT,
  block_number BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batch_events (
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  batch_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS transactions (
  tx_hash TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  block_number BIGINT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
