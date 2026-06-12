CREATE TABLE IF NOT EXISTS players (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  balance INT NOT NULL DEFAULT 10000
);

CREATE TABLE IF NOT EXISTS hand_histories (
  id SERIAL PRIMARY KEY,
  table_id VARCHAR(255) NOT NULL,
  hand_number INT NOT NULL,
  state_log JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hand_histories_table_id ON hand_histories(table_id, hand_number);
